# 🔧 CORREÇÃO DO ERRO 403 AO SALVAR SENHA PADRÃO

## Problema

Ao tentar salvar a senha padrão na área de membros, recebe o seguinte erro:

```
403 Forbidden
Failed to load resource: the server responded with a status of 403
ADMIN_MEMBER_AREAS_DEBUG: Error saving password settings
```

## Causa

A tabela `member_settings` possui políticas RLS (Row Level Security) que não permitem operações de `upsert` corretamente. O problema é:

1. **Múltiplas políticas separadas** para INSERT e UPDATE que podem conflitar
2. **Falta de suporte adequado** para operação de `upsert` que usa `on_conflict`

## Solução

Implementamos **dois fixes**:

### 1️⃣ Correção no Código Frontend ✅ (JÁ APLICADA)

O arquivo `src/pages/AdminMemberAreas.tsx` foi atualizado para:
- **Remover o `upsert` com `onConflict`** que causa conflito de RLS
- **Usar lógica manual de INSERT/UPDATE** que respeita as políticas

**Como funciona:**
1. Verifica se já existe configuração para a área
2. Se existe → faz **UPDATE**
3. Se não existe → faz **INSERT**

Esta mudança **não requer quebra de banco de dados** e é compatível com as políticas RLS atuais.

### 2️⃣ Correção no Banco de Dados (OPCIONAL MAS RECOMENDADO)

Para garantir que `upsert` funcione corretamente no futuro, execute a migração SQL no Supabase:

#### Opção A: Supabase Console (Recomendado)

1. Acesse: https://app.supabase.com/projects/jgmwbovvydimvnmmkfpy
2. Clique em **"SQL Editor"** (sidebar esquerdo)
3. Clique em **"New Query"**
4. Cole o SQL abaixo:

```sql
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
```

5. Clique em **"Run"** (ou pressione `Ctrl+Enter`)
6. Aguarde a confirmação de sucesso

#### Opção B: Terminal (se tiver psql instalado)

```bash
# Obtenha a connection string do Supabase Console:
# Settings → Database → Connection String (URI)

psql "postgresql://postgres.[PROJECT]:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres" << 'EOF'
DROP POLICY IF EXISTS "Owners can insert their member_settings" ON public.member_settings;
DROP POLICY IF EXISTS "Owners can update their member_settings" ON public.member_settings;

CREATE POLICY "Owners can manage their member_settings" ON public.member_settings
FOR ALL TO authenticated
USING (member_area_id IN (SELECT id FROM member_areas WHERE user_id = auth.uid()))
WITH CHECK (member_area_id IN (SELECT id FROM member_areas WHERE user_id = auth.uid()));

COMMENT ON POLICY "Owners can manage their member_settings" ON public.member_settings IS
'Permite que proprietários de member_areas façam INSERT, UPDATE e DELETE em suas configurações. Combinamos INSERT e UPDATE em uma única política de segurança para facilitar operações de upsert.';
EOF
```

## ✅ Teste

Após aplicar **uma** das soluções acima:

1. Abra a página de **"Minhas Áreas de Membros"**
2. Clique em **"Nova Área de Membros"** ou edite uma existente
3. Preencha os dados e **configure a senha padrão**
4. Clique em **"Salvar Área"**
5. Verifique se a mensagem de sucesso aparece

## 📝 Detalhes Técnicos

### O que mudou no Frontend

**Antes:**
```typescript
const { data: settingsData, error: settingsError } = await supabase
  .from('member_settings')
  .upsert(settingsPayload, { onConflict: 'member_area_id' })
  .select();
```

**Depois:**
```typescript
// Verifica se existe
const { data: existingSettings } = await supabase
  .from('member_settings')
  .select('id')
  .eq('member_area_id', areaId)
  .maybeSingle();

if (existingSettings) {
  // UPDATE se existe
  const { data: updateData, error: updateError } = await supabase
    .from('member_settings')
    .update(settingsPayload)
    .eq('member_area_id', areaId)
    .select();
} else {
  // INSERT se não existe
  const { data: insertData, error: insertError } = await supabase
    .from('member_settings')
    .insert(settingsPayload)
    .select();
}
```

### Por que isso funciona

- **INSERT** e **UPDATE** são operações separadas que respeitam as políticas RLS
- Não usa `onConflict` que pode conflitar com a configuração de RLS
- Garante que a operação sempre será aceita pelas políticas

### Política de RLS unificada (após step 2)

A política combinada:
```sql
CREATE POLICY "Owners can manage their member_settings" ON public.member_settings
FOR ALL TO authenticated  -- Cobre SELECT, INSERT, UPDATE, DELETE
USING (member_area_id IN (SELECT id FROM member_areas WHERE user_id = auth.uid()))
WITH CHECK (member_area_id IN (SELECT id FROM member_areas WHERE user_id = auth.uid()));
```

Benefícios:
- Uma única política em vez de várias
- Suporta upsert corretamente
- Permite DELETE se necessário

## 🆘 Se ainda não funcionar

1. **Verifique se salvou o arquivo**:
   ```bash
   git status src/pages/AdminMemberAreas.tsx
   ```

2. **Recarregue a página**:
   - Ctrl+Shift+R (hard refresh) ou Cmd+Shift+R no Mac
   - Limpe cache do navegador

3. **Verifique o console do navegador** (F12 → Console):
   - Procure por `ADMIN_MEMBER_AREAS_DEBUG:` 
   - Verifique a resposta da API

4. **Se ainda tiver erro 403**:
   - Aplique obrigatoriamente o SQL do Step 2 acima
   - Verifique se seu usuário é proprietário da área

## 📚 Arquivos Relevantes

- **Código atualizado**: `src/pages/AdminMemberAreas.tsx` (linha ~210)
- **Migração SQL**: `supabase/migrations/20251116_fix_member_settings_rls_upsert.sql`
- **Tabela**: `public.member_settings`
- **Policies**: Combinadas em uma única policy "Owners can manage their member_settings"

## ✨ Resultado Esperado

Após aplicar as correções, você conseguirá:

✅ Salvar senha padrão sem erro 403
✅ Criar novas áreas com configurações de senha
✅ Editar áreas existentes e atualizar senha
✅ Deletar áreas (com cascade das configurações)

---

**Última atualização**: 17 de Novembro de 2025
**Status**: ✅ Correção Frontend Aplicada | 📋 Aguardando Apply SQL (Opcional)
