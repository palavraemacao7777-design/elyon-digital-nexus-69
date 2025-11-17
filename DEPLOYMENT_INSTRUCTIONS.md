# 🔧 Correção: Schema Mismatch em member_access

## 📌 Problema Original

```
Error: column member_access.user_id does not exist
```

O código estava tentando usar colunas que não existem em `member_access`:
- ❌ `user_id` → A coluna real é `member_id`
- ❌ `module_id` → A coluna real é `product_id`

## ✅ Arquivos Corrigidos

### 1️⃣ `supabase/functions/update-member-profile/index.ts`

**Mudanças principais:**
```typescript
// ANTES (ERRADO):
const { userId, name, status, memberAreaId, selectedModules } = bodyData;
// Tentava usar: user_id, module_id em member_access

// DEPOIS (CORRETO):
const { userId, memberId, name, status, memberAreaId, selectedProducts } = bodyData;
// Se memberId não for fornecido, busca na tabela members:
const memberData = await supabase
  .from('members')
  .select('id')
  .eq('user_id', userId)
  .maybeSingle();

// Usa corretamente:
.from('member_access')
.upsert(accessInserts, { onConflict: 'member_id,product_id' });
```

**Benefícios:**
- ✅ Usa o schema real da tabela `member_access`
- ✅ Encontra automaticamente o `member_id` se não for fornecido
- ✅ Insere/atualiza com upsert seguro
- ✅ Deleta acessos não selecionados corretamente

---

### 2️⃣ `supabase/functions/create-member-user/index.ts`

**Mudanças principais:**
```typescript
// ANTES:
const { name, email, password, memberAreaId, selectedModules, isActive } = bodyData;
// Tentava criar member_access diretamente

// DEPOIS:
const { name, email, password, memberAreaId, selectedProducts, isActive } = bodyData;
// Remove tentativa de criar member_access
console.log('EDGE_FUNCTION_DEBUG: Module access will be granted via payment flow');
```

**Motivo:** Não há `member_id` até que um pagamento seja processado. O fluxo é:
1. `create-member-user` → Cria auth user + profile
2. Pagamento realizado
3. Webhook → `create-member-from-payment` → Cria `members` + `member_access`

---

### 3️⃣ `src/pages/AdminMembers.tsx`

**Mudanças principais:**
```typescript
// ANTES:
type Module = Tables<'modules'>; // Tabela que não existe!
const [modules, setModules] = useState<Module[]>([]);
selectedModules: member?.member_access?.map((ma) => ma.module_id)

// DEPOIS:
type Product = Tables<'products'>; // Tabela real
const [products, setProducts] = useState<Product[]>([]);
selectedProducts: member?.member_access?.map((ma) => ma.product_id)

// Busca corrigida:
const { data } = await supabase
  .from('products')  // Não 'modules'
  .select('id, title')
  .eq('status', 'published')
  .eq('member_area_id', currentMemberAreaId);

// Passa dados corretamente para função:
await supabase.functions.invoke('update-member-profile', {
  body: {
    userId: member.user_id,
    memberId: member.members?.[0]?.id,  // ← Novo!
    name,
    status: isActive ? 'active' : 'inactive',
    memberAreaId,
    selectedProducts,  // ← Corrigido de selectedModules
  },
});
```

**Benefícios:**
- ✅ Busca dos produtos/modelos corretos (table `products`)
- ✅ Passa `memberId` para a função
- ✅ UI mostra "Acesso aos Produtos" (mais preciso)
- ✅ Mapeamento correto de `product_id`

---

## 🚀 Como Fazer Deploy

### Opção A: Usar o Script (Recomendado)
```bash
# 1. Configure o token de acesso
export SUPABASE_ACCESS_TOKEN="sbrk_xxxxxxxxxxxxx"

# 2. Execute o script
./deploy-fixes.sh
```

### Opção B: Deploy Manual
```bash
# 1. Faça login
npx supabase login

# 2. Deploy as funções
npx supabase functions deploy update-member-profile --project-ref jgmwbovvydimvnmmkfpy
npx supabase functions deploy create-member-user --project-ref jgmwbovvydimvnmmkfpy

# 3. Verifique o resultado
npx supabase functions list --project-ref jgmwbovvydimvnmmkfpy
```

### Opção C: Via Dashboard Supabase
1. Vá para https://app.supabase.com
2. Projeto: `jgmwbovvydimvnmmkfpy`
3. **Edge Functions** → Selecione a função
4. Cole o código de `/workspaces/elyon-digital-nexus-69/supabase/functions/{funcao}/index.ts`
5. Clique **Deploy**

---

## 🧪 Como Testar Após Deploy

### Teste 1: Criar Novo Membro
```
1. Vá para Admin → Membros
2. Clique "Novo Membro"
3. Preencha: Nome, Email, Senha
4. Selecione alguns "Produtos"
5. Clique "Salvar Membro"

✅ Esperado: Membro criado sem erros
❌ Errado: "column member_access.user_id does not exist"
```

### Teste 2: Editar Acesso de Membro
```
1. Vá para Admin → Membros
2. Clique em um membro existente
3. Altere a seleção de produtos
4. Clique "Salvar Membro"

✅ Esperado: Acesso atualizado imediatamente
```

### Teste 3: Ver Logs de Execução
```
1. Vá para Supabase Dashboard
2. Edge Functions → Update Member Profile
3. Logs
4. Procure por: "EDGE_FUNCTION_DEBUG"

✅ Esperado: Ver "Member_access upserted for memberId: xxx"
```

---

## 📊 Verificação de Schema

A tabela `member_access` deve ter estas colunas:
```sql
\d+ member_access

-- Esperado:
--  id              | uuid
--  member_id       | uuid   ← Referencia members.id
--  product_id      | uuid   ← Referencia products.id
--  status          | text   (active, inactive, expired)
--  granted_at      | timestamp
--  expires_at      | timestamp
--  created_at      | timestamp
--  updated_at      | timestamp
```

---

## 🎯 Resumo das Mudanças

| Arquivo | Mudança | Impacto |
|---------|---------|--------|
| `update-member-profile/index.ts` | `user_id` → `member_id` + `module_id` → `product_id` | Fix do erro principal |
| `create-member-user/index.ts` | Remove member_access, só cria auth+profile | Fluxo correto |
| `AdminMembers.tsx` | `modules` → `products`, passa `memberId` | UI funcional |

---

## ⚡ Próximos Passos Recomendados

1. ✅ Deploy das 2 funções Edge
2. ✅ Teste via Admin UI
3. ✅ Verifique logs de execução
4. ⏳ (Opcional) Criar script para fazer retroactively membership provision

---

## 📝 Notas

- A mudança é **backwards-compatible** com o fluxo de pagamento
- `create-member-from-payment` já estava usando `member_id,product_id` (correto)
- O erro só ocorria quando usando Admin UI para criar/editar membros
- Após deploy, nenhuma alteração adicional no banco de dados é necessária

---

**Status:** ✅ Código pronto para deploy | ⏳ Aguardando deploy manual
