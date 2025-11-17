# 🧪 Testes: Fluxo de Criação Automática de Membros

## Contexto
Este documento contém os testes para validar que membros são criados automaticamente após pagamento aprovado no Mercado Pago.

**Pré-requisitos:**
1. ✅ Aplicar migração RLS: `supabase/migrations/20251117_fix_member_access_rls.sql`
2. ✅ Redeploy das Edge Functions: `create-member-from-payment` e `mercadopago-webhook`
3. ✅ Ter credenciais Supabase (URL, Service Role Key)
4. ✅ Ter IDs de teste (product_id, member_area_id)

---

## Variáveis de Ambiente (Substitua com seus dados)

```bash
# Supabase
export SUPABASE_URL="https://seu-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="seu-service-role-key"
export SUPABASE_PROJECT_ID="seu-project-id"

# Mercado Pago (para buscar payment_id real)
export MERCADO_PAGO_ACCESS_TOKEN="seu-access-token"

# IDs de Teste
export TEST_PRODUCT_ID="11111111-1111-1111-1111-111111111111"  # UUID do produto
export TEST_MEMBER_AREA_ID="22222222-2222-2222-2222-222222222222"  # UUID da área de membros
export TEST_USER_ID="33333333-3333-3333-3333-333333333333"  # UUID do usuario seller

# Dados de Teste
export TEST_EMAIL="membro-teste-$(date +%s)@example.com"
export TEST_NAME="Membro Teste $(date +%s)"
export TEST_PAYMENT_ID="123456789"  # ID de pagamento Mercado Pago (será substituído)
```

---

## Teste 1️⃣: Função `create-member-from-payment` (Isolada)

### Descrição
Testa a função de criação de membro de forma isolada, sem passar pelo webhook.

### Comando
```bash
curl -X POST "${SUPABASE_URL}/functions/v1/create-member-from-payment" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"${TEST_EMAIL}\",
    \"name\": \"${TEST_NAME}\",
    \"product_id\": \"${TEST_PRODUCT_ID}\",
    \"payment_id\": \"${TEST_PAYMENT_ID}\",
    \"checkout_id\": \"checkout-test-$(date +%s)\"
  }" | jq .
```

### Resultado Esperado
```json
{
  "success": true,
  "memberId": "44444444-4444-4444-4444-444444444444",
  "userId": "55555555-5555-5555-5555-555555555555",
  "email": "membro-teste-1234567890@example.com",
  "memberAreaId": "22222222-2222-2222-2222-222222222222",
  "productId": "11111111-1111-1111-1111-111111111111",
  "message": "🎉 CREATE_MEMBER_FROM_PAYMENT: Membro cadastrado com sucesso!"
}
```

### Validação Pós-Teste
```bash
# 1️⃣ Verificar se membro foi criado
curl -s "${SUPABASE_URL}/rest/v1/members?email=eq.${TEST_EMAIL}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" | jq .

# 2️⃣ Verificar se member_access foi criado
curl -s "${SUPABASE_URL}/rest/v1/member_access?member_id=eq.44444444-4444-4444-4444-444444444444" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" | jq .

# 3️⃣ Verificar usuário auth foi criado
psql postgresql://postgres:PASSWORD@db.supabase.co/postgres -c \
  "SELECT id, email FROM auth.users WHERE email = '${TEST_EMAIL}';"
```

---

## Teste 2️⃣: Webhook Mercado Pago (payment.approved)

### Descrição
Simula um webhook real do Mercado Pago quando um pagamento é aprovado.

### Payload Mercado Pago (Webhook)
```json
{
  "id": "12345678901",
  "live_mode": true,
  "type": "payment",
  "date_created": "2025-01-15T10:30:00.000-04:00",
  "user_id": "444444",
  "api_version": "v1",
  "action": "payment.created",
  "data": {
    "id": 9999999999
  }
}
```

### Comando Curl
```bash
# Buscar um payment_id real (últimos 5 pagamentos)
PAYMENT_ID=$(curl -s "https://api.mercadopago.com/v1/payments/search?limit=1" \
  -H "Authorization: Bearer ${MERCADO_PAGO_ACCESS_TOKEN}" | jq -r '.results[0].id')

echo "Usando payment_id real: ${PAYMENT_ID}"

# Simular webhook
curl -X POST "${SUPABASE_URL}/functions/v1/mercadopago-webhook" \
  -H "Content-Type: application/json" \
  -H "x-webhook-id: webhook-test-$(date +%s)" \
  -H "x-webhook-timestamp: $(date -u +%s)000" \
  -H "x-webhook-signature: invalid-sig-test" \
  -d "{
    \"id\": \"${PAYMENT_ID}\",
    \"live_mode\": true,
    \"type\": \"payment\",
    \"date_created\": \"$(date -u +%Y-%m-%dT%H:%M:%S.000-04:00)\",
    \"user_id\": \"444444\",
    \"api_version\": \"v1\",
    \"action\": \"payment.created\",
    \"data\": {
      \"id\": ${PAYMENT_ID}
    }
  }" | jq .
```

