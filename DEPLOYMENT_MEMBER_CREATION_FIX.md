# 🚀 Guia de Deployment: Correção de Criação Automática de Membros

## 📋 Resumo Executivo

Este guia implementa a correção completa para criar membros automaticamente após pagamento aprovado no Mercado Pago. O problema raiz era a política RLS insuficiente na tabela `member_access`.

**O que foi consertado:**
1. ✅ RLS policy na tabela `member_access` (agora permite INSERT/UPDATE para service_role)
2. ✅ Função centralizada `create-member-from-payment` (com logging completo)
3. ✅ Webhook `mercadopago-webhook` (agora invoca a função centralizada)
4. ✅ Logging em todo o fluxo (WEBHOOK_DEBUG + CREATE_MEMBER_FROM_PAYMENT)

**Resultado esperado:**
```
Pagamento aprovado → Webhook ativado → Member criado automaticamente → Email enviado com credenciais
```

---

## 📦 Arquivos Envolvidos

| Arquivo | Tipo | Status | Descrição |
|---------|------|--------|-----------|
| `supabase/migrations/20251117_fix_member_access_rls.sql` | Migration | ✅ Pronto | Fixa RLS em member_access |
| `supabase/functions/create-member-from-payment/index.ts` | Edge Function | ✅ Pronto | Função centralizada com logging |
| `supabase/functions/mercadopago-webhook/index.ts` | Edge Function | ✅ Atualizado | Invoca create-member-from-payment |
| `TEST_MEMBER_CREATION_FLOW.md` | Testes | ✅ Pronto | Testes e validações |

---

## 🔧 Passo 1: Aplicar Migração RLS

**Problema Identificado:**
- Tabela `member_access` tinha RLS policy apenas para SELECT
- Service role não conseguia fazer INSERT/UPDATE (bloqueava member provisioning)

### Opção A: Via Supabase Dashboard (Recomendado)

1. Abrir **Supabase Dashboard** → Seu Projeto
2. Ir para **SQL Editor**
3. Criar nova query
4. Copiar conteúdo de: `supabase/migrations/20251117_fix_member_access_rls.sql`
5. Clicar em **Run** (ou `Ctrl+Enter`)
6. Validar sucesso na saída

### Opção B: Via supabase-cli

```bash
# Do diretório raiz do projeto
cd /workspaces/elyon-digital-nexus-69

# Aplicar migração
supabase db pull  # Sincronizar schemas
supabase migration up --password <PASSWORD> --db-url postgresql://...
```

### Opção C: Via psql direto

```bash
# Conectar ao banco Supabase
psql postgresql://postgres:PASSWORD@db.supabase.co/postgres

# Copiar e colar conteúdo da migração
\i supabase/migrations/20251117_fix_member_access_rls.sql

# Ou executar linha por linha a partir de: supabase/migrations/20251117_fix_member_access_rls.sql
```

### Validação Pós-Migração

```sql
-- Conectar ao psql
psql postgresql://postgres:PASSWORD@db.supabase.co/postgres

-- Verificar se policies foram criadas
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename = 'member_access';

-- Esperado output:
-- ┌───────────┬──────────────────┬──────────────────────────────────────────────┐
-- │ schemaname│   tablename      │              policyname                      │
-- ├───────────┼──────────────────┼──────────────────────────────────────────────┤
-- │ public    │ member_access    │ Members can view their own access            │
-- │ public    │ member_access    │ Service role manages all member_access       │
-- └───────────┴──────────────────┴──────────────────────────────────────────────┘

-- Testar INSERT como service_role (deve funcionar)
SET ROLE service_role;
INSERT INTO member_access (member_id, product_id, member_area_id) 
VALUES ('test-id', 'test-prod', 'test-area');
-- Se funcionar: ✅ Migration sucesso
-- Se falhar com "policy": ❌ RLS ainda bloqueando (re-aplicar migração)
```

---

## 🎯 Passo 2: Redeploy das Edge Functions

### Opção A: Via supabase-cli (Recomendado)

```bash
cd /workspaces/elyon-digital-nexus-69

# Deploy da nova função centralizada
supabase functions deploy create-member-from-payment

# Deploy do webhook atualizado
supabase functions deploy mercadopago-webhook

# Validar deployments
supabase functions list
```

### Opção B: Via Supabase Dashboard

1. Dashboard → Functions
2. Procurar por `create-member-from-payment`
   - Verificar se existe
   - Se não: clicar **New Function** → copiar código de `supabase/functions/create-member-from-payment/index.ts`
