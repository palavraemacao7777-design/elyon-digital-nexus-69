// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Declare Deno namespace to resolve 'Cannot find name Deno' errors
/* eslint-disable @typescript-eslint/no-namespace */
declare namespace Deno {
  namespace env {
    function get(key: string): string | undefined;
  }
}
/* eslint-enable @typescript-eslint/no-namespace */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders, status: 200 });
  }

  try {
    const { email } = await req.json();

    if (!email || email.trim() === "") {
      return new Response("Email é obrigatório", { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' } 
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "https://elyon.app/reset-password"
    });

    if (error) {
      return new Response(error.message, { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' } 
      });
    }

    return new Response("Link de redefinição enviado com sucesso!", {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
    });
  } catch (err: any) {
    console.error('SEND_PASSWORD_RESET_DEBUG: Erro interno no servidor:', err.message, 'Stack:', err.stack);
    return new Response("Erro interno no servidor", { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' } 
    });
  }
});