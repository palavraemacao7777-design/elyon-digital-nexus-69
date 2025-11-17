import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"; // Corrected import statement

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders, status: 200 }); // Explicitly set status 200
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { mp_payment_id } = await req.json();
    if (!mp_payment_id) {
      console.error('VERIFY_MP_DEBUG: mp_payment_id ausente na requisição.');
      return new Response(JSON.stringify({ success: false, error: 'mp_payment_id ausente' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }
    console.log('VERIFY_MP_DEBUG: mp_payment_id recebido:', mp_payment_id);

    // Buscar access token
    const { data: mpConfig, error: mpConfigError } = await supabase
      .from('integrations')
      .select('mercado_pago_access_token')
      .not('mercado_pago_access_token', 'is', null)
      .limit(1)
      .maybeSingle();

    if (mpConfigError) {
      console.error('VERIFY_MP_DEBUG: Erro ao buscar mpConfig:', mpConfigError);
    }
    const accessToken = mpConfig?.mercado_pago_access_token || Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN');
    if (!accessToken) {
      console.error('VERIFY_MP_DEBUG: Access token do Mercado Pago não configurado.');
      return new Response(JSON.stringify({ success: false, error: 'Access token do Mercado Pago não configurado. Verifique as integrações ou variáveis de ambiente.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
    }
    console.log('VERIFY_MP_DEBUG: Access token obtido (length):', accessToken.length);

    // Consultar status diretamente no MP
    const resp = await fetch(`https://api.mercadopago.com/v1/payments/${mp_payment_id}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const mpPayment = await resp.json();
    if (!resp.ok) {
      console.error('VERIFY_MP_DEBUG: Erro ao consultar pagamento no MP:', mpPayment);
      return new Response(JSON.stringify({ success: false, error: 'Erro ao consultar pagamento no MP' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }
    console.log('VERIFY_MP_DEBUG: Detalhes do pagamento do MP:', mpPayment);

    const status = mpPayment.status as string;

    // Buscar pagamento existente para preservar metadata
    const { data: existingPayment, error: existingPaymentError } = await supabase
      .from('payments')
      .select('*, checkouts(user_id, products(name, description, member_area_link, file_url), form_fields)') // Select all payment fields and join checkouts/products
      .eq('mp_payment_id', mp_payment_id.toString())
      .maybeSingle();
    
    if (existingPaymentError) {
      console.error('VERIFY_MP_DEBUG: Erro ao buscar pagamento existente:', existingPaymentError);
    }
    console.log('VERIFY_MP_DEBUG: Pagamento existente no DB:', JSON.stringify(existingPayment, null, 2));

    // Atualizar pagamento
    const calcStatus = status === 'approved' ? 'completed' : (status === 'rejected' ? 'failed' : 'pending');
    const { data: payment, error: updateError } = await supabase
      .from('payments')
      .update({
        mp_payment_status: status,
        status: calcStatus,
        metadata: {
          ...(existingPayment?.metadata || {}),
          mp_verify_data: mpPayment,
        }
      })
      .eq('mp_payment_id', mp_payment_id.toString())
      .select(`
        *,
        checkouts (
          *,
          products (*)
        )
      `) // Select payment, then join checkouts and products
      .single();

    if (updateError) {
      console.error('VERIFY_MP_DEBUG: Erro ao atualizar pagamento no DB:', updateError);
      return new Response(JSON.stringify({ success: false, error: 'Falha ao atualizar pagamento' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
    }
    console.log('VERIFY_MP_DEBUG: Pagamento atualizado no DB:', JSON.stringify(payment, null, 2));

    // Se aprovado, garantir criação de order e acesso (idempotente)
    if (status === 'approved') {
      console.log('VERIFY_MP_DEBUG: Pagamento aprovado, iniciando pós-processamento.');
      try {
        const checkoutId = mpPayment.external_reference || existingPayment?.checkout_id || (existingPayment?.metadata as any)?.checkout_id;
        console.log('VERIFY_MP_DEBUG: Checkout ID para pós-processamento:', checkoutId);

        // Get all purchased product IDs from payment metadata (set by create-mercado-pago-payment)
        const purchasedProductIds: string[] = (payment?.metadata as any)?.purchased_product_ids || [];
        console.log('VERIFY_MP_DEBUG: All purchased product IDs from payment metadata:', purchasedProductIds);

        // Resolver usuário por email
        const email = existingPayment?.metadata?.customer_data?.email || mpPayment?.payer?.email || null;
        let userId: string | null = existingPayment?.user_id || null;
        console.log('VERIFY_MP_DEBUG: Email do cliente:', email, 'User ID existente:', userId);

        if (!userId && email) {
          // Basic email validation before attempting to create user
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!email || !emailRegex.test(email)) {
              console.error('VERIFY_MP_DEBUG: ERROR: Email inválido para criação de usuário:', email);
              // Continue without userId, as payment might still be valid
          } else {
              // Tentar encontrar o perfil existente pelo email
              const { data: profileRow, error: profileError } = await supabase
                .from('profiles')
                .select('user_id')
                .eq('email', email)
                .maybeSingle();

              if (profileError) {
                console.error('VERIFY_MP_DEBUG: Erro ao buscar perfil por email:', profileError);
              }

              if (profileRow?.user_id) {
                userId = profileRow.user_id;
                console.log('VERIFY_MP_DEBUG: Perfil encontrado, userId:', userId);
              } else {
                // Se não encontrar perfil, vamos tentar criar o usuário via Edge Function create-member-user
                console.log('VERIFY_MP_DEBUG: Perfil não encontrado, tentando criar novo usuário via create-member-user...');

                // Determinar um memberAreaId e módulos a partir dos produtos comprados para passar à função de criação
                let firstMemberAreaId: string | null = null;
                let firstSelectedModules: string[] = [];
                try {
                  const { data: memberAreasData, error: memberAreasError } = await supabase
                    .from('member_areas')
                    .select('id')
                    .overlaps('associated_products', purchasedProductIds || []);

                  if (memberAreasError) {
                    console.error('VERIFY_MP_DEBUG: Erro ao buscar member_areas antes da criação de usuário:', memberAreasError);
                  }
                  if (memberAreasData && memberAreasData.length > 0) {
                    firstMemberAreaId = memberAreasData[0].id;
                    // Buscar módulos publicados para essa área
                    const { data: modulesForArea, error: modulesErr } = await supabase
                      .from('modules')
                      .select('id')
                      .eq('member_area_id', firstMemberAreaId)
                      .eq('status', 'published');
                    if (!modulesErr && modulesForArea) firstSelectedModules = modulesForArea.map((m: any) => m.id);
                  }
                } catch (e) {
                  console.error('VERIFY_MP_DEBUG: exceção ao buscar member areas/modules antes da criação:', e);
                }

                // Gerar uma senha aleatória para o usuário
                // Buscar senha padrão das configurações da área de membros, se existir
                let generatedPassword = Math.random().toString(36).slice(-8);
                if (firstMemberAreaId) {
                  const { data: settingsConfig, error: settingsConfigErr } = await supabase
                    .from('member_settings')
                    .select('default_fixed_password')
                    .eq('member_area_id', firstMemberAreaId)
                    .maybeSingle();
                  if (!settingsConfigErr && settingsConfig?.default_fixed_password) {
                    generatedPassword = settingsConfig.default_fixed_password;
                    console.log('VERIFY_MP_DEBUG: Senha fixa carregada de member_settings:', generatedPassword);
                  } else if (settingsConfigErr) {
                    console.error('VERIFY_MP_DEBUG: Erro ao buscar configurações de senha:', settingsConfigErr);
                  }
                }

                try {
                  const { data: createRes, error: createErr } = await supabase.functions.invoke('create-member-user', {
                    body: {
                      name: existingPayment?.metadata?.customer_data?.name || mpPayment?.payer?.first_name || 'Cliente',
                      email,
                      password: generatedPassword,
                      memberAreaId: firstMemberAreaId,
                      selectedModules: firstSelectedModules,
                      isActive: true
                    }
                  });

                  if (createErr) {
                    console.error('VERIFY_MP_DEBUG: create-member-user retornou erro:', createErr);
                    // Se retorno indicar conflito (e-mail já existe), tentar buscar profile novamente
                    const { data: pRow, error: pErr } = await supabase
                      .from('profiles')
                      .select('user_id')
                      .eq('email', email)
                      .maybeSingle();
                    if (pErr) console.error('VERIFY_MP_DEBUG: Erro ao re-buscar profile após falha na criação:', pErr);
                    userId = pRow?.user_id || null;
                  } else {
                    userId = createRes?.userId || (createRes && createRes.userId) || null;
                    console.log('VERIFY_MP_DEBUG: create-member-user sucesso, userId:', userId);
                  }
                } catch (invokeErr) {
                  console.error('VERIFY_MP_DEBUG: exceção ao invocar create-member-user:', invokeErr);
                  // Fallback: tentar criar via admin.createUser
                  try {
                    const { data: newUserAuth, error: userAuthErr } = await supabase.auth.admin.createUser({
                      email,
                      password: generatedPassword,
                      email_confirm: true,
                      user_metadata: {
                        name: existingPayment?.metadata?.customer_data?.name || mpPayment?.payer?.first_name || 'Cliente'
                      }
                    });
                    if (!userAuthErr) {
                      userId = newUserAuth?.user?.id || null;
                      console.log('VERIFY_MP_DEBUG: Fallback admin.createUser sucesso, userId:', userId);
                    } else {
                      console.error('VERIFY_MP_DEBUG: Fallback admin.createUser falhou:', userAuthErr);
                    }
                  } catch (e2) {
                    console.error('VERIFY_MP_DEBUG: exceção no fallback admin.createUser:', e2);
                  }
                }
              }
          }
        }

        console.log('VERIFY_MP_DEBUG: Payment object before user_id update check:', JSON.stringify(payment, null, 2));
        // Update payment user_id if a userId was resolved/created and payment exists and user_id is not already set
        if (userId && payment?.id && !payment?.user_id) { 
          const { error: payUserErr } = await supabase.from('payments').update({ user_id: userId }).eq('id', payment.id);
          if (payUserErr) console.error('VERIFY_MP_DEBUG: Erro ao atualizar payment user_id:', payUserErr);
          else console.log('VERIFY_MP_DEBUG: Payment user_id atualizado para:', userId);
        }

        // Loop through all purchased product IDs to create orders and access records
        for (const productId of purchasedProductIds) {
          console.log('VERIFY_MP_DEBUG: Processing purchased product ID:', productId);

          // Criar ordem (idempotente) - SOMENTE SE userId E productId ESTIVEREM DISPONÍVEIS
          if (userId && productId) {
              const { data: existingOrder, error: orderExistsError } = await supabase
                  .from('orders')
                  .select('id')
                  .eq('mp_payment_id', mp_payment_id.toString())
                  .eq('product_id', productId) // Ensure uniqueness per product
                  .maybeSingle();
              
              if (orderExistsError) console.error('VERIFY_MP_DEBUG: Erro ao buscar ordem existente para produto:', productId, orderExistsError);

              if (!existingOrder) {
                  const { data: orderIns, error: orderErr } = await supabase
                      .from('orders')
                      .insert({
                          mp_payment_id: mp_payment_id.toString(),
                          payment_id: payment?.id || null,
                          checkout_id: checkoutId || null,
                          user_id: userId,
                          product_id: productId,
                          amount: payment?.amount || (mpPayment.transaction_amount ? Math.round(Number(mpPayment.transaction_amount) * 100) : 0),
                          status: 'paid',
                          metadata: {
                              mp_status: status,
                              source: 'manual-verify'
                          }
                      })
                      .select('id')
                      .single();
                  if (orderErr) console.error('VERIFY_MP_DEBUG: Erro ao inserir ordem para produto:', productId, orderErr);
                  else console.log('VERIFY_MP_DEBUG: Ordem criada para produto:', productId, orderIns);
              } else {
                  console.log('VERIFY_MP_DEBUG: Ordem já existe para este mp_payment_id e produto:', productId, existingOrder.id);
              }
          } else {
              console.log('VERIFY_MP_DEBUG: Pulando criação de ordem para produto:', productId, 'userId ou productId ausente. userId:', userId);
          }


          // Garantir acesso ao produto (idempotente) - SOMENTE SE userId E productId ESTIVEREM DISPONÍVEIS
          if (userId && productId) {
              const { data: existingAccess, error: accessExistsError } = await supabase
                  .from('product_access')
                  .select('id')
                  .eq('user_id', userId)
                  .eq('product_id', productId)
                  .maybeSingle();
              
              if (accessExistsError) console.error('VERIFY_MP_DEBUG: Erro ao buscar acesso existente para produto:', productId, accessExistsError);

              if (!existingAccess) {
                  const { data: accessIns, error: accessErr } = await supabase
                      .from('product_access')
                      .insert({
                          user_id: userId,
                          product_id: productId,
                          payment_id: payment?.id || null,
                          source: 'purchase'
                      })
                      .select('id')
                      .single();
                  if (accessErr) console.error('VERIFY_MP_DEBUG: Erro ao criar acesso ao produto:', accessErr);
                  else console.log('VERIFY_MP_DEBUG: Acesso ao produto concedido para produto:', productId, accessIns);
              } else {
                  console.log('VERIFY_MP_DEBUG: Acesso ao produto já existe para produto:', productId, existingAccess.id);
              }
          } else {
              console.log('VERIFY_MP_DEBUG: Pulando criação de acesso ao produto para produto:', productId, 'userId ou productId ausente. userId:', userId);
          }
        } // End of for loop for purchasedProductIds

        // --- NOVO: Lógica para conceder acesso a módulos da área de membros ---
        if (userId && purchasedProductIds.length > 0) {
          console.log('VERIFY_MP_DEBUG: Iniciando lógica de acesso a módulos da área de membros para userId:', userId);
          
          // 1. Encontrar todas as áreas de membros que associam qualquer um dos produtos comprados
          const { data: memberAreasData, error: memberAreasError } = await supabase
            .from('member_areas')
            .select('id, user_id') // Selecionar id e user_id da área de membros
            .overlaps('associated_products', purchasedProductIds); // Usa o operador @> para verificar se o array contém qualquer um dos IDs

          if (memberAreasError) {
            console.error('VERIFY_MP_DEBUG: Erro ao buscar áreas de membros associadas:', memberAreasError);
          } else if (memberAreasData && memberAreasData.length > 0) {
            console.log('VERIFY_MP_DEBUG: Áreas de membros associadas encontradas:', memberAreasData.map(ma => ma.id));

            for (const memberArea of memberAreasData) {
              // 2. Para cada área de membros, buscar todos os módulos publicados
              const { data: modulesData, error: modulesError } = await supabase
                .from('modules')
                .select('id')
                .eq('member_area_id', memberArea.id)
                .eq('status', 'published');

              if (modulesError) {
                console.error(`VERIFY_MP_DEBUG: Erro ao buscar módulos publicados para a área ${memberArea.id}:`, modulesError);
              } else if (modulesData && modulesData.length > 0) {
                console.log(`VERIFY_MP_DEBUG: Módulos publicados encontrados para a área ${memberArea.id}:`, modulesData.map(m => m.id));

                // 3. Conceder acesso a cada módulo para o usuário
                const accessInserts = modulesData.map(module => ({
                  user_id: userId,
                  module_id: module.id,
                  is_active: true,
                  member_area_id: memberArea.id,
                }));

                if (accessInserts.length > 0) {
                  const { error: insertAccessError } = await supabase
                    .from('member_access')
                    .insert(accessInserts)
                    .onConflict('user_id, module_id') // Garante idempotência
                    .doNothing();

                  if (insertAccessError) {
                    console.error(`VERIFY_MP_DEBUG: Erro ao conceder acesso aos módulos para a área ${memberArea.id}:`, insertAccessError);
                  } else {
                    console.log(`VERIFY_MP_DEBUG: Acesso concedido/atualizado para ${accessInserts.length} módulos na área ${memberArea.id} para o usuário ${userId}.`);
                  }
                }
              }
            }
          } else {
            console.log('VERIFY_MP_DEBUG: Nenhum área de membros associada aos produtos comprados.');
          }
        }
        // --- FIM NOVO: Lógica para conceder acesso a módulos da área de membros ---


        // --- Lógica de envio de e-mail transacional (após aprovação) ---
        const emailTransactionalData = (payment?.metadata as any)?.email_transactional_data;
        console.log('VERIFY_MP_DEBUG: emailTransactionalData do payment metadata:', JSON.stringify(emailTransactionalData, null, 2));

        if (emailTransactionalData?.sendTransactionalEmail && emailTransactionalData?.sellerUserId) {
          console.log('VERIFY_MP_DEBUG: Disparando e-mail transacional...');
          
          const productName = emailTransactionalData.productName || payment.checkouts?.products?.name || 'Seu Produto';
          const customerName = (existingPayment?.metadata?.customer_data?.name || mpPayment?.payer?.first_name || 'Cliente');
          const customerEmail = (existingPayment?.metadata?.customer_data?.email || mpPayment?.payer?.email || null);
          const supportEmail = emailTransactionalData.supportEmail || 'suporte@elyondigital.com'; // Default support email

          // Priorizar o link do entregável do checkout, depois do produto
          const accessLink = 
            emailTransactionalData.deliverableLink || 
            payment.checkouts?.products?.member_area_link || 
            payment.checkouts?.products?.file_url || 
            ''; // Fallback para string vazia

          const emailSubjectTemplate = emailTransactionalData.transactionalEmailSubject || 'Seu acesso ao produto Elyon Digital!';
          const emailBodyTemplate = emailTransactionalData.transactionalEmailBody || 'Olá {customer_name},\n\nObrigado por sua compra! Seu acesso ao produto "{product_name}" está liberado.\n\nAcesse aqui: {access_link}\n\nQualquer dúvida, entre em contato com nosso suporte.\n\nAtenciosamente,\nEquipe Elyon Digital';

          console.log('VERIFY_MP_DEBUG: Template Subject:', emailSubjectTemplate);
          console.log('VERIFY_MP_DEBUG: Template Body:', emailBodyTemplate);
          console.log('VERIFY_MP_DEBUG: Resolved Access Link:', accessLink);
          console.log('VERIFY_MP_DEBUG: Customer Name for Email:', customerName);
          console.log('VERIFY_MP_DEBUG: Product Name for Email:', productName);
          console.log('VERIFY_MP_DEBUG: Support Email for Email:', supportEmail);


          const finalSubject = emailSubjectTemplate
            .replace(/{customer_name}/g, customerName)
            .replace(/{product_name}/g, productName);

          const finalBody = emailBodyTemplate
            .replace(/{customer_name}/g, customerName)
            .replace(/{product_name}/g, productName)
            .replace(/{access_link}/g, accessLink)
            .replace(/{support_email}/g, supportEmail); // Substituição dinâmica aqui

          console.log('VERIFY_MP_DEBUG: Final Subject after replacement:', finalSubject);
          console.log('VERIFY_MP_DEBUG: Final Body after replacement (first 500 chars):', finalBody.substring(0, 500) + '...');


          if (customerEmail) {
            try {
              console.log('VERIFY_MP_DEBUG: Invoking send-transactional-email with:', {
                to: customerEmail,
                subject: finalSubject,
                html: finalBody.replace(/\n/g, '<br/>'),
                sellerUserId: emailTransactionalData.sellerUserId,
              });
              const { data: emailSendResult, error: emailSendError } = await supabase.functions.invoke(
                'send-transactional-email',
                {
                  body: {
                    to: customerEmail,
                    subject: finalSubject,
                    html: finalBody.replace(/\n/g, '<br/>'), // Converter quebras de linha para HTML
                    sellerUserId: emailTransactionalData.sellerUserId,
                  }
                }
              );

              if (emailSendError) {
                console.error('VERIFY_MP_DEBUG: Erro ao invocar send-transactional-email:', emailSendError);
              } else if (!emailSendResult?.success) {
                console.error('VERIFY_MP_DEBUG: Falha no envio do e-mail transacional:', emailSendResult?.error);
              } else {
                console.log('VERIFY_MP_DEBUG: E-mail transacional disparado com sucesso para:', customerEmail);
              }
            } catch (invokeError) {
              console.error('VERIFY_MP_DEBUG: Exceção ao invocar send-transactional-email:', invokeError);
            }
          } else {
            console.warn('VERIFY_MP_DEBUG: Não foi possível enviar e-mail transacional: email do cliente ausente.');
          }
        } else {
          console.log('VERIFY_MP_DEBUG: Envio de e-mail transacional desabilitado ou dados incompletos no metadata. emailTransactionalData:', JSON.stringify(emailTransactionalData, null, 2));
        }
        // --- Fim da lógica de envio de e-mail transacional ---

      } catch (postProcessErr) {
        console.error('VERIFY_MP_DEBUG: Erro no pós-processamento (após aprovação):', postProcessErr);
      }
    }

    return new Response(JSON.stringify({ success: true, status: status, status_detail: mpPayment.status_detail, payment }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
  } catch (error) {
    console.error('VERIFY_MP_DEBUG: Erro geral na função verify-mercado-pago-payment:', error);
    return new Response(JSON.stringify({ success: false, error: error.message || 'Erro interno do servidor' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
});