# 🚀 DEPLOY MANUAL: Funções Edge Corrigidas

## 🔴 Problema Ativo
A função `update-member-profile` ainda está usando `user_id` (coluna que não existe).
Erro: `column member_access.user_id does not exist`

## ✅ Solução: Deploy das Funções Corrigidas

### Método 1: Via Supabase Dashboard (Recomendado - Mais Rápido)

#### Passo 1: update-member-profile
1. Acesse: https://app.supabase.com
2. Projeto: `jgmwbovvydimvnmmkfpy`
3. Menu → **Edge Functions** → `update-member-profile`
4. Clique em **Deploy** (canto superior direito)
5. Na aba **Code**, selecione tudo (Ctrl+A)
6. **Apague tudo** e cole o conteúdo abaixo:

```typescript
// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
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

    if (!userId || !name || !status || !memberAreaId) {
      console.error('EDGE_FUNCTION_DEBUG: Incomplete data received for member update.');
      return new Response(
        JSON.stringify({ success: false, error: 'Dados incompletos para atualizar o membro (userId, name, status, memberAreaId são obrigatórios).' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Se memberId não foi enviado, buscar na tabela members
    let actualMemberId = memberId;
    if (!actualMemberId) {
      const { data: memberData, error: memberError } = await supabase
        .from('members')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (memberError || !memberData) {
        console.error('EDGE_FUNCTION_DEBUG: Error fetching member:', memberError);
        return new Response(
          JSON.stringify({ success: false, error: 'Membro não encontrado.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
        );
      }
      actualMemberId = memberData.id;
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
        .eq('member_id', actualMemberId);
      
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
```

7. Clique **Deploy** (botão azul)
8. Aguarde até ver "✅ Deployment successful"

---

#### Passo 2: create-member-user
Repita os mesmos passos, mas para a função `create-member-user`:

1. Edge Functions → `create-member-user`
2. Copie o código de: `/workspaces/elyon-digital-nexus-69/supabase/functions/create-member-user/index.ts`
3. Cola no editor
4. Deploy

---

### Método 2: Via CLI (Se Tiver Token)
```bash
export SUPABASE_ACCESS_TOKEN="seu_token_do_supabase"
cd /workspaces/elyon-digital-nexus-69
npx supabase functions deploy update-member-profile --project-ref jgmwbovvydimvnmmkfpy
npx supabase functions deploy create-member-user --project-ref jgmwbovvydimvnmmkfpy
```

---

## ✅ Verificar Deploy

Após fazer o deploy, vá para **Edge Functions** → Selecione a função → Abra a aba **Logs**

Procure por:
- ✅ `EDGE_FUNCTION_DEBUG: Member update process completed successfully.` (sucesso)
- ❌ `column member_access.user_id does not exist` (ainda com problema antigo)

---

## 🎯 Teste Final

1. Vá para Admin → Membros
2. Selecione um membro ou crie um novo
3. Altere a seleção de produtos
4. Clique "Salvar Membro"
5. Nos logs do browser, procure por:
   - `MEMBER_FORM_DEBUG: Updating member: ...` (enviando)
   - `EDGE_FUNCTION_DEBUG: Member update process completed successfully.` (processado)

---

## ⏱️ Tempo Estimado
- **Método 1 (Dashboard)**: 5-10 minutos
- **Método 2 (CLI)**: 2-3 minutos

Se tiver dúvidas, verifique os logs de Edge Functions no dashboard!
