// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Função para gerar string aleatória para senhas
function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

// @ts-ignore
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

serve(async (req) => {
  console.log('EDGE_FUNCTION_DEBUG: create-member-user function started.');
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders, status: 200 });
  }

  try {
    let supabaseUrl: string | null = null;
    let supabaseServiceKey: string | null = null;
    
    try {
      // @ts-ignore
      supabaseUrl = Deno.env.get('SUPABASE_URL');
      // @ts-ignore
      supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (!supabaseUrl || !supabaseServiceKey) {
        console.error('EDGE_FUNCTION_DEBUG: Missing env vars - SUPABASE_URL:', !!supabaseUrl, 'SERVICE_KEY:', !!supabaseServiceKey);
        return new Response(
          JSON.stringify({ success: false, error: 'Erro de configuração: variáveis de ambiente SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não estão definidas.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }
    } catch (envErr) {
      console.error('EDGE_FUNCTION_DEBUG: Error reading env vars:', envErr);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao acessar configurações do ambiente.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let bodyData: any = {};
    try {
      bodyData = await req.json();
    } catch (parseErr) {
      console.error('EDGE_FUNCTION_DEBUG: Error parsing JSON body:', parseErr);
      return new Response(
        JSON.stringify({ success: false, error: 'O corpo da requisição não está em formato JSON válido.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const { name, email, password, memberAreaId, selectedProducts, isActive } = bodyData;
    console.log('EDGE_FUNCTION_DEBUG: Received data:', { name, email, password: password ? '***' : 'N/A', memberAreaId, selectedProducts, isActive });

    if (!name || !email || !memberAreaId) {
      console.error('EDGE_FUNCTION_DEBUG: Incomplete data received for member creation.');
      return new Response(
        JSON.stringify({ success: false, error: 'Dados incompletos: name, email e memberAreaId são obrigatórios.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // 1. Determinar senha a usar: usar apenas senha fixa configurada na member_settings
    let generatedPassword: string | null = null;
    try {
      const { data: settingsData, error: settingsError } = await supabase
        .from('member_settings')
        .select('default_password_mode, default_fixed_password')
        .eq('member_area_id', memberAreaId)
        .maybeSingle();

      if (settingsError) {
        console.warn('EDGE_FUNCTION_DEBUG: Erro ao buscar member_settings:', settingsError);
      } else if (settingsData && settingsData.default_password_mode === 'fixed' && settingsData.default_fixed_password) {
        generatedPassword = settingsData.default_fixed_password;
        console.log('EDGE_FUNCTION_DEBUG: Using fixed default password from member_settings');
      } else {
        console.error('EDGE_FUNCTION_DEBUG: Fixed default password not configured for this member area.');
        return new Response(
          JSON.stringify({ success: false, error: 'Senha fixa não configurada para esta área de membros.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
    } catch (settingsCatch) {
      console.warn('EDGE_FUNCTION_DEBUG: Exception while fetching member_settings:', settingsCatch);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao obter configuração da área de membros.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    let passwordHash = null;
    try {
      // generatedPassword is non-null here
      passwordHash = await bcrypt.hash(generatedPassword as string);
    } catch (hashErr) {
      console.error('EDGE_FUNCTION_DEBUG: Erro ao hashear a senha:', hashErr);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao gerar senha.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Gerar um user_id interno para relacionar profiles e members
    const generatedUserId = crypto.randomUUID();

    // Upsert profile com o user_id gerado
    try {
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          user_id: generatedUserId,
          email,
          name,
          member_area_id: memberAreaId,
          status: isActive ? 'active' : 'inactive',
        }, { onConflict: 'email' });

      if (profileError) {
        console.error('EDGE_FUNCTION_DEBUG: Erro ao upsert profile:', profileError);
      }
    } catch (pErr) {
      console.warn('EDGE_FUNCTION_DEBUG: profiles upsert exception:', pErr);
    }

    // Criar registro em members com o user_id gerado
    let newMemberId: string | null = null;
    try {
      const { data: newMember, error: memberError } = await supabase
        .from('members')
        .insert({
          user_id: generatedUserId,
          email,
          name,
          password_hash: passwordHash,
          member_area_id: memberAreaId,
          status: isActive ? 'active' : 'inactive',
        })
        .select('id')
        .maybeSingle();

      if (memberError) {
        console.error('EDGE_FUNCTION_DEBUG: Erro ao criar member:', memberError);
        return new Response(
          JSON.stringify({ success: false, error: 'Erro ao criar membro.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }
      newMemberId = newMember?.id;
    } catch (memberCatchErr) {
      console.error('EDGE_FUNCTION_DEBUG: Exceção ao criar member:', memberCatchErr);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro inesperado ao criar membro.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }
    console.log('EDGE_FUNCTION_DEBUG: Created member id:', newMemberId);

    // profiles e members já foram criados/upsertados acima

    // 2. Conceder acesso aos produtos
    // NOTA: member_access só é criado quando há um pagamento (via webhook -> create-member-from-payment)
    // Não tentamos criar member_access aqui porque não temos member_id até que um pagamento seja processado
    console.log('EDGE_FUNCTION_DEBUG: Module access will be granted via payment flow (member_access requires member_id from payment)');
    
    if (selectedProducts && Array.isArray(selectedProducts)) {
      console.log('EDGE_FUNCTION_DEBUG: Noted selected products for reference (will be applied after payment):', selectedProducts);
    } else {
      console.log('EDGE_FUNCTION_DEBUG: No products selected at user creation time.');
    }

    console.log('EDGE_FUNCTION_DEBUG: Member creation process completed successfully.');
    return new Response(
      JSON.stringify({ success: true, userId: generatedUserId, memberId: newMemberId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('EDGE_FUNCTION_DEBUG: General error in create-member-user function:', error && error.message ? error.message : error, 'Stack:', error && error.stack ? error.stack : '');
    return new Response(
      JSON.stringify({ success: false, error: 'Erro inesperado ao criar usuário. Por favor, tente novamente ou contate o suporte.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});