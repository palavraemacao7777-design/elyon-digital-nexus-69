# ⚡ QUICK FIX - Erro 403 ao Salvar Senha

## 🚀 Solução Rápida (1 minuto)

### Step 1: Código Já Foi Corrigido ✅

A mudança no arquivo `src/pages/AdminMemberAreas.tsx` já foi aplicada.
**Recarregue o navegador: `Ctrl+Shift+R` ou `Cmd+Shift+R`**

### Step 2: Execute Este SQL no Supabase (IMPORTANTE)

1. Acesse: https://app.supabase.com/projects/jgmwbovvydimvnmmkfpy
2. SQL Editor → New Query
3. **Cole todo o texto abaixo:**

```sql
DROP POLICY IF EXISTS "Owners can insert their member_settings" ON public.member_settings;
DROP POLICY IF EXISTS "Owners can update their member_settings" ON public.member_settings;

CREATE POLICY "Owners can manage their member_settings" ON public.member_settings
FOR ALL TO authenticated
USING (member_area_id IN (SELECT id FROM member_areas WHERE user_id = auth.uid()))
WITH CHECK (member_area_id IN (SELECT id FROM member_areas WHERE user_id = auth.uid()));

COMMENT ON POLICY "Owners can manage their member_settings" ON public.member_settings IS
'Permite que proprietários de member_areas façam INSERT, UPDATE e DELETE em suas configurações.';
```n```

4. Clique em **"Run"** (ou Ctrl+Enter)
5. Aguarde: "Success 3 queries ran successfully"

## ✅ Pronto!

Teste agora:
1. Abra "Minhas Áreas de Membros"
2. Crie/Edite área com senha padrão
3. Clique "Salvar Área"

**Deve funcionar agora! 🎉**

---

### Se ainda não funcionar:

Verifique:
- [ ] Executou o SQL acima no Supabase Console
- [ ] Recarregou a página (Ctrl+Shift+R)
- [ ] Consultou o console (F12 → Console tab)

Procure por: `ADMIN_MEMBER_AREAS_DEBUG:` no console