3. Procurar por `mercadopago-webhook`
   - Clicar em **Edit**
   - Copiar código atualizado de `supabase/functions/mercadopago-webhook/index.ts`
   - Clicar **Deploy**

### Opção C: Via Deno Deploy (se usando esse serviço)

```bash
deployctl deploy --project=seu-projeto \
  supabase/functions/create-member-from-payment/index.ts \
  supabase/functions/mercadopago-webhook/index.ts
```

### Validação Pós-Deploy

```bash
# Verificar se função foi deployada
curl -X POST "https://seu-project.supabase.co/functions/v1/create-member-from-payment" \
  -H "Authorization: Bearer seu-service-role-key" \
  -d '{"email":"test@example.com","name":"Test","product_id":"invalid","payment_id":"1","checkout_id":"1"}' \
  2>&1 | jq .

# Esperado: erro de "Product not found" (não erro de função não encontrada)
```

---

## 📊 Passo 3: Executar Testes

Consulte `TEST_MEMBER_CREATION_FLOW.md` para:

### Teste 1: Função Isolada
```bash
./run_member_creation_tests.sh  # Se criou o script
# Ou executar manualmente os comandos curl do Teste 1️⃣
```

### Teste 2: Webhook
```bash
# Simular webhook com payment.approved
# Ver comandos em TEST_MEMBER_CREATION_FLOW.md - Teste 2️⃣
```

### Teste 3: Validação End-to-End
- Abrir Dashboard Supabase
- Procurar membro criado
- Verificar member_access
- Teste manual de login

---

## 📝 Passo 4: Verificar Logs

### Ver Logs em Tempo Real

**Via Supabase Dashboard:**
1. Ir para **Functions**
2. Clicar em **create-member-from-payment** → **Logs**
3. Filtra por: `CREATE_MEMBER_FROM_PAYMENT`

**Via Supabase Dashboard (Webhook):**
1. Ir para **Functions**
2. Clicar em **mercadopago-webhook** → **Logs**
3. Filtra por: `WEBHOOK_DEBUG`

### Logs Esperados (Sucesso)

```
[Webhook]
WEBHOOK_DEBUG: Webhook recebido, type: payment, action: payment.created, payment_id: 12345
WEBHOOK_DEBUG: Raw webhook body: {...}
WEBHOOK_DEBUG: Buscando detalhes do pagamento na API MP: 12345
WEBHOOK_DEBUG: Payment details retrieved: {id: 12345, status: "approved", email: "cliente@example.com", ...}
✅ WEBHOOK_DEBUG: Payment approved! Status: approved
👤 WEBHOOK_DEBUG: Dados do cliente extraídos: {email: "cliente@example.com", nome: "Cliente X", ...}
🛍️ WEBHOOK_DEBUG: Product ID extraído: 11111111-1111-1111-1111-111111111111

[Member Creation Function]
🎯 CREATE_MEMBER_FROM_PAYMENT: Iniciando criação automática
1️⃣ CREATE_MEMBER_FROM_PAYMENT: Buscando produto e member_area_id
2️⃣ CREATE_MEMBER_FROM_PAYMENT: Buscando configuração de password
3️⃣ CREATE_MEMBER_FROM_PAYMENT: Verificando se membro já existe
4️⃣ CREATE_MEMBER_FROM_PAYMENT: Criando/Recuperando usuário auth
5️⃣ CREATE_MEMBER_FROM_PAYMENT: Criando membro com password_hash
6️⃣ CREATE_MEMBER_FROM_PAYMENT: Criando member_access
✅ CREATE_MEMBER_FROM_PAYMENT: Membro criado com sucesso! {memberId: "44444444...", userId: "55555555...", ...}
🎉 CREATE_MEMBER_FROM_PAYMENT: Membro cadastrado com sucesso com sucesso!
```

### Logs de Erro (Diagnóstico)

| Log | Causa | Solução |
|-----|-------|---------|
| `❌ RLS policy issue` | Migração não aplicada | Executar Passo 1 novamente |
| `❌ Product not found` | ID do produto inválido | Verificar `product_id` no checkout |
| `❌ Member area not found` | Produto não vinculado a area | Verificar `products.member_area_id` |
| `❌ Failed to create auth user` | Email já existe em auth | Usar email único para teste |
| `❌ Service role unauthorized` | Webhook deploy errado | Redeploy webhook (Passo 2) |

