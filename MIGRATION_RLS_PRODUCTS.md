# 🔧 Migração: Corrigir RLS em products

## Problema
Erro 400 ao carregar produtos no Admin → Members porque a RLS estava muito restritiva.

## Causa
A política RLS de `products` apenas permitia que cada usuário visse seus próprios produtos (`auth.uid() = user_id`). Mas admin users precisam ver todos os produtos de sua member_area.

## Solução
Nova política RLS que permite:
1. ✅ Ver seus próprios produtos (como antes)
2. ✅ Ver todos os produtos da member_area se tiver um profile lá

## Como Aplicar

### Opção 1: Via SQL Editor do Supabase Dashboard
```sql
-- Remover política antiga restritiva
DROP POLICY IF EXISTS "Users can view their own products" ON public.products;

-- Nova política permissiva
CREATE POLICY "Users can view own or area products"
ON public.products FOR SELECT
TO authenticated
USING (
  -- Ver produtos que são donos
  auth.uid() = user_id
  OR
  -- Ver produtos da member_area se tem profile lá
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

### Opção 2: Via Migração Local
```bash
# Se usar Supabase CLI localmente:
cd /workspaces/elyon-digital-nexus-69
npx supabase migration resolve 20251117_products_admin_access
```

## Teste
1. Acesse Admin → Membros
2. Verifique que a lista de produtos carrega sem erro 400
3. Selecione produtos para um membro
4. Salve sem erros

## Rollback (se necessário)
```sql
-- Reverter para a política original
DROP POLICY IF EXISTS "Users can view own or area products" ON public.products;

CREATE POLICY "Users can view their own products"
ON public.products FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
```
