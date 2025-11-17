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
    // @ts-ignore
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    // @ts-ignore
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { name, email, password, memberAreaId, selectedModules, isActive } = await req.json();
    console.log('EDGE_FUNCTION_DEBUG: Received data:', { name, email, password: password ? '***' : 'N/A', memberAreaId, selectedModules, isActive });

    if (!name || !email || !password || !memberAreaId) {
      console.error('EDGE_FUNCTION_DEBUG: Incomplete data received for member creation.');
      return new Response(
        JSON.stringify({ success: false, error: 'Dados incompletos para criar o membro (nome, email, senha, memberAreaId são obrigatórios).' }),
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
      let statusCode = 500;
      let errorMessage = authError.message || 'Falha ao criar usuário.';

      // Tratamento de erro específico para e-mail duplicado
      if (authError.message.includes('duplicate key value violates unique constraint "users_email_key"') || authError.message.includes('A user with this email address has already been registered')) {
        statusCode = 409; // Conflict
        errorMessage = 'Este e-mail já está cadastrado.';
      } else if (authError.message.includes('Password should be at least 6 characters')) {
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
      if (profileError && !profileError.message.includes('duplicate key')) {
        console.error('EDGE_FUNCTION_DEBUG: Erro ao criar perfil em profiles:', profileError);
      }
    } catch (profileCatchErr) {
      console.error('EDGE_FUNCTION_DEBUG: Exceção ao criar perfil em profiles:', profileCatchErr);
    }

    // 2. Conceder acesso aos módulos
    console.log('EDGE_FUNCTION_DEBUG: Attempting to grant module access. Selected Modules:', selectedModules);
    const accessInserts = selectedModules.map((moduleId: string) => ({
      user_id: newUserId,
      module_id: moduleId,
      is_active: true,
      member_area_id: memberAreaId,
    }));

    if (accessInserts.length > 0) {
      console.log('EDGE_FUNCTION_DEBUG: Inserting into member_access:', JSON.stringify(accessInserts, null, 2));
      const { error: insertAccessError } = await supabase
        .from('member_access')
        .insert(accessInserts);

      if (insertAccessError) {
        console.error('EDGE_FUNCTION_DEBUG: Error inserting module access:', insertAccessError);
        return new Response(
          JSON.stringify({ success: false, error: insertAccessError.message || 'Falha ao conceder acesso aos módulos.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }
      console.log('EDGE_FUNCTION_DEBUG: Module access granted for user_id:', newUserId);
    } else {
      console.log('EDGE_FUNCTION_DEBUG: No modules selected to grant access.');
    }

    console.log('EDGE_FUNCTION_DEBUG: Member creation process completed successfully.');
    return new Response(
      JSON.stringify({ success: true, userId: newUserId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('EDGE_FUNCTION_DEBUG: General error in create-member-user function:', error.message, 'Stack:', error.stack);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Erro interno do servidor.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});