### Resultado Esperado
```json
{
  "statusCode": 200,
  "message": "Webhook processado com sucesso"
}
```

### Logs a Verificar (Supabase Functions UI)
1. ✅ `WEBHOOK_DEBUG: Webhook recebido...` (event type, action, payment ID)
2. ✅ `WEBHOOK_DEBUG: Buscando detalhes do pagamento na API MP`
3. ✅ `WEBHOOK_DEBUG: Payment details retrieved` (id, status, email, external_reference)
4. ✅ `✅ WEBHOOK_DEBUG: Payment approved!`
5. ✅ `👤 WEBHOOK_DEBUG: Dados do cliente extraídos` (email, nome, telefone, documento)
6. ✅ `🛍️ WEBHOOK_DEBUG: Product ID extraído`
7. ✅ `🎯 CREATE_MEMBER_FROM_PAYMENT: Iniciando criação automática`
8. ✅ `✅ CREATE_MEMBER_FROM_PAYMENT: Membro criado com sucesso!` (memberId, userId, email)

---

## Teste 3️⃣: Validação End-to-End (Dashboard)

### Checklist Pós-Webhook
- [ ] Abrir Supabase Dashboard → Tabela `members`
  - Buscar por email de teste
  - Verificar campos: `id`, `user_id`, `name`, `email`, `password_hash`, `created_at`

- [ ] Abrir Supabase Dashboard → Tabela `member_access`
  - Buscar por `member_id` do membro criado
  - Verificar campos: `product_id`, `member_area_id`, `access_granted_at`

- [ ] Abrir Supabase Dashboard → Auth Users
  - Buscar usuário por email
  - Verificar: `id`, `email`, `created_at`

- [ ] Abrir Supabase Dashboard → Tabela `compras`
  - Buscar por `cliente_email`
  - Verificar: `status_pagamento = 'approved'`, `mercadopago_payment_id`

### Teste Manual (Plataforma)
- [ ] Acessar checkout com produto vinculado
- [ ] Completar pagamento no Mercado Pago
- [ ] Aguardar 2-5 segundos
- [ ] Verificar email de confirmação recebido com credenciais
- [ ] Fazer login como novo membro
- [ ] Validar acesso ao produto na área de membros

---

## Teste 4️⃣: Testes de Erro (Validação RLS)

### 4.1 Verificar se RLS permite INSERT em member_access
```bash
# Conectar ao Supabase Postgres como service_role (via psql)
psql "postgresql://postgres:PASSWORD@db.supabase.co/postgres" \
  -c "SET ROLE service_role; INSERT INTO member_access (member_id, product_id, member_area_id) VALUES ('test-id-1', 'test-id-2', 'test-id-3');"
```

**Esperado:** Inserção bem-sucedida ou erro de constraint (não erro de RLS "policy")

### 4.2 Validar Policy de SELECT (membros veem seu próprio acesso)
```bash
# Conectar como authenticated user (com JWT válido)
curl -s "${SUPABASE_URL}/rest/v1/member_access" \
  -H "Authorization: Bearer ${USER_JWT_TOKEN}" \
  -H "apikey: ${ANON_KEY}" | jq '.[] | select(.member_id == "SEU_MEMBER_ID")'
```

**Esperado:** Retorna `member_access` do usuário autenticado

### 4.3 Validar que função pode criar membro sem erro RLS
```bash
# Simular invocação da função com dados mínimos
curl -X POST "${SUPABASE_URL}/functions/v1/create-member-from-payment" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@error.com","name":"Error Test","product_id":"invalid-id","payment_id":"1","checkout_id":"1"}' \
  2>&1 | grep -i "policy\|rls\|permission" && echo "❌ RLS BLOCKER DETECTED" || echo "✅ No RLS error"
```

**Esperado:** Erro de validation (produto não encontrado), não erro de RLS

---

## Script Completo (Bash)

Salve como `run_member_creation_tests.sh`:

