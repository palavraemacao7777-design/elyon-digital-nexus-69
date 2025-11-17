# 🔧 FIX: Erro 500 em create-member-user

## Problema
Ao adicionar novo membro via AdminMembers.tsx, função retornava **500 Internal Server Error**.

## Causa
- Env vars não eram validadas antes de usar
- JSON parsing não tinha try-catch
- selectedModules podia não ser array
- Exceções internas não capturadas em alguns fluxos

## Soluções Aplicadas

### 1. Validação de Variáveis de Ambiente
```typescript
// ANTES: Poderia falhar silenciosamente
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// DEPOIS: Com verificação e early return
if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing env vars...');
  return new Response(..., { status: 500 });
}
```

### 2. Tratamento de JSON Parsing
```typescript
// ANTES: Sem try-catch, falha 500 se JSON inválido
const bodyData = await req.json();

// DEPOIS: Com try-catch
try {
  bodyData = await req.json();
} catch (parseErr) {
  console.error('Error parsing JSON...');
  return new Response(..., { status: 400 });
}
```

### 3. Validação de Array selectedModules
```typescript
// ANTES: Poderia falhar se não for array
const accessInserts = selectedModules.map(...)

// DEPOIS: Com validação
let accessInserts: any[] = [];
if (selectedModules && Array.isArray(selectedModules)) {
  accessInserts = selectedModules.map(...)
}
```

### 4. Simplificação de Tratamento de Duplicate Email
- Removido try-catch aninhado externo que retornava 500
- Agora trata cada erro individualmente com warnings
- Se não conseguir recuperar user_id, retorna 409 (não 500)

## Arquivo Modificado
- `supabase/functions/create-member-user/index.ts` (50+ linhas)

## Deploy
```bash
cd /workspaces/elyon-digital-nexus-69
supabase functions deploy create-member-user
```

## Testes
```bash
# Teste 1: Usuário novo
curl -i -X POST https://jgmwbovvydimvnmmkfpy.supabase.co/functions/v1/create-member-user \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "João Silva",
    "email": "joao@example.com",
    "password": "SenhaForte123!",
    "memberAreaId": "area-123",
    "selectedModules": ["mod-1", "mod-2"],
    "isActive": true
  }'
# Esperado: 200 com { success: true, userId: "..." }

# Teste 2: Email duplicado
curl -i -X POST https://jgmwbovvydimvnmmkfpy.supabase.co/functions/v1/create-member-user \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "João Silva",
    "email": "joao@example.com",
    "password": "SenhaForte456!",
    "memberAreaId": "area-123",
    "selectedModules": ["mod-3"],
    "isActive": true
  }'
# Esperado: 200 com { success: true, userId: "...", recovered: true }
# (OU se fallback falhar: 409)
```

## Logs para Diagnosticar
```bash
supabase functions logs create-member-user --tail
```

Procure por:
- `EDGE_FUNCTION_DEBUG: create-member-user function started.`
- `EDGE_FUNCTION_DEBUG: Received data: { ... }`
- `EDGE_FUNCTION_DEBUG: User auth.users created with ID: ...`
- Se houver erro: `EDGE_FUNCTION_DEBUG: General error in create-member-user function:`

## Status
✅ Erro 500 tratado
✅ Env vars validadas
✅ JSON parsing seguro
✅ Duplicate email recovery implementado
✅ Array validação adicionada

---

**Próxima ação:** Fazer deploy e testar adicionar novo membro
