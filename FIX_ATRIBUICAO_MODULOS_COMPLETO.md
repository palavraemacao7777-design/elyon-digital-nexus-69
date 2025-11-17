# 🔧 FIX: Atribuição de Acesso aos Módulos Não Funcionava

## Problema
Ao atualizar membro e tentar atribuir módulos, a operação não salvava os acessos:
- ❌ Modal de editar membro abria
- ❌ Selecionava módulos e clicava salvar
- ❌ Função retornava sucesso, mas acesso não aparecia
- ❌ Ao abrir novamente, módulos não apareciam selecionados

## Causa Raiz
A função `update-member-profile` usava estratégia **DELETE + INSERT**:
1. Deletava TODOS os acessos existentes para o usuário
2. Tentava inserir os novos acessos
3. Problema: constraints de unique key (`user_id, module_id, member_area_id`) faziam INSERT falhar se tivesse duplicate
4. Operação retornava sucesso mesmo que INSERT falhasse silenciosamente

## Solução Implementada

### Nova Estratégia: UPSERT
```typescript
// ANTES: Delete + Insert (falha em duplicates)
await supabase.from('member_access').delete()...
await supabase.from('member_access').insert(...)

// DEPOIS: Upsert + Cleanup seletivo
// 1. Upsert todos os módulos selecionados (cria ou atualiza)
await supabase.from('member_access').upsert(accessInserts, { onConflict: 'user_id,module_id,member_area_id' })

// 2. Delete APENAS os módulos não selecionados
const accessToDelete = currentAccess.filter(a => !selectedModuleIds.includes(a.module_id))
await supabase.from('member_access').delete().in('id', accessIdsToDelete)
```

### Benefícios
- ✅ Respeita unique constraints
- ✅ Não perde dados entre updates
- ✅ Cria apenas os necessários
- ✅ Deleta apenas o que não foi selecionado
- ✅ Retry automático com fallback

### Fallback em Caso de Erro
```typescript
if (upsertError && upsertError.message?.includes('onConflict')) {
  // Fallback: tentar insert simples (ignora duplicates)
  await supabase.from('member_access').insert(accessInserts)
}
```

## Arquivos Modificados

### 1. `supabase/functions/update-member-profile/index.ts`
- Substituiu DELETE + INSERT por UPSERT + cleanup seletivo
- Adicionou retry com fallback
- Melhorou logging

### 2. `src/pages/AdminMembers.tsx`
- Adicionou console.log para debug (MEMBER_FORM_DEBUG)
- Registra exatamente o que está sendo enviado

## Como Testar

### Pré-requisito: Deploy
```bash
cd /workspaces/elyon-digital-nexus-69
supabase functions deploy update-member-profile
```

### Teste 1: Adicionar Acesso a um Membro
1. Abrir AdminMembers (Área de Membros → Membros)
2. Clique no botão Edit (lápis) de um membro existente
3. Na modal, selecione alguns módulos em "Acesso aos Módulos"
4. Clique "Salvar Membro"
5. Esperar o toast "Sucesso"
6. **Verificar**: Clique Edit novamente → deve mostrar os mesmos módulos selecionados ✅

### Teste 2: Modificar Acesso
1. Abrir um membro que já tem módulos selecionados
2. Desmarcar alguns módulos e marcar outros
3. Salvar
4. Abrir novamente → deve mostrar apenas os novos módulos ✅

### Teste 3: Remover Todos os Acessos
1. Abrir um membro com módulos
2. Clique "Bloquear Tudo" (remover seleção)
3. Salvar
4. Abrir novamente → nenhum módulo deve estar selecionado ✅

## Debugging com Logs

### No Terminal (Frontend)
```
Abrir DevTools (F12) → Console
Procurar por: "MEMBER_FORM_DEBUG: Updating member:"
Ver exatamente o que foi enviado
```

### Na Edge Function (Backend)
```bash
supabase functions logs update-member-profile --tail
```

Procurar por:
```
EDGE_FUNCTION_DEBUG: Attempting to update member_access for user:
EDGE_FUNCTION_DEBUG: selectedModules validated, count: X
EDGE_FUNCTION_DEBUG: Upserting member_access records: [...]
EDGE_FUNCTION_DEBUG: Member_access upserted for user:
EDGE_FUNCTION_DEBUG: Deleting unused access records, count: X
```

## Estrutura de member_access Esperada

A tabela `member_access` deve ter:
```sql
- id (uuid, primary key)
- user_id (uuid, foreign key to auth.users)
- module_id (uuid, foreign key to modules)
- member_area_id (uuid, foreign key to member_areas)
- is_active (boolean)
- created_at (timestamp)
- updated_at (timestamp)

-- Constraint recomendado:
UNIQUE(user_id, module_id, member_area_id)
```

## SQL para Verificar Acesso (Manual)

```sql
-- Ver todos os acessos de um membro
SELECT 
  u.email,
  u.name,
  ma.module_id,
  m.title as module_title,
  ma.is_active
FROM member_access ma
JOIN profiles u ON ma.user_id = u.user_id
LEFT JOIN modules m ON ma.module_id = m.id
WHERE u.email = 'email-do-membro@example.com'
  AND ma.member_area_id = 'area-id'
ORDER BY m.title;
```

## Flow Completo Agora

```
AdminMembers (editar membro)
        ↓
Seleciona módulos: [mod1, mod3, mod5]
        ↓
Clica "Salvar"
        ↓
Frontend envia: { userId, selectedModules: [mod1, mod3, mod5] }
        ↓
update-member-profile recebe
        ↓
UPSERT [
  { user_id, module_id: mod1, ... },
  { user_id, module_id: mod3, ... },
  { user_id, module_id: mod5, ... }
]
        ↓
Encontra acesso anterior: [mod2, mod3, mod5]
        ↓
Deleta APENAS mod2 (não está na nova lista)
        ↓
✅ Resultado final: user tem acesso a [mod1, mod3, mod5]
        ↓
Frontend recarrega membros
        ↓
Mostra member_access atualizado ✅
```

## Status

✅ Estratégia UPSERT implementada
✅ Fallback com retry
✅ Cleanup seletivo de acessos
✅ Logging melhorado
⏳ Deploy necessário
⏳ Teste manual recomendado

---

**Próxima ação:** Deploy e testar atribuição de módulos! 🚀
