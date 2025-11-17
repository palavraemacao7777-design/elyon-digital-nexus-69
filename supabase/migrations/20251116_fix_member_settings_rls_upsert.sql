-- Remover políticas existentes que podem estar causando o problema no upsert
DROP POLICY IF EXISTS "Owners can insert their member_settings" ON public.member_settings;
DROP POLICY IF EXISTS "Owners can update their member_settings" ON public.member_settings;

-- Criar uma política única que permite both INSERT e UPDATE (upsert)
CREATE POLICY "Owners can manage their member_settings" ON public.member_settings
FOR ALL TO authenticated
USING (member_area_id IN (SELECT id FROM member_areas WHERE user_id = auth.uid()))
WITH CHECK (member_area_id IN (SELECT id FROM member_areas WHERE user_id = auth.uid()));

-- Manter a política de visualização
-- "Owners can view their member_settings" já existe e está ok

-- Comentário explicativo
COMMENT ON POLICY "Owners can manage their member_settings" ON public.member_settings IS
'Permite que proprietários de member_areas façam INSERT, UPDATE e DELETE em suas configurações. Combinamos INSERT e UPDATE em uma única política de segurança para facilitar operações de upsert.';
