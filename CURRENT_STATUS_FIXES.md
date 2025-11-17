# 📋 Status Atual: Problemas & Soluções

## 🔴 Problemas Identificados (Correções em Código)

### ✅ Problema 1: Schema Mismatch em member_access
**Erro**: `column member_access.user_id does not exist`

**Causa**: Funções Edge usando `user_id` e `module_id` mas tabela usa `member_id` e `product_id`

**Status**: ✅ **CORRIGIDO NO CÓDIGO**
- `supabase/functions/update-member-profile/index.ts` - Atualizado ✓
- `supabase/functions/create-member-user/index.ts` - Atualizado ✓
- `src/pages/AdminMembers.tsx` - Atualizado para usar `products` ✓

**Próximo Passo**: ⏳ **DEPLOY OBRIGATÓRIO** (via Dashboard ou CLI)
- Veja: `DEPLOY_EDGE_FUNCTIONS_MANUAL.md`

---

### ✅ Problema 2: Erro 400 ao Carregar Produtos
**Erro**: `Failed to load resource: the server responded with a status of 400`

**Causa**: 
- Query buscava `title` e `status` mas tabela usa `name` e não tem `status`
- RLS muito restritiva: usuários só viam seus próprios produtos

**Status**: ✅ **CORRIGIDO**
- `src/pages/AdminMembers.tsx` - fetchProducts() corrigida ✓
- Query agora usa `name` (correto) ✓
- Fallback gracioso adicionado ✓

**Próximo Passo**: ⏳ **APLICAR MIGRAÇÃO RLS** (no SQL Editor)
- Veja: `/workspaces/elyon-digital-nexus-69/supabase/migrations/20251117_products_admin_access.sql`
- Instruções: `MIGRATION_RLS_PRODUCTS.md`

---

### ✅ Problema 3: useCallback não definido
**Erro**: `useCallback is not defined` em MemberAreaDashboard

**Causa**: Hook não estava importado de 'react'

**Status**: ✅ **CORRIGIDO**
- `src/pages/MemberAreaDashboard.tsx` - useCallback adicionado ao import ✓

**Próximo Passo**: ⏸️ **NENHUM** (já está em produção)

---

## 📊 Checklist de Deploy

- [ ] **1. Deploy Edge Functions** (⚠️ CRÍTICO)
  - [ ] `update-member-profile`
  - [ ] `create-member-user`
  - Link: `DEPLOY_EDGE_FUNCTIONS_MANUAL.md`

- [ ] **2. Aplicar Migração RLS** (⚠️ CRÍTICO)
  - [ ] Copiar SQL de `20251117_products_admin_access.sql`
  - [ ] Colar em Supabase Dashboard → SQL Editor
  - [ ] Executar
  - Link: `MIGRATION_RLS_PRODUCTS.md`

- [ ] **3. Testar Admin Membros**
  - [ ] Carregar página (deve carregar lista de produtos)
  - [ ] Editar membro (alterar produtos)
  - [ ] Salvar (não deve gerar erro 500 de member_access)

- [ ] **4. Verificar Logs**
  - [ ] Edge Functions → Logs
  - [ ] Procure por: `Member update process completed successfully.`

---

## 📁 Arquivos Críticos

| Arquivo | Status | Ação |
|---------|--------|------|
| `supabase/functions/update-member-profile/index.ts` | ✅ Corrigido | Deploy obrigatório |
| `supabase/functions/create-member-user/index.ts` | ✅ Corrigido | Deploy obrigatório |
| `src/pages/AdminMembers.tsx` | ✅ Corrigido | Live (já publicado) |
| `src/pages/MemberAreaDashboard.tsx` | ✅ Corrigido | Live (já publicado) |
| `supabase/migrations/20251117_products_admin_access.sql` | ⏳ Pendente | Aplicar RLS |

---

## 🚀 Próximos Passos (Ordem de Prioridade)

### 1️⃣ URGENTE: Deploy das Edge Functions
```bash
# Via Dashboard:
1. Copiar código de update-member-profile/index.ts
2. Colar em Edge Functions → update-member-profile → Deploy
3. Repetir para create-member-user

# OU via CLI:
export SUPABASE_ACCESS_TOKEN="token"
npx supabase functions deploy update-member-profile --project-ref jgmwbovvydimvnmmkfpy
npx supabase functions deploy create-member-user --project-ref jgmwbovvydimvnmmkfpy
```

### 2️⃣ URGENTE: Aplicar Migração RLS
```sql
-- No Supabase Dashboard → SQL Editor:
DROP POLICY IF EXISTS "Users can view their own products" ON public.products;

CREATE POLICY "Users can view own or area products"
ON public.products FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR
  (
    member_area_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid()
      AND member_area_id = products.member_area_id
    )
  )
);
```

### 3️⃣ Testar Tudo
1. Recarregar Admin → Membros
2. Verificar que lista de produtos carrega (sem erro 400)
3. Editar um membro
4. Alterar produtos
5. Salvar
6. Verificar logs: `Member update process completed successfully.`

---

## 📝 Resumo das Mudanças

### Backend (Edge Functions)
- ✅ `user_id` → `member_id` em member_access
- ✅ `module_id` → `product_id` em member_access  
- ✅ Busca automática de `member_id` se não for fornecido
- ✅ Upsert com conflito correto: `member_id,product_id`

### Frontend (React)
- ✅ `modules` → `products` (tabela correta)
- ✅ Query: `select('id, name')` (colunas corretas)
- ✅ Sem filtro `status` (coluna não existe)
- ✅ Mapeia `name` → `title` para compatibilidade
- ✅ Fallback gracioso se RLS falhar

### Banco de Dados (RLS)
- ✅ Nova policy permite ver produtos de sua member_area
- ✅ Mantém compatibilidade com "seus próprios produtos"
- ✅ Fix para erro 400 ao carregar lista

---

## ✨ Resultado Esperado Após Deploy

✅ Admin consegue:
- [ ] Carregar página Admin → Membros sem erros
- [ ] Ver lista de produtos (sem erro 400)
- [ ] Editar um membro
- [ ] Alterar produtos atribuídos
- [ ] Salvar sem erro 500 (member_access schema)
- [ ] Ver confirmação de sucesso

✅ Sistema consegue:
- [ ] Criar novo membro via admin
- [ ] Atribuir produtos ao membro
- [ ] Revogar produtos do membro
- [ ] Sincronizar com webhook de pagamento
- [ ] Log: `Member update process completed successfully.`

---

**Status Geral**: 🟡 Em Transição (código corrigido, awaiting deploy)
**Ação Necessária**: 🚀 Deploy + Migração RLS
**ETA**: ~10 minutos se feito via Dashboard
