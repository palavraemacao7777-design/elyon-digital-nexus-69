// Função utilitária para buscar o memberId a partir do userId
// Endpoint: /functions/v1/get-member-id
// Método: POST
// Body: { "userId": "..." }
// Retorna: { success: true, memberId: "..." } ou erro

// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders, status: 200 });
  }

  let supabaseUrl: string | null = null;
  let supabaseServiceKey: string | null = null;
  try {
    // @ts-ignore
    supabaseUrl = Deno.env.get('SUPABASE_URL');
    // @ts-ignore
    supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Variáveis de ambiente não configuradas.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: 'Erro ao acessar configurações.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let bodyData: any = {};
  try {
    bodyData = await req.json();
  } catch (parseErr) {
    return new Response(
      JSON.stringify({ success: false, error: 'JSON inválido no corpo da requisição.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }

  const { userId } = bodyData;
  if (!userId) {
    return new Response(
      JSON.stringify({ success: false, error: 'userId é obrigatório.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }

  const { data: memberData, error: memberError } = await supabase
    .from('members')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (memberError) {
    return new Response(
      JSON.stringify({ success: false, error: 'Erro ao buscar memberId.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
  if (!memberData) {
    return new Response(
      JSON.stringify({ success: false, error: 'Nenhum membro encontrado para o userId informado.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
    );
  }

  return new Response(
    JSON.stringify({ success: true, memberId: memberData.id }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
  );
});
