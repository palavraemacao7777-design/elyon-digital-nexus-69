-- Corrigir políticas RLS em products para permitir admins/staff acessar produtos de sua member_area

-- ANTES: Cada usuário só via seus próprios produtos
-- DEPOIS: Usuarios podem ver:
--   1. Seus próprios produtos (proprietário)
--   2. Todos os produtos da member_area se forem staff/admin dessa area

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

-- Comentário explicativo
COMMENT ON POLICY "Users can view own or area products" ON public.products IS
'Permite que usuários vejam seus próprios produtos ou todos os produtos da member_area onde são staff/admin';
