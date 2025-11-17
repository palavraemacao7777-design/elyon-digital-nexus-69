-- Corrigir políticas RLS em member_access para permitir INSERT e UPDATE via service_role
-- PROBLEMA: A política atual só permite SELECT, impedindo INSERT/UPDATE

-- Remover política antiga que não é suficiente
DROP POLICY IF EXISTS "Members can view their own access" ON public.member_access;

-- Criar política de SELECT para membros verem seu próprio acesso
CREATE POLICY "Members can view their own access" ON public.member_access
FOR SELECT TO authenticated
USING (member_id IN (SELECT id FROM members WHERE user_id = auth.uid()));

-- Criar política para service_role gerenciar (INSERT, UPDATE, DELETE) member_access
-- Isso permite que funções Edge (com service_role) criem acessos após pagamento
CREATE POLICY "Service role manages all member_access" ON public.member_access
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

-- Comentário explicativo
COMMENT ON POLICY "Service role manages all member_access" ON public.member_access IS
'Permite que funções Edge (service_role) insiram, atualizem e deletem registros de member_access após pagamento aprovado.';