---

## ✅ Passo 5: Validação Final (Checklist)

- [ ] Migração RLS foi aplicada (verificar com `SELECT * FROM pg_policies WHERE tablename = 'member_access'`)
- [ ] Edge Function `create-member-from-payment` está deployada
- [ ] Edge Function `mercadopago-webhook` está deployada com novo código
- [ ] Teste 1 (função isolada) passou ✅
- [ ] Teste 2 (webhook simulado) passou ✅
- [ ] Logs mostram "CREATE_MEMBER_FROM_PAYMENT: Membro criado com sucesso" ✅
- [ ] Membro aparece em Supabase Dashboard → `members` table ✅
- [ ] Member_access foi criado em Supabase Dashboard → `member_access` table ✅
- [ ] Membro recebeu email com credenciais ✅
- [ ] Membro consegue fazer login ✅

---

## 🔄 Rollback (Se Necessário)

### Remover Migração RLS

```sql
-- Voltar ao estado anterior (SELECT-only policy)
DROP POLICY IF EXISTS "Members can view their own access" ON public.member_access;
DROP POLICY IF EXISTS "Service role manages all member_access" ON public.member_access;

CREATE POLICY "Service role can manage member_access" ON public.member_access
  FOR ALL TO service_role
  USING (true);
  
CREATE POLICY "Members can view their own access" ON public.member_access
  FOR SELECT TO authenticated
  USING (member_id IN (SELECT id FROM members WHERE user_id = auth.uid()));
```

### Voltar ao Webhook Antigo

```bash
# Via git (se repositório)
git checkout HEAD~1 -- supabase/functions/mercadopago-webhook/index.ts

# Redeploy
supabase functions deploy mercadopago-webhook
```

---

## 📞 Troubleshooting & FAQ

### P: Migração falha com "policy already exists"
**R:** Alguma policy anterior não foi removida. Execute:
```sql
DROP POLICY IF EXISTS "Members can view their own access" ON public.member_access;
DROP POLICY IF EXISTS "Service role manages all member_access" ON public.member_access;
DROP POLICY IF EXISTS "Service role can manage member_access" ON public.member_access;
-- Depois execute a migração novamente
```

### P: Webhook não cria membro mesmo com status approved
**R:** Verificar:
1. RLS foi aplicada? → `SELECT * FROM pg_policies WHERE tablename = 'member_access'`
2. Função foi deployada? → Supabase Dashboard → Functions
3. Logs mostram erro? → Ver Passo 4

### P: Erro "Service role unauthorized"
**R:** Webhook service_role key está incorreta ou não tem acesso. Verificar:
```bash
# No Supabase Dashboard → Project Settings → API
# Copiar NOVO "service_role key" e reconfigurar webhook
```

### P: Member criado mas sem email de credenciais
**R:** Verificar função `send-deliverable-email`:
```bash
# Supabase Dashboard → Functions → send-deliverable-email → Logs
```

---

## 📚 Referência Rápida

```bash
# Ambiente
export SUPABASE_URL="https://seu-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="sua-chave"

# Aplicar Migração
cat supabase/migrations/20251117_fix_member_access_rls.sql | \
  psql postgresql://postgres:PASSWORD@db.supabase.co/postgres

# Redeploy Functions
supabase functions deploy create-member-from-payment
supabase functions deploy mercadopago-webhook

# Testar
curl -X POST "${SUPABASE_URL}/functions/v1/create-member-from-payment" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -d '{"email":"test@example.com","name":"Test","product_id":"id","payment_id":"1","checkout_id":"1"}' | jq .

# Ver Logs
# Supabase Dashboard → Functions → [function-name] → Logs
# Filtrar por: "CREATE_MEMBER_FROM_PAYMENT" ou "WEBHOOK_DEBUG"
```

---

## 🎉 Próximas Etapas

Após confirmar tudo funcionando:

1. ✅ Documentar no Wiki/Confluence
2. ✅ Criar testes automatizados (GitHub Actions)
3. ✅ Monitorar logs em produção por 24h
4. ✅ Preparar runbook de troubleshooting para time

---

## 📞 Contato & Suporte

Se precisar de ajuda:
- Verificar `TEST_MEMBER_CREATION_FLOW.md` para mais testes
- Consultar logs em Supabase Dashboard
- Verificar se migração RLS foi aplicada
- Validar que functions foram deployadas

**Pronto! 🚀 Membros devem ser criados automaticamente após pagamento aprovado.**
