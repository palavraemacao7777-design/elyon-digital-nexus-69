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
  console.log('EDGE_FUNCTION_DEBUG: update-member-profile function started.');
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
          JSON.stringify({ success: false, error: 'Variáveis de ambiente não configuradas.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }
    } catch (envErr) {
      console.error('EDGE_FUNCTION_DEBUG: Error reading env vars:', envErr);
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
      console.error('EDGE_FUNCTION_DEBUG: Error parsing JSON body:', parseErr);
      return new Response(
        JSON.stringify({ success: false, error: 'JSON inválido no corpo da requisição.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const { userId, memberId, name, status, memberAreaId, selectedProducts } = bodyData;
    console.log('EDGE_FUNCTION_DEBUG: Received data:', { userId, memberId, name, status, memberAreaId, selectedProducts });

    if (!memberId && !userId) {
      console.error('EDGE_FUNCTION_DEBUG: Incomplete data received for member update.');
      return new Response(
        JSON.stringify({ success: false, error: 'É obrigatório informar memberId ou userId.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }
    if (!name || !status || !memberAreaId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Campos obrigatórios ausentes: name, status, memberAreaId.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Buscar memberId se não enviado
    let actualMemberId = memberId;
    if (!actualMemberId && userId) {
      const { data: memberData, error: memberError } = await supabase
        .from('members')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();
      if (memberError) {
        console.error('EDGE_FUNCTION_DEBUG: Error fetching member:', memberError);
        return new Response(
          JSON.stringify({ success: false, error: 'Erro ao buscar membro pelo userId.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }
      if (!memberData) {
        console.error('EDGE_FUNCTION_DEBUG: Nenhum membro encontrado para user_id informado.');
        return new Response(
          JSON.stringify({ success: false, error: 'Nenhum membro encontrado para o userId informado. Envie o memberId diretamente se já possuir.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
        );
      }
      actualMemberId = memberData.id;
    }
    if (!actualMemberId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Não foi possível determinar o memberId. Informe o memberId no payload.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }
    console.log('EDGE_FUNCTION_DEBUG: Using memberId:', actualMemberId);

    // 1. Atualizar auth.users metadata
    console.log('EDGE_FUNCTION_DEBUG: Attempting to update user_metadata for user:', userId);
    const { error: authUpdateError } = await supabase.auth.admin.updateUserById(
      userId,
      {
        user_metadata: { 
          name, 
          first_name: name.split(' ')[0], 
          last_name: name.split(' ').slice(1).join(' ') || '',
          member_area_id: memberAreaId,
          status: status,
        }
      }
    );

    if (authUpdateError) {
      console.error('EDGE_FUNCTION_DEBUG: Error updating user_metadata:', authUpdateError);
      return new Response(
        JSON.stringify({ success: false, error: authUpdateError.message || 'Falha ao atualizar metadados do usuário.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }
    console.log('EDGE_FUNCTION_DEBUG: User_metadata updated for user:', userId);

    // 2. Atualizar public.profiles table
    console.log('EDGE_FUNCTION_DEBUG: Attempting to update public.profiles for user:', userId);
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ name, status, member_area_id: memberAreaId })
      .eq('user_id', userId);

    if (profileError) {
      console.error('EDGE_FUNCTION_DEBUG: Error updating public.profiles:', profileError);
      return new Response(
        JSON.stringify({ success: false, error: profileError.message || 'Falha ao atualizar perfil público.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }
    console.log('EDGE_FUNCTION_DEBUG: Public profile updated for user:', userId);

    // 3. Atualizar member_access
    console.log('EDGE_FUNCTION_DEBUG: Attempting to update member_access for memberId:', actualMemberId);
    
    // Validar selectedProducts
    let accessInserts: any[] = [];
    if (selectedProducts && Array.isArray(selectedProducts)) {
      accessInserts = selectedProducts.map((productId: string) => ({
        member_id: actualMemberId,
        product_id: productId,
        status: 'active',
      }));
    }
    console.log('EDGE_FUNCTION_DEBUG: selectedProducts validated, count:', accessInserts.length);

    // Estratégia: UPSERT todos os registros selecionados + DELETE dos não selecionados
    try {
      // 1. Inserir/atualizar todos os acessos selecionados (upsert)
      if (accessInserts.length > 0) {
        console.log('EDGE_FUNCTION_DEBUG: Upserting member_access records:', JSON.stringify(accessInserts, null, 2));
        const { error: upsertAccessError } = await supabase
          .from('member_access')
          .upsert(accessInserts, { onConflict: 'member_id,product_id' });
        
        if (upsertAccessError) {
          console.error('EDGE_FUNCTION_DEBUG: Error upserting member_access:', upsertAccessError);
          return new Response(
            JSON.stringify({ success: false, error: upsertAccessError.message || 'Falha ao conceder acessos aos produtos.' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
          );
        }
        console.log('EDGE_FUNCTION_DEBUG: Member_access upserted for memberId:', actualMemberId);
      }

      // 2. Deletar acessos que NÃO estão na lista selecionada
      console.log('EDGE_FUNCTION_DEBUG: Fetching current member_access for cleanup...');
      const { data: currentAccess, error: fetchAccessError } = await supabase
        .from('member_access')
        .select('id, product_id')
        .eq('member_id', actualMemberId); // Correto: usar member_id
      
      if (fetchAccessError) {
        console.warn('EDGE_FUNCTION_DEBUG: Warning fetching current access:', fetchAccessError.message);
      } else if (currentAccess && Array.isArray(currentAccess)) {
        const selectedProductIds = accessInserts.map((a: any) => a.product_id);
        const accessToDelete = currentAccess.filter((a: any) => !selectedProductIds.includes(a.product_id));
        
        if (accessToDelete.length > 0) {
          console.log('EDGE_FUNCTION_DEBUG: Deleting unused access records, count:', accessToDelete.length);
          const accessIdsToDelete = accessToDelete.map((a: any) => a.id);
          
          const { error: deleteAccessError } = await supabase
            .from('member_access')
            .delete()
            .in('id', accessIdsToDelete);
          
          if (deleteAccessError) {
            console.warn('EDGE_FUNCTION_DEBUG: Warning deleting unused access:', deleteAccessError.message);
            // Não vamos falhar por isso, é apenas limpeza
          } else {
            console.log('EDGE_FUNCTION_DEBUG: Deleted unused access records');
          }
        } else {
          console.log('EDGE_FUNCTION_DEBUG: No access records to delete');
        }
      }

    } catch (err) {
      console.error('EDGE_FUNCTION_DEBUG: Exception updating member_access:', err);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao atualizar acessos aos módulos.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log('EDGE_FUNCTION_DEBUG: Member update process completed successfully.');
    return new Response(
      JSON.stringify({ success: true, message: 'Membro atualizado com sucesso.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('EDGE_FUNCTION_DEBUG: General error in update-member-profile function:', error.message, 'Stack:', error.stack);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Erro interno do servidor.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});