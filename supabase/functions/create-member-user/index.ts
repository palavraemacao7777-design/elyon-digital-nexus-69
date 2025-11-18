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

    if (!name || !email || !password || !memberAreaId) {
      console.error('EDGE_FUNCTION_DEBUG: Incomplete data received for member creation.');
      return new Response(
        JSON.stringify({ success: false, error: 'Dados incompletos: nome, email, senha e memberAreaId são obrigatórios.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // 1. Criar usuário no Supabase Auth
    console.log('EDGE_FUNCTION_DEBUG: Attempting to create user in auth.admin.createUser.');
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirmar o email
      user_metadata: { 
        name, 
        first_name: name.split(' ')[0], 
        last_name: name.split(' ').slice(1).join(' ') || '',
        member_area_id: memberAreaId, // Passar member_area_id para o user_metadata
        status: isActive ? 'active' : 'inactive' // Passar status para o user_metadata
      },
    });

    if (authError) {
      console.error('EDGE_FUNCTION_DEBUG: Error creating user with auth.admin.createUser:', authError);
      const authMsg = authError.message || '';
      const isDuplicateEmail = authMsg.includes('duplicate key value violates unique constraint "users_email_key"') || authMsg.includes('A user with this email address has already been registered') || authMsg.includes('email_exists') || authMsg.includes('already');

      // Tentativa de recuperação automática se o email já existir
      if (isDuplicateEmail) {
        console.log('EDGE_FUNCTION_DEBUG: Duplicate email detected, attempting recovery...');
        let existingUserId: string | null = null;

        // 1) tentar recuperar user_id pela tabela profiles
        try {
          const { data: existingProfile, error: profileErr } = await supabase
            .from('profiles')
            .select('user_id')
            .eq('email', email)
            .maybeSingle();

          if (!profileErr && existingProfile?.user_id) {
            existingUserId = existingProfile.user_id;
            console.log('EDGE_FUNCTION_DEBUG: user_id found in profiles:', existingUserId);
          } else if (profileErr) {
            console.warn('EDGE_FUNCTION_DEBUG: profiles lookup error:', profileErr.message || profileErr);
          }
        } catch (profileFetchErr) {
          console.warn('EDGE_FUNCTION_DEBUG: profiles lookup exception:', profileFetchErr);
        }

        // 2) fallback: buscar via admin.listUsers
        if (!existingUserId) {
          try {
            const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
            if (!listError && users && Array.isArray(users)) {
              const found = (users as any[]).find((u: any) => u.email === email);
              if (found?.id) {
                existingUserId = found.id;
                console.log('EDGE_FUNCTION_DEBUG: user_id found via admin.listUsers:', existingUserId);
              }
            } else if (listError) {
              console.warn('EDGE_FUNCTION_DEBUG: admin.listUsers error:', listError.message || listError);
            }
          } catch (listFetchErr) {
            console.warn('EDGE_FUNCTION_DEBUG: admin.listUsers exception:', listFetchErr);
          }
        }

        if (!existingUserId) {
          console.error('EDGE_FUNCTION_DEBUG: Duplicate email but could not recover user_id');
          return new Response(
            JSON.stringify({ success: false, error: 'Este e-mail já está cadastrado.' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 409 }
          );
        }

        console.log('EDGE_FUNCTION_DEBUG: Recovered existing user_id:', existingUserId);

        // Garantir que o profile exista/seja atualizado
        try {
          const { error: upsertProfileErr } = await supabase
            .from('profiles')
            .upsert({
              user_id: existingUserId,
              email,
              name,
              member_area_id: memberAreaId,
              status: isActive ? 'active' : 'inactive',
            }, { onConflict: 'user_id' });

          if (upsertProfileErr) {
            console.warn('EDGE_FUNCTION_DEBUG: profiles upsert warning:', upsertProfileErr.message || upsertProfileErr);
          } else {
            console.log('EDGE_FUNCTION_DEBUG: profiles upserted successfully');
          }
        } catch (upsertErr) {
          console.warn('EDGE_FUNCTION_DEBUG: profiles upsert exception:', upsertErr);
        }

        // Conceder acessos selecionados ao usuário existente
        // NOTA: member_access só é criado quando há um pagamento (via webhook -> create-member-from-payment)
        // Não tentamos criar member_access aqui porque não temos member_id ainda
        console.log('EDGE_FUNCTION_DEBUG: Skipping member_access for recovered user (requires payment flow)');

        console.log('EDGE_FUNCTION_DEBUG: Returning success for recovered existing user');
        return new Response(
          JSON.stringify({ success: true, userId: existingUserId, recovered: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      // Outros erros normais
      let statusCode = 500;
      let errorMessage = authMsg || 'Falha ao criar usuário.';

      if (authMsg.includes('Password should be at least 6 characters')) {
        statusCode = 400; // Bad Request
        errorMessage = 'A senha deve ter pelo menos 6 caracteres.';
      }

      return new Response(
        JSON.stringify({ success: false, error: errorMessage }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: statusCode }
      );
    }

    const newUserId = authData.user?.id;
    if (!newUserId) {
      console.error('EDGE_FUNCTION_DEBUG: New user ID not returned after auth.admin.createUser.');
      return new Response(
        JSON.stringify({ success: false, error: 'ID do novo usuário não retornado.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }
    console.log('EDGE_FUNCTION_DEBUG: User auth.users created with ID:', newUserId);

    // Garantir que o perfil seja criado na tabela 'profiles'
    try {
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          user_id: newUserId,
          email,
          name,
          member_area_id: memberAreaId,
          status: isActive ? 'active' : 'inactive',
        });
      if (profileError) {
        if (profileError.message && profileError.message.includes('duplicate key')) {
          console.warn('EDGE_FUNCTION_DEBUG: Perfil já existe na tabela profiles.');
        } else {
          console.error('EDGE_FUNCTION_DEBUG: Erro ao criar perfil em profiles:', profileError);
          return new Response(
            JSON.stringify({ success: false, error: 'Erro ao criar perfil do usuário.' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }
      }
    } catch (profileCatchErr) {
      console.error('EDGE_FUNCTION_DEBUG: Exceção ao criar perfil em profiles:', profileCatchErr);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro inesperado ao criar perfil do usuário.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Garantir que o membro seja criado na tabela 'members'
    try {
      const { error: memberError } = await supabase
        .from('members')
        .insert({
          user_id: newUserId,
          email,
          name,
          status: isActive ? 'active' : 'inactive',
          member_area_id: memberAreaId
          // Adicione outros campos obrigatórios conforme necessário (phone, checkout_id, payment_id, plan_type, etc)
        });
      if (memberError) {
        if (memberError.message && memberError.message.includes('duplicate key')) {
          console.warn('EDGE_FUNCTION_DEBUG: Membro já existe na tabela members.');
        } else {
          console.error('EDGE_FUNCTION_DEBUG: Erro ao criar membro em members:', memberError);
          return new Response(
            JSON.stringify({ success: false, error: 'Erro ao criar registro do membro.' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }
      }
    } catch (memberCatchErr) {
      console.error('EDGE_FUNCTION_DEBUG: Exceção ao criar membro em members:', memberCatchErr);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro inesperado ao criar registro do membro.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

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
      JSON.stringify({ success: true, userId: newUserId }),
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