# Schema Mismatch Fixes - member_access

## 🔴 Problema Identificado

O erro `column member_access.user_id does not exist` ocorria porque:

1. **Tabela real** `member_access` usa:
   - `member_id` (referencia `members.id`)
   - `product_id` (referencia `products.id`)

2. **Código antigo** estava usando:
   - `user_id` (não existe na tabela)
   - `module_id` (não existe na tabela)
   - Uma tabela `modules` que não existe (na verdade é `products`)

## ✅ Fixes Implementados

### 1. **supabase/functions/update-member-profile/index.ts**
- ✅ Busca `member_id` a partir do `user_id` quando não fornecido
- ✅ Usa `member_id` e `product_id` para `member_access` (não `user_id` e `module_id`)
- ✅ Upsert correto com `onConflict: 'member_id,product_id'`
- ✅ Deleta acessos não selecionados baseado em `product_id`

### 2. **supabase/functions/create-member-user/index.ts**
- ✅ Remove tentativa de criar `member_access` (não há `member_id` até que um pagamento seja processado)
- ✅ Renomeia `selectedModules` para `selectedProducts` para clareza
- ✅ Adiciona comentário explicando que `member_access` só é criado via webhook de pagamento

### 3. **src/pages/AdminMembers.tsx**
- ✅ Renomeia `modules` para `products` em toda a página
- ✅ Busca de `products` (não `modules`)
- ✅ Passa `memberId` e `selectedProducts` para `update-member-profile`
- ✅ Inclui busca de `members` para obter `member_id` para cada perfil
- ✅ Usa `product_id` para armazenar acesso (não `module_id`)
- ✅ Mapeia corretamente dados de `member_access` para cada membro

## 📋 Como Fazer Deploy

### Opção 1: Via CLI Local (requer autenticação)
```bash
cd /workspaces/elyon-digital-nexus-69
npx supabase functions deploy update-member-profile --project-ref jgmwbovvydimvnmmkfpy
npx supabase functions deploy create-member-user --project-ref jgmwbovvydimvnmmkfpy
```

Para autenticar:
```bash
npx supabase login
# Ou exporte o token:
export SUPABASE_ACCESS_TOKEN="seu_token_aqui"
```

### Opção 2: Via Dashboard Supabase
1. Acesse https://app.supabase.com
2. Vá para seu projeto `jgmwbovvydimvnmmkfpy`
3. Vá para **Edge Functions**
4. Clique em cada função e atualize o código com as mudanças

### Opção 3: Copie o código manualmente
Os arquivos prontos para deploy estão em:
- `/workspaces/elyon-digital-nexus-69/supabase/functions/update-member-profile/index.ts`
- `/workspaces/elyon-digital-nexus-69/supabase/functions/create-member-user/index.ts`

## 🧪 Teste After Deploy

1. **Criar novo membro via admin UI**
   - Vá para Admin → Membros
   - Adicione um novo membro e selecione alguns produtos
   - Clique "Salvar Membro"
   - Verifique no console se não há erro `user_id does not exist`

2. **Editar acesso de membro**
   - Clique em um membro existente
   - Mude os produtos selecionados
   - Clique "Salvar Membro"
   - Verifique se o acesso é atualizado corretamente

3. **Verificar logs de Edge Function**
   - No Supabase Dashboard → Edge Functions → Logs
   - Procure por `EDGE_FUNCTION_DEBUG` para ver execução

## 📊 Schema Validado

```sql
-- member_access table
id uuid PRIMARY KEY
member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE
product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE
status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'expired'))
granted_at timestamp DEFAULT now()
expires_at timestamp
created_at timestamp DEFAULT now()
updated_at timestamp DEFAULT now()

-- Índices
CREATE INDEX idx_member_access_member_id ON public.member_access(member_id);
CREATE INDEX idx_member_access_product_id ON public.member_access(product_id);
```

## ⚠️ Notas Importantes

1. **member_access REQUER member_id**: Não tente criar `member_access` sem ter criado um `members` primeiro
2. **Fluxo de pagamento**: Membros são criados automaticamente quando há pagamento via `create-member-from-payment`
3. **Admin users**: `create-member-user` cria apenas auth user + profile, não membro completo
4. **Atualização é segura**: Usa upsert + cleanup, não falha se alguns registros existem

## ✨ Resultado Esperado

Após deploy e testes:
- ✅ Nenhum erro `column member_access.user_id does not exist`
- ✅ Membros podem ter acesso a produtos atribuído/revogado via admin UI
- ✅ Fluxo de pagamento continua criando `member_access` normalmente
- ✅ Modo edição de membro mostra produtos atribuídos corretamente