```bash
#!/bin/bash
set -e

# Cores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}🧪 Iniciando testes de criação automática de membros...${NC}\n"

# 1️⃣ Teste direto da função
echo -e "${YELLOW}[Teste 1] Testando create-member-from-payment (isolada)...${NC}"
TEST_EMAIL="membro-teste-$(date +%s)@example.com"
RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/functions/v1/create-member-from-payment" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"${TEST_EMAIL}\",
    \"name\": \"Membro Teste $(date +%s)\",
    \"product_id\": \"${TEST_PRODUCT_ID}\",
    \"payment_id\": \"test-123\",
    \"checkout_id\": \"checkout-test-$(date +%s)\"
  }")

if echo "$RESPONSE" | jq -e '.success == true' > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Função create-member-from-payment funcionando!${NC}"
  MEMBER_ID=$(echo "$RESPONSE" | jq -r '.memberId')
  echo "   Membro criado: $MEMBER_ID"
else
  echo -e "${RED}❌ Erro ao criar membro:${NC}"
  echo "$RESPONSE" | jq .
  exit 1
fi

# 2️⃣ Verificar membro no banco
echo -e "\n${YELLOW}[Validação] Verificando membro no banco de dados...${NC}"
MEMBER=$(curl -s "${SUPABASE_URL}/rest/v1/members?email=eq.${TEST_EMAIL}&limit=1" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json")

if echo "$MEMBER" | jq -e '.[0].id' > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Membro encontrado no banco!${NC}"
  echo "$MEMBER" | jq '.[0] | {id, name, email, created_at}'
else
  echo -e "${RED}❌ Membro não encontrado no banco${NC}"
  exit 1
fi

# 3️⃣ Verificar member_access
echo -e "\n${YELLOW}[Validação] Verificando member_access...${NC}"
MEMBER_ACCESS=$(curl -s "${SUPABASE_URL}/rest/v1/member_access?member_id=eq.${MEMBER_ID}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json")

if echo "$MEMBER_ACCESS" | jq -e '.[0].id' > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Member_access criado!${NC}"
  echo "$MEMBER_ACCESS" | jq '.[0] | {member_id, product_id, member_area_id}'
else
  echo -e "${RED}❌ Member_access não encontrado${NC}"
  exit 1
fi

echo -e "\n${GREEN}🎉 TODOS OS TESTES PASSARAM!${NC}"
echo -e "${GREEN}Membro criado automaticamente com sucesso!${NC}\n"
```

**Executar:**
```bash
chmod +x run_member_creation_tests.sh
./run_member_creation_tests.sh
```

---

## Próximos Passos

1. **Aplicar Migração RLS**
   ```bash
   # No Supabase Dashboard → SQL Editor
   # Copiar e executar conteúdo de: supabase/migrations/20251117_fix_member_access_rls.sql
   ```

2. **Redeploy Edge Functions**
   ```bash
   supabase functions deploy create-member-from-payment
   supabase functions deploy mercadopago-webhook
   ```

3. **Executar Testes**
   ```bash
   ./run_member_creation_tests.sh
   ```

4. **Monitorar Logs**
   ```
   Supabase Dashboard → Functions → View Logs
   Filtrar por: "WEBHOOK_DEBUG" ou "CREATE_MEMBER_FROM_PAYMENT"
   ```

---

## Troubleshooting

### ❌ Erro: "RLS policy issue"
**Solução:** Aplicar migração RLS
```bash
# Supabase SQL Editor
\i supabase/migrations/20251117_fix_member_access_rls.sql
```

### ❌ Erro: "Product not found"
**Solução:** Verificar se `TEST_PRODUCT_ID` existe
```bash
curl "${SUPABASE_URL}/rest/v1/products?id=eq.${TEST_PRODUCT_ID}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}"
```

### ❌ Erro: "Member area not found"
**Solução:** Verificar relação `product.member_area_id`
```bash
curl "${SUPABASE_URL}/rest/v1/products?id=eq.${TEST_PRODUCT_ID}&select=id,member_area_id" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}"
```

### ⏳ Webhook não dispara member creation
**Solução:** Verificar logs da função webhook
```
Supabase Dashboard → Functions → mercadopago-webhook → Logs
Buscar por: "CREATE_MEMBER_FROM_PAYMENT"
```

---

## Resumo de Sucesso ✅

Quando tudo funciona corretamente, você deve ver:

1. **Função cria membro isoladamente** ✅
2. **Membro aparece no banco com password_hash** ✅
3. **Member_access é criado automaticamente** ✅
4. **RLS permite INSERT/UPDATE/SELECT sem erros** ✅
5. **Webhook processa pagamentos aprovados** ✅
6. **Logs mostram fluxo completo com WEBHOOK_DEBUG e CREATE_MEMBER_FROM_PAYMENT** ✅
7. **Membro recebe email com credenciais** ✅
8. **Membro consegue fazer login na área de membros** ✅

**Log final esperado:**
```
✅ CREATE_MEMBER_FROM_PAYMENT: Membro criado com sucesso!
🎉 CREATE_MEMBER_FROM_PAYMENT: Membro cadastrado com sucesso com sucesso!
```
