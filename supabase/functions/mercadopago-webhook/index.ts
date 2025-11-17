import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'; // Updated to 2.45.0 for consistency

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-signature, x-request-id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface MercadoPagoWebhook {
  action: string; // "payment.created", "payment.updated"
  api_version: string;
  data: {
    id: string; // ID do pagamento
  };
  date_created: string;
  id: number;
  live_mode: boolean;
  type: string; // "payment"
  user_id: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders, status: 200 });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { 
      status: 405, 
      headers: corsHeaders 
    });
  }

  try {
    console.log('🔔 WEBHOOK_DEBUG: Webhook recebido do Mercado Pago');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Pegar corpo do webhook
    const body = await req.text();
    console.log('WEBHOOK_DEBUG: Raw body:', body);
    const webhook: MercadoPagoWebhook = JSON.parse(body);
    console.log('WEBHOOK_DEBUG: Parsed webhook event:', { type: webhook.type, action: webhook.action, paymentId: webhook.data?.id });

    // Validar assinatura (IMPORTANTE PARA SEGURANÇA)
    const signature = req.headers.get('x-signature');
    const requestId = req.headers.get('x-request-id');
    
    // validateWebhookSignature is now async
    if (!(await validateWebhookSignature(body, signature, requestId))) {
      console.error('❌ Assinatura do webhook inválida');
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }

    console.log('✅ Webhook validado:', webhook.type, webhook.action);

    // Processar apenas eventos de pagamento
    if (webhook.type !== 'payment') {
      console.log('ℹ️ Tipo de evento ignorado:', webhook.type);
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Buscar detalhes do pagamento na API do Mercado Pago
    const paymentId = webhook.data.id;
    console.log('WEBHOOK_DEBUG: Buscando detalhes do pagamento na API MP:', paymentId);
    const paymentDetails = await fetchPaymentDetails(paymentId);

    console.log('WEBHOOK_DEBUG: Payment details retrieved:', {
      id: paymentDetails.id,
      status: paymentDetails.status,
      email: paymentDetails.payer?.email,
      external_reference: paymentDetails.external_reference,
      transaction_amount: paymentDetails.transaction_amount,
      payment_type_id: paymentDetails.payment_type_id
    });

    // Verificar se pagamento foi aprovado
    if (paymentDetails.status === 'approved') {
      console.log('✅ WEBHOOK_DEBUG: Payment approved! Status:', paymentDetails.status);
      console.log('WEBHOOK_DEBUG: Calling processApprovedPayment...');
      await processApprovedPayment(supabase, paymentDetails, webhook);
    } else {
      console.log('⏳ WEBHOOK_DEBUG: Payment not yet approved. Status:', paymentDetails.status);
      
      // Registrar compra mesmo se não aprovada
      await registerPurchase(supabase, paymentDetails, webhook);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Erro no webhook:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

// Validar assinatura HMAC do Mercado Pago usando Deno's native crypto.subtle
async function validateWebhookSignature(
  body: string, 
  signature: string | null, 
  requestId: string | null
): Promise<boolean> {
  // Em desenvolvimento, você pode desabilitar a validação retornando true.
  // EM PRODUÇÃO, SEMPRE RETORNE false SE A ASSINATURA NÃO FOR VÁLIDA.
  if (!signature || !requestId) {
    console.warn('⚠️ Webhook sem assinatura - validação desabilitada em desenvolvimento. EM PRODUÇÃO, ISSO SERIA UM ERRO.');
    return true; 
  }

  const secret = Deno.env.get('MERCADOPAGO_WEBHOOK_SECRET');
  if (!secret) {
    console.error('❌ MERCADOPAGO_WEBHOOK_SECRET não configurado. Validação falhou.');
    return false;
  }

  // Extrair partes da assinatura: ts=timestamp,v1=hash
  const parts = signature.split(',');
  const ts = parts.find(p => p.startsWith('ts='))?.split('=')[1];
  const hash = parts.find(p => p.startsWith('v1='))?.split('=')[1];

  if (!ts || !hash) return false;

  // Montar string para validação
  const manifest = `id:${requestId};request-id:${requestId};ts:${ts};`;
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const manifestData = encoder.encode(manifest);

  try {
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signatureBuffer = await crypto.subtle.sign('HMAC', key, manifestData);
    const expectedHash = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    return hash === expectedHash;
  } catch (e) {
    console.error('Erro ao validar assinatura HMAC:', e);
    return false;
  }
}

// Buscar detalhes do pagamento na API do Mercado Pago
async function fetchPaymentDetails(paymentId: string): Promise<any> {
  const accessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
  
  if (!accessToken) {
    throw new Error('MERCADOPAGO_ACCESS_TOKEN não configurado');
  }

  const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    const errorBody = await response.json();
    console.error('Erro ao buscar pagamento no MP:', errorBody);
    throw new Error(`Erro ao buscar pagamento: ${response.statusText} - ${errorBody.message || 'Detalhes desconhecidos'}`);
  }

  return await response.json();
}

// Processar pagamento aprovado
async function processApprovedPayment(
  supabase: any,
  paymentDetails: any,
  webhook: MercadoPagoWebhook
): Promise<void> {
  const paymentId = paymentDetails.id.toString();
  
  // Verificar se já processamos este pagamento
  const { data: existingPurchase } = await supabase
    .from('compras')
    .select('id, entregavel_enviado')
    .eq('mercadopago_payment_id', paymentId)
    .maybeSingle();

  if (existingPurchase?.entregavel_enviado) {
    console.log('ℹ️ Entregável já enviado para este pagamento');
    return;
  }

  // Extrair dados do cliente e produto
  const clienteEmail = paymentDetails.payer.email;
  const clienteNome = paymentDetails.additional_info?.payer?.first_name + ' ' + 
                      paymentDetails.additional_info?.payer?.last_name || paymentDetails.payer.first_name + ' ' + paymentDetails.payer.last_name || 'Cliente';
  const clienteTelefone = paymentDetails.payer.phone?.number;
  const clienteDocumento = paymentDetails.payer.identification?.number;

  console.log('👤 WEBHOOK_DEBUG: Dados do cliente extraídos:', {
    email: clienteEmail,
    nome: clienteNome,
    telefone: clienteTelefone,
    documento: clienteDocumento
  });

  // Identificar produto (via external_reference do pagamento)
  const produtoId = paymentDetails.external_reference; // UUID do produto passado no checkout
  console.log('🛍️ WEBHOOK_DEBUG: Product ID extraído da external_reference:', produtoId);

  // Buscar produto no banco
  let produto = null;
  let sellerUserId: string | null = null; // Para usar no send-transactional-email
  
  if (produtoId) {
    const { data: produtoData, error: produtoError } = await supabase
      .from('products')
      .select('*')
      .eq('id', produtoId)
      .maybeSingle();

    if (produtoError) {
      console.error('❌ Erro ao buscar produto em products:', produtoError);
    }

    // Normalizar campos para compatibilidade com o restante do código
    if (produtoData) {
      produto = {
        id: produtoData.id,
        nome: produtoData.name || produtoData.nome || 'Produto',
        description: produtoData.description || produtoData.descricao || '',
        member_area_id: produtoData.member_area_id || null,
        user_id: produtoData.user_id || null, // ID do vendedor (proprietário do produto)
        email_template: produtoData.email_template || '',
        email_assunto: produtoData.email_subject || produtoData.email_assunto || `Seu acesso ao ${produtoData.name || 'produto'}`,
        url_acesso: produtoData.access_url || produtoData.member_area_link || produtoData.access_link || '',
        arquivo_url: produtoData.file_url || produtoData.arquivo_url || '',
        instrucoes_acesso: produtoData.instructions || produtoData.instrucoes_acesso || '',
        gerar_credenciais: produtoData.generate_credentials || produtoData.gerar_credenciais || false,
        prazo_acesso: produtoData.access_duration_days || produtoData.prazo_acesso || null
      };
      sellerUserId = produtoData.user_id || null;
    } else {
      produto = null;
    }
  }
  let skipMemberProvision = false;
  if (!produto) {
    console.error('❌ Produto não encontrado ou inativo:', produtoId);
    // Não interromper o fluxo: registrar que não foi possível provisionar membro
    skipMemberProvision = true;
  }

  // Se não encontrou o user_id no produto, tentar buscar pela member_area
  if (!sellerUserId && produto.member_area_id) {
    const { data: memberArea, error: memberAreaError } = await supabase
      .from('member_areas')
      .select('user_id')
      .eq('id', produto.member_area_id)
      .maybeSingle();

    if (memberArea?.user_id) {
      sellerUserId = memberArea.user_id;
    }
  }

  // Gerar credenciais se necessário
  let username = null;
  let password = null;
  if (produto.gerar_credenciais) {
    username = clienteEmail;
    password = generateSecurePassword(12);
  }

  // Calcular data de expiração
  let acessoExpiraEm = null;
  if (produto.prazo_acesso) {
    const dataExpiracao = new Date();
    dataExpiracao.setDate(dataExpiracao.getDate() + produto.prazo_acesso);
    acessoExpiraEm = dataExpiracao.toISOString();
  }

  // Registrar compra no banco
  const { data: compra, error: compraError } = await supabase
    .from('compras')
    .upsert({
      mercadopago_payment_id: paymentId,
      mercadopago_order_id: paymentDetails.order?.id,
      produto_id: produto.id,
      cliente_nome: clienteNome,
      cliente_email: clienteEmail,
      cliente_telefone: clienteTelefone,
      cliente_documento: clienteDocumento,
      valor_pago: paymentDetails.transaction_amount,
      moeda: paymentDetails.currency_id,
      metodo_pagamento: paymentDetails.payment_type_id,
      status_pagamento: 'approved',
      username: username,
      password: password,
      acesso_expira_em: acessoExpiraEm,
      webhook_payload: webhook,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'mercadopago_payment_id'
    })
    .select()
    .single();

  if (compraError) {
    console.error('❌ Erro ao registrar compra:', compraError);
    throw compraError;
  }

  console.log('💾 Compra registrada:', compra.id);

  // Criar membro automaticamente após pagamento aprovado (NOVO FLUXO CENTRALIZADO)
  try {
    if (skipMemberProvision) {
      console.warn('🚫 CREATE_MEMBER_FROM_PAYMENT: Pulando provisionamento - produto/associação não encontrada. compra_id:', compra.id);
    } else {
      console.log('🎯 CREATE_MEMBER_FROM_PAYMENT: Iniciando criação automática via create-member-from-payment');
      
      const { data: createRes, error: createErr } = await supabase.functions.invoke('create-member-from-payment', {
        body: {
          email: clienteEmail,
          name: clienteNome,
          product_id: produto.id,
          payment_id: paymentId,
          checkout_id: paymentDetails.external_reference
        }
      });

      if (createErr) {
        console.error('❌ CREATE_MEMBER_FROM_PAYMENT: Erro ao invocar função:', createErr);
      } else if (createRes?.success) {
        console.log('✅ CREATE_MEMBER_FROM_PAYMENT: Membro criado com sucesso!', {
          memberId: createRes.memberId,
          userId: createRes.userId,
          email: createRes.email,
          memberAreaId: createRes.memberAreaId,
          message: createRes.message
        });
        compra.memberPassword = createRes.password || null;
      } else {
        console.error('❌ CREATE_MEMBER_FROM_PAYMENT: Falha ao criar membro:', createRes?.error);
      }
    }
  } catch (memberErr) {
    console.error('❌ CREATE_MEMBER_FROM_PAYMENT: Exceção no fluxo:', memberErr);
  }

  // Enviar email com entregável
  await sendDeliverableEmail(supabase, compra, produto, sellerUserId);
}

// Registrar compra (mesmo se não aprovada)
async function registerPurchase(
  supabase: any,
  paymentDetails: any,
  webhook: MercadoPagoWebhook
): Promise<void> {
  const paymentId = paymentDetails.id.toString();
  
  await supabase
    .from('compras')
    .upsert({
      mercadopago_payment_id: paymentId,
      mercadopago_order_id: paymentDetails.order?.id,
      cliente_nome: paymentDetails.additional_info?.payer?.first_name || paymentDetails.payer.first_name || 'Cliente',
      cliente_email: paymentDetails.payer.email,
      valor_pago: paymentDetails.transaction_amount,
      moeda: paymentDetails.currency_id,
      status_pagamento: paymentDetails.status,
      webhook_payload: webhook,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'mercadopago_payment_id'
    });
}

// Enviar email com entregável e senha de membro
async function sendDeliverableEmail(
  supabase: any,
  compra: any,
  produto: any,
  sellerUserId: string | null
): Promise<void> {
  console.log('📧 Enviando email de entrega para:', compra.cliente_email);

  try {
    // Se não temos o sellerUserId, não podemos usar send-transactional-email
    if (!sellerUserId) {
      console.warn('⚠️ Vendedor não identificado, email não será enviado. Certifique-se de que o produto possui user_id ou está associado a uma member_area com user_id.');
      return;
    }

    // Preparar corpo do email com a senha do membro
    const emailSubject = produto.email_assunto || `Bem-vindo ao ${produto.nome}!`;
    let emailBody = '';

    if (compra.memberPassword) {
      // Se o membro foi criado, enviar email com credenciais de acesso
      emailBody = `
        <h2>Bem-vindo, ${compra.cliente_nome}!</h2>
        <p>Sua compra foi confirmada com sucesso! 🎉</p>
        
        <h3>Suas Credenciais de Acesso:</h3>
        <p>
          <strong>Email:</strong> ${compra.cliente_email}<br>
          <strong>Senha:</strong> <code style="background: #f0f0f0; padding: 5px 10px; font-family: monospace;">${compra.memberPassword}</code>
        </p>
        
        <p><a href="${produto.url_acesso || '#'}" style="display: inline-block; padding: 10px 20px; background: #3b82f6; color: white; text-decoration: none; border-radius: 5px;">Acessar Área de Membros</a></p>
        
        <hr>
        <p><strong>Produto:</strong> ${produto.nome}</p>
        ${produto.instrucoes_acesso ? `<p><strong>Instruções:</strong> ${produto.instrucoes_acesso}</p>` : ''}
        
        <p>Qualquer dúvida, entre em contato conosco!</p>
      `;
    } else {
      // Se não foi criado membro (produto normal), usar template antigo
      emailBody = produto.email_template
        .replace(/{{nome}}/g, compra.cliente_nome)
        .replace(/{{produto}}/g, produto.nome)
        .replace(/{{email}}/g, compra.cliente_email)
        .replace(/{{username}}/g, compra.username || compra.cliente_email)
        .replace(/{{password}}/g, compra.password || 'N/A')
        .replace(/{{url_acesso}}/g, produto.url_acesso || '#')
        .replace(/{{arquivo_url}}/g, produto.arquivo_url || '#')
        .replace(/{{instrucoes}}/g, produto.instrucoes_acesso || '');
    }

    // Chamar função de envio de email transacional
    const { data: emailResult, error: emailError } = await supabase.functions.invoke('send-transactional-email', {
      body: {
        to: compra.cliente_email,
        subject: emailSubject,
        html: emailBody,
        text: emailBody.replace(/<[^>]*>/g, ''), // Versão em texto puro
        sellerUserId: sellerUserId
      }
    });

    if (emailError) {
      throw new Error(`Erro ao invocar send-transactional-email: ${emailError.message}`);
    }
    if (!emailResult?.success) {
      throw new Error(`Falha no envio de email via send-transactional-email: ${emailResult?.error || 'Erro desconhecido'}`);
    }

    console.log('✅ Email enviado com sucesso');

    // Atualizar compra como entregue
    await supabase
      .from('compras')
      .update({
        entregavel_enviado: true,
        entregavel_enviado_em: new Date().toISOString(),
        email_entrega_id: emailResult.messageId // Assumindo que a função retorna um messageId
      })
      .eq('id', compra.id);

    // Registrar log de entrega
    await supabase
      .from('logs_entrega')
      .insert({
        compra_id: compra.id,
        tipo: 'email',
        status: 'enviado',
        destinatario: compra.cliente_email,
        assunto: emailSubject
      });

  } catch (error: any) {
    console.error('❌ Erro ao enviar email:', error);

    // Registrar falha no log
    await supabase
      .from('logs_entrega')
      .insert({
        compra_id: compra.id,
        tipo: 'email',
        status: 'falhou',
        destinatario: compra.cliente_email,
        assunto: compra.email_assunto,
        erro_mensagem: error.message
      });

    throw error;
  }
}

// Gerar senha segura
function generateSecurePassword(length: number): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  let password = '';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  
  for (let i = 0; i < length; i++) {
    password += chars[array[i] % chars.length];
  }
  
  return password;
}

serve(handler);