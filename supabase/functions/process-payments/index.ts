import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders, status: 200 });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Optional body: { mp_payment_id: string } to process a single payment
    const body = await (async () => { try { return await req.json(); } catch { return {}; } })();
    const mpPaymentId = body?.mp_payment_id as string | undefined;

    // Fetch payments with status completed (or a single mp_payment_id when provided)
    const query = supabase.from('payments').select('*').order('created_at', { ascending: false }).limit(200);
    const paymentsRes = mpPaymentId ?
      await supabase.from('payments').select('*').eq('mp_payment_id', mpPaymentId).maybeSingle() :
      await query.eq('status', 'completed');

    let payments: any[] = [];
    if (mpPaymentId) {
      if (paymentsRes.error) throw paymentsRes.error;
      if (paymentsRes.data) payments = [paymentsRes.data];
    } else {
      if (paymentsRes.error) throw paymentsRes.error;
      payments = paymentsRes.data || [];
    }

    const results: any[] = [];

    for (const payment of payments) {
      try {
        // Skip if already provisioned (metadata.member_provisioned == true)
        const metadata = payment.metadata || {};
        if (metadata.member_provisioned) {
          results.push({ mp_payment_id: payment.mp_payment_id, skipped: true, reason: 'already_provisioned' });
          continue;
        }

        const purchasedProductIds: string[] = (metadata.purchased_product_ids) || [];
        const customer = (metadata.customer_data) || {};
        const email = customer.email || payment.checkouts?.customer_email || null;
        const name = customer.name || customer.first_name || 'Cliente';

        if (!email) {
          results.push({ mp_payment_id: payment.mp_payment_id, skipped: true, reason: 'no_email' });
          continue;
        }

        // Invoke create-member (will derive member_area from productIds)
        const payload = {
          name,
          email,
          checkoutId: payment.checkout_id,
          paymentId: payment.id,
          planType: 'standard',
          productIds: purchasedProductIds || []
        };

        const { data: createRes, error: createErr } = await supabase.functions.invoke('create-member', { body: payload });
        if (createErr) {
          console.error('PROCESS_PAYMENTS: create-member invoke error for payment', payment.mp_payment_id, createErr);
          results.push({ mp_payment_id: payment.mp_payment_id, success: false, error: createErr });
          continue;
        }

        // Mark payment as provisioned in metadata to avoid reprocessing
        const newMetadata = { ...(payment.metadata || {}), member_provisioned: true, provisioned_member: createRes?.memberId || null };
        const { error: updateErr } = await supabase.from('payments').update({ metadata: newMetadata }).eq('id', payment.id);
        if (updateErr) {
          console.error('PROCESS_PAYMENTS: Failed to update payment metadata', updateErr);
        }

        results.push({ mp_payment_id: payment.mp_payment_id, success: true, createRes });
      } catch (e) {
        console.error('PROCESS_PAYMENTS: exception processing payment', payment?.mp_payment_id || payment?.id, e);
        results.push({ mp_payment_id: payment.mp_payment_id, success: false, error: e });
      }
    }

    return new Response(JSON.stringify({ success: true, processed: results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
  } catch (error) {
    console.error('PROCESS_PAYMENTS: error', error);
    return new Response(JSON.stringify({ success: false, error: error?.message || String(error) }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
});
