// Função automática: busca ou cria memberId e atualiza perfil
// Endpoint: /functions/v1/upsert-member-profile
// Método: POST
// Body: { userId, name, status, memberAreaId, selectedProducts, ... }
// 1. Busca memberId pelo userId
// 2. Se não existir, cria membro
// 3. Atualiza perfil e acessos

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

  const { userId, name, status, memberAreaId, selectedProducts } = bodyData;
  if (!userId || !name || !status || !memberAreaId) {
    return new Response(
      JSON.stringify({ success: false, error: 'Campos obrigatórios: userId, name, status, memberAreaId.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }

  // 1. Buscar memberId
  let memberId: string | null = null;
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
  if (memberData && memberData.id) {
    memberId = memberData.id;
  } else {
    // 2. Criar membro se não existir
    const { data: newMember, error: createError } = await supabase
      .from('members')
      .insert({ user_id: userId, name, status, member_area_id: memberAreaId })
      .select('id')
      .maybeSingle();
    if (createError || !newMember) {
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao criar membro.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }
    memberId = newMember.id;
  }

  // 3. Atualizar perfil e acessos (reutiliza lógica da update-member-profile)
  // Atualizar auth.users metadata
  await supabase.auth.admin.updateUserById(userId, {
    user_metadata: {
      name,
      first_name: name.split(' ')[0],
      last_name: name.split(' ').slice(1).join(' ') || '',
      member_area_id: memberAreaId,
      status: status,
    }
  });

  // Atualizar public.profiles
  await supabase
    .from('profiles')
    .update({ name, status, member_area_id: memberAreaId })
    .eq('user_id', userId);

  // Atualizar member_access
  let accessInserts: any[] = [];
  if (selectedProducts && Array.isArray(selectedProducts)) {
    accessInserts = selectedProducts.map((productId: string) => ({
      member_id: memberId,
      product_id: productId,
      status: 'active',
    }));
  }
  if (accessInserts.length > 0) {
    await supabase
      .from('member_access')
      .upsert(accessInserts, { onConflict: 'member_id,product_id' });
  }
  // Limpeza de acessos não selecionados
  const { data: currentAccess } = await supabase
    .from('member_access')
    .select('id, product_id')
    .eq('member_id', memberId);
  if (currentAccess && Array.isArray(currentAccess)) {
    const selectedProductIds = accessInserts.map((a: any) => a.product_id);
    const accessToDelete = currentAccess.filter((a: any) => !selectedProductIds.includes(a.product_id));
    if (accessToDelete.length > 0) {
      const accessIdsToDelete = accessToDelete.map((a: any) => a.id);
      await supabase
        .from('member_access')
        .delete()
        .in('id', accessIdsToDelete);
    }
  }

  return new Response(
    JSON.stringify({ success: true, memberId }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
  );
});
