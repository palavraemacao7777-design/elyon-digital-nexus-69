import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"; // Corrected: Added 'from' keyword

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Definindo a interface PaymentRequest para a função Edge
interface PaymentRequest {
  checkoutId: string;
  amount: number; // Valor em centavos
  customerData: {
    name: string;
    email: string;
    phone?: string;
    cpf?: string;
  };
  selectedMercadoPagoAccount?: string;
  orderBumps?: any[]; // Pode ser mais específico se tivermos a estrutura
  selectedPackage?: number;
  paymentMethod: string;
  // finalProductId?: string; // Removed: now using purchasedProductIds array
  purchasedProductIds: string[]; // NEW: Array of all product IDs being purchased
  cardData?: {
    cardNumber?: string;
    cardholderName: string;
    expirationMonth: string;
    expirationYear: string;
    securityCode: string;
    installments: number;
  };
  cardToken?: string; // Token gerado no frontend, se aplicável
  emailMetadata?: { // Novo campo para dados de e-mail transacional
    sendTransactionalEmail: boolean;
    transactionalEmailSubject?: string;
    transactionalEmailBody?: string;
    deliverableLink?: string | null;
    productName?: string;
    productDescription?: string;
    sellerUserId?: string;
    supportEmail?: string;
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders, status: 200 }); // Explicitly set status 200
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const requestBody = await req.json();
    console.log('CREATE_MP_PAYMENT_DEBUG: 1. Raw request body received:', JSON.stringify(requestBody, null, 2));

    // Desestruturar com a interface definida
    const { checkoutId, amount, customerData, selectedMercadoPagoAccount, orderBumps, selectedPackage, paymentMethod, purchasedProductIds, cardData, cardToken, emailMetadata }: PaymentRequest = requestBody;

    console.log('CREATE_MP_PAYMENT_DEBUG: 2. Raw amount received from requestBody:', amount, typeof amount);
    console.log('CREATE_MP_PAYMENT_DEBUG: 2.1. emailMetadata.sendTransactionalEmail (from frontend):', emailMetadata?.sendTransactionalEmail);
    console.log('CREATE_MP_PAYMENT_DEBUG: 2.2. emailMetadata.sellerUserId (from frontend):', emailMetadata?.sellerUserId);
    console.log('CREATE_MP_PAYMENT_DEBUG: 2.3. purchasedProductIds (from frontend):', purchasedProductIds);
    console.log('CREATE_MP_PAYMENT_DEBUG: 2.4. checkoutId received:', checkoutId);

    // Validar se checkoutId é válido (não é "preview")
    if (checkoutId === 'preview') {
      console.error('CREATE_MP_PAYMENT_DEBUG: 5.0. Preview checkout detected - cannot process payment in preview mode');
      return new Response(
        JSON.stringify({ success: false, error: 'Não é possível processar pagamentos no modo preview. Por favor, use um checkout publicado.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }


    // Aplicar a conversão robusta sugerida para o 'amount' (que está em centavos)
    const numericAmountInCents = Number((amount || 0).toString().replace(",", "."));
    console.log('CREATE_MP_PAYMENT_DEBUG: 3. numericAmountInCents after robust conversion:', numericAmountInCents, typeof numericAmountInCents);

    if (isNaN(numericAmountInCents) || numericAmountInCents <= 0) {
      console.error('CREATE_MP_PAYMENT_DEBUG: ERROR: Invalid numericAmountInCents after robust conversion:', numericAmountInCents, 'from raw:', amount);
      return new Response(
        JSON.stringify({ success: false, error: 'Valor do pagamento inválido ou ausente. O valor deve ser um número positivo.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Converter para reais e garantir duas casas decimais
    const transactionAmountInReais = parseFloat((numericAmountInCents / 100).toFixed(2));
    console.log('CREATE_MP_PAYMENT_DEBUG: 4. transactionAmountInReais after final formatting (float):', transactionAmountInReais, typeof transactionAmountInReais);

    if (isNaN(transactionAmountInReais) || transactionAmountInReais <= 0) {
      console.error('CREATE_MP_PAYMENT_DEBUG: ERROR: Invalid transaction_amount detected after final formatting:', transactionAmountInReais);
      return new Response(
        JSON.stringify({ success: false, error: 'Valor inválido ou ausente para transaction_amount. O valor deve ser um número positivo.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Get the checkout to find the selected Mercado Pago account and member_area_id
    const { data: checkout, error: checkoutError } = await supabase
      .from('checkouts')
      .select('id, user_id, member_area_id, integrations, form_fields, products(name, member_area_link, file_url)') // Include member_area_id
      .eq('id', checkoutId)
      .single();

    console.log('CREATE_MP_PAYMENT_DEBUG: 5. Checkout data from DB:', checkout);

    if (checkoutError || !checkout) {
      console.error('CREATE_MP_PAYMENT_DEBUG: 5.1. Checkout error:', checkoutError);
      return new Response(
        JSON.stringify({ success: false, error: 'Checkout não encontrado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Buscar as configurações do Mercado Pago da tabela integrations
    const { data: mpConfig, error: mpConfigError } = await supabase
      .from('integrations')
      .select('mercado_pago_access_token, mercado_pago_token_public')
      .eq('user_id', checkout.user_id)
      .maybeSingle();

    console.log('CREATE_MP_PAYMENT_DEBUG: 6. MP Config from database:', { mpConfig, mpConfigError });

    // Priorize a variável de ambiente se existir, caso contrário, use a do banco de dados
    const accessToken = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN') || (mpConfig?.mercado_pago_access_token as string) || '';
    const publicKey = Deno.env.get('MERCADO_PAGO_PUBLIC_KEY') || (mpConfig?.mercado_pago_token_public as string) || '';

    console.log('CREATE_MP_PAYMENT_DEBUG: 7. Access Token (length):', accessToken.length);
    console.log('CREATE_MP_PAYMENT_DEBUG: 8. Public Key (length):', publicKey.length);
    
    if (!accessToken) {
      console.error('CREATE_MP_PAYMENT_DEBUG: 8.1. Access Token is empty or not configured.');
      return new Response(
        JSON.stringify({ success: false, error: 'Token do Mercado Pago não configurado. Configure nas integrações.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }
    
    if (paymentMethod === 'creditCard' && !publicKey) {
      console.error('CREATE_MP_PAYMENT_DEBUG: 8.2. Public Key is empty or not configured for credit card payment.');
      return new Response(
        JSON.stringify({ success: false, error: 'Chave pública do Mercado Pago não configurada. Configure nas integrações.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Construir o body da requisição para o Mercado Pago
    const mpRequestBody: any = {
      transaction_amount: transactionAmountInReais,
      description: `Pagamento Checkout ${checkoutId}`,
      payer: {
        email: customerData.email,
        first_name: customerData.name.split(' ')[0],
        last_name: customerData.name.split(' ').slice(1).join(' ') || '',
        identification: customerData.cpf ? {
          type: 'CPF',
          number: customerData.cpf.replace(/\D/g, '')
        } : undefined
      },
      notification_url: `${supabaseUrl}/functions/v1/mercado-pago-webhook`,
      external_reference: purchasedProductIds && purchasedProductIds.length > 0 ? purchasedProductIds[0] : checkoutId, // Use first product ID
      metadata: {
        customer_data: customerData,
        order_bumps: orderBumps,
        selected_package: selectedPackage,
        payment_method: paymentMethod,
        purchased_product_ids: purchasedProductIds, // NEW: Pass all purchased product IDs
        checkout_id: checkoutId, // Store checkout ID in metadata too
        // Adicionar todos os dados de e-mail transacional e entregável aqui
        email_transactional_data: emailMetadata,
      }
    };

    // Configurar método de pagamento
    if (paymentMethod === 'pix') {
      mpRequestBody.payment_method_id = 'pix';
    } else if (paymentMethod === 'creditCard') {
      mpRequestBody.statement_descriptor = 'CHECKOUT';
      mpRequestBody.capture = true;
      mpRequestBody.binary_mode = true; // força decisão imediata
      mpRequestBody.installments = cardData?.installments || 1;

      mpRequestBody.additional_info = {
        items: [{
          id: checkoutId,
          title: `Pagamento Checkout ${checkoutId}`,
          description: mpRequestBody.description,
          quantity: 1,
          unit_price: mpRequestBody.transaction_amount
        }]
      };

      if (cardToken) {
        console.log('CREATE_MP_PAYMENT_DEBUG: 9. Usando card token recebido do frontend');
        mpRequestBody.token = cardToken;
      } else if (cardData) {
        console.log('CREATE_MP_PAYMENT_DEBUG: 10. Criando card token no backend (fallback)');
        try {
          const tokenResponse = await fetch(`https://api.mercadopago.com/v1/card_tokens?public_key=${publicKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              card_number: cardData.cardNumber?.replace(/\s/g, ''),
              cardholder: {
                name: cardData.cardholderName,
                identification: customerData.cpf ? { type: 'CPF', number: customerData.cpf.replace(/\D/g, '') } : undefined
              },
              expiration_month: cardData.expirationMonth ? Number(cardData.expirationMonth) : undefined,
              expiration_year: cardData.expirationYear ? Number(cardData.expirationYear) : undefined,
              security_code: cardData.securityCode
            })
          });
          const tokenResult = await tokenResponse.json();
          if (!tokenResponse.ok) {
            console.error('CREATE_MP_PAYMENT_DEBUG: 10.1. Card Token Error:', tokenResult);
            return new Response(
              JSON.stringify({ success: false, error: tokenResult.message || 'Erro ao processar dados do cartão' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            );
          }
          mpRequestBody.token = tokenResult.id;
          console.log('CREATE_MP_PAYMENT_DEBUG: 10.2. Card token criado com sucesso');
        } catch (tokenCreationError) {
          console.error('CREATE_MP_PAYMENT_DEBUG: 10.3. Exception during card token creation:', tokenCreationError);
          return new Response(
            JSON.stringify({ success: false, error: `Erro ao criar token do cartão: ${tokenCreationError.message}` }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
          );
        }
      }
    }

    // Verificação de tipo antes da requisição fetch
    console.log("CREATE_MP_PAYMENT_DEBUG: 11. Final mpRequestBody sent to Mercado Pago (excluding token):", { ...mpRequestBody, token: mpRequestBody.token ? '***' : undefined });
    console.log("CREATE_MP_PAYMENT_DEBUG: 12. Final transaction_amount in payload:", mpRequestBody.transaction_amount, typeof mpRequestBody.transaction_amount);

    // Requisição ao endpoint do Mercado Pago
    const apiUrl = 'https://api.mercadopago.com/v1/payments';

    // Gerar uma chave de idempotência única para cada tentativa de pagamento PIX
    // Para cartão de crédito, o token já garante a unicidade da requisição
    const idempotencyKey = paymentMethod === 'pix'
      ? `pix-chk:${checkoutId}|email:${customerData.email}|${(crypto as any).randomUUID()}`
      : `cc-chk:${checkoutId}|email:${customerData.email}|${(crypto as any).randomUUID()}`;

    console.log('CREATE_MP_PAYMENT_DEBUG: 13. Enviando payload para MP:', { ...mpRequestBody, token: mpRequestBody.token ? '***' : undefined });
    console.log('CREATE_MP_PAYMENT_DEBUG: 13.1. Idempotency Key:', idempotencyKey);

    const mpResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': idempotencyKey
      },
      body: JSON.stringify(mpRequestBody)
    });

    // Tratamento de erro amigável
    if (!mpResponse.ok) {
      const errorBody = await mpResponse.text();
      console.error('CREATE_MP_PAYMENT_DEBUG: 14. Mercado Pago API Error:', errorBody);
      // Tentar parsear o erro para uma mensagem mais amigável, se for JSON
      try {
        const errorJson = JSON.parse(errorBody);
        const errorMessage = errorJson.message || errorJson.error || `Erro ao criar pagamento: ${mpResponse.status}`;
        return new Response(
          JSON.stringify({ success: false, error: errorMessage, mp_error_details: errorJson }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: mpResponse.status }
        );
      } catch {
        // Se não for JSON, retornar o texto bruto
        return new Response(
          JSON.stringify({ success: false, error: `Erro ao criar pagamento: ${mpResponse.status}`, mp_error_raw: errorBody }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: mpResponse.status }
        );
      }
    }

    const mpResult = await mpResponse.json();
    
    console.log('CREATE_MP_PAYMENT_DEBUG: 15. Mercado Pago Full Response:', JSON.stringify(mpResult, null, 2));
    if (paymentMethod === 'pix') {
      console.log('CREATE_MP_PAYMENT_DEBUG: 15.1. PIX Specific Data from MP Response:', {
        qr_code: mpResult.point_of_interaction?.transaction_data?.qr_code,
        qr_code_base64: mpResult.point_of_interaction?.transaction_data?.qr_code_base64,
        ticket_url: mpResult.point_of_interaction?.transaction_data?.ticket_url,
      });
    }

    console.log('CREATE_MP_PAYMENT_DEBUG: 16. Mercado Pago Response Summary:', { 
      ok: mpResponse.ok, 
      status: mpResponse.status,
      paymentStatus: mpResult.status,
      status_detail: mpResult.status_detail,
      paymentId: mpResult.id 
    });

    // Determinar o status baseado na resposta do Mercado Pago
    let paymentStatus = 'pending';
    if (mpResult.status === 'approved') {
      paymentStatus = 'completed';
    } else if (mpResult.status === 'rejected' || mpResult.status === 'cancelled') {
      paymentStatus = 'failed';
    }

    console.log('CREATE_MP_PAYMENT_DEBUG: 17. Salvando pagamento no banco com status:', paymentStatus);

    // Create payment record in database
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        checkout_id: checkoutId,
        user_id: null, // Allow null for guest checkout
        amount: numericAmountInCents, // Use the original amount in cents for DB storage
        payment_method: paymentMethod,
        status: paymentStatus,
        mp_payment_id: mpResult.id.toString(),
        mp_payment_status: mpResult.status || 'pending',
        qr_code: paymentMethod === 'pix' ? (mpResult.point_of_interaction?.transaction_data?.qr_code || null) : null,
        qr_code_base64: paymentMethod === 'pix' ? (mpResult.point_of_interaction?.transaction_data?.qr_code_base64 || null) : null,
        payment_url: paymentMethod === 'pix' 
          ? (mpResult.point_of_interaction?.transaction_data?.ticket_url || null)
          : null,
        metadata: {
          customer_data: customerData,
          order_bumps: orderBumps,
          selected_package: selectedPackage,
          purchased_product_ids: purchasedProductIds, // Persist all purchased product IDs
          payment_method: paymentMethod,
          // Persistir os dados de e-mail transacional e entregável no metadata do pagamento
          email_transactional_data: emailMetadata,
        }
      })
      .select(`
        *,
        checkouts (
          *,
          products (*)
        )
      `) // Select payment, then join checkouts and products
      .single();

    if (paymentError) {
      console.error('CREATE_MP_PAYMENT_DEBUG: 18. Database Error:', paymentError);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao salvar pagamento no banco de dados' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }
    console.log('CREATE_MP_PAYMENT_DEBUG: 19. Payment saved to DB:', JSON.stringify(payment, null, 2));

    // ===== AUTO-CREATE MEMBER ACCESS IF PAYMENT APPROVED =====
    // Automatically grant access to member areas based on the purchased products
    if (paymentStatus === 'completed' && customerData.email) {
      console.log('CREATE_MP_PAYMENT_DEBUG: Payment approved, attempting to grant member access based on purchased products for email:', customerData.email);
      try {
        // Get purchased product ids from payment metadata (persistido durante a criação do pagamento)
        const purchasedProductIds: string[] = (payment?.metadata as any)?.purchased_product_ids || [];

        // Collect member area IDs derived from products (product.member_area_id) and member_areas.associated_products
        const memberAreaIdsSet = new Set<string>();

        for (const productId of purchasedProductIds) {
          if (!productId) continue;
          try {
            const { data: productRow, error: prodErr } = await supabase
              .from('products')
              .select('id, member_area_id')
              .eq('id', productId)
              .maybeSingle();
            if (prodErr) {
              console.warn('CREATE_MP_PAYMENT_DEBUG: Error fetching product for access grant', prodErr);
            }
            if (productRow?.member_area_id) memberAreaIdsSet.add(productRow.member_area_id);

            // Find member areas that include this product in associated_products
            const { data: areas, error: areasErr } = await supabase
              .from('member_areas')
              .select('id')
              .overlaps('associated_products', [productId]);
            if (areasErr) {
              console.warn('CREATE_MP_PAYMENT_DEBUG: Error fetching member_areas by associated_products', areasErr);
            }
            if (areas && areas.length) areas.forEach((a: any) => a?.id && memberAreaIdsSet.add(a.id));
          } catch (e) {
            console.error('CREATE_MP_PAYMENT_DEBUG: Exception while resolving member areas for product', productId, e);
          }
        }

        const memberAreaIds = Array.from(memberAreaIdsSet);
        if (memberAreaIds.length === 0) {
          console.log('CREATE_MP_PAYMENT_DEBUG: No member areas found for purchased products; will still attempt member creation from productIds.');
        }

        // Chamar create-member uma vez com os dados mínimos (nome e email) e os productIds
        try {
          const { data: createRes, error: createErr } = await supabase.functions.invoke('create-member', {
            body: {
              name: customerData.name || checkout?.form_fields?.name || 'Cliente',
              email: customerData.email,
              checkoutId: checkoutId,
              paymentId: payment?.id || mpResult.id,
              planType: 'standard',
              productIds: purchasedProductIds
            }
          });

          if (createErr) {
            console.error('CREATE_MP_PAYMENT_DEBUG: create-member returned error:', createErr);
          } else if (createRes?.success) {
            console.log('CREATE_MP_PAYMENT_DEBUG: create-member succeeded:', { memberId: createRes.memberId, userId: createRes.userId });
          } else {
            console.warn('CREATE_MP_PAYMENT_DEBUG: create-member did not return success:', createRes);
          }
        } catch (e) {
          console.error('CREATE_MP_PAYMENT_DEBUG: Exception invoking create-member:', e);
        }
      } catch (accessError) {
        console.error('CREATE_MP_PAYMENT_DEBUG: Exception while creating member access based on products:', accessError);
      }
    }

    const responsePayload = {
      success: true,
      payment: {
        id: payment.id,
        mp_payment_id: mpResult.id,
        status: mpResult.status || 'pending',
        status_detail: mpResult.status_detail || null,
        qr_code: paymentMethod === 'pix' ? mpResult.point_of_interaction?.transaction_data?.qr_code : null,
        qr_code_base64: paymentMethod === 'pix' ? mpResult.point_of_interaction?.transaction_data?.qr_code_base64 : null,
        payment_url: paymentMethod === 'pix' 
          ? mpResult.point_of_interaction?.transaction_data?.ticket_url
          : null,
        amount: transactionAmountInReais, // Return amount in reais
        payment_method: paymentMethod,
        checkouts: payment.checkouts // Incluir dados do checkout e produto
      }
    };
    console.log('CREATE_MP_PAYMENT_DEBUG: 20. Response payload sent to frontend:', JSON.stringify(responsePayload, null, 2));

    return new Response(
      JSON.stringify(responsePayload),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
      );

  } catch (error) {
    console.error('CREATE_MP_PAYMENT_DEBUG: 21. Error creating payment:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erro interno do servidor'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});