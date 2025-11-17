# 🚨 DEPLOY URGENTE - Membros não estão sendo criados

## Problema Identificado
As funções foram **criadas localmente** mas **NÃO foram deployadas para o Supabase remoto**.

Quando um pagamento é aprovado no Mercado Pago:
1. ✅ Webhook recebe o evento
2. ❌ Tenta invocar `create-member-from-payment` (mas ela não existe remotamente!)
3. ❌ Nenhum membro é criado
4. ❌ Cliente não recebe credenciais

## Solução: Deploy das 3 funções

### Pré-requisito: Instalar Supabase CLI
```bash
npm install -g supabase@latest
# OU
curl -fsSL https://raw.githubusercontent.com/supabase/cli/main/install.sh | bash
```

### Deploy das funções (escolha um método):

#### Opção 1: Via Supabase CLI (RECOMENDADO)
```bash
cd /workspaces/elyon-digital-nexus-69

# Fazer login no Supabase
supabase login

# Deploy de cada função
supabase functions deploy create-member-from-payment
supabase functions deploy mercadopago-webhook
supabase functions deploy create-mercado-pago-payment
supabase functions deploy retroactive-member-provision
```

#### Opção 2: Via Vercel (para Edge Functions)
Se você usa Vercel para deploy das funções:
```bash
vercel deploy --prod
```

#### Opção 3: Via Dashboard Supabase
1. Ir para: https://app.supabase.com → seu projeto → Edge Functions
2. Fazer upload manual de cada função
3. Ou fazer push do git e Supabase auto-deploy

## Funções a Deployar

### 1. `create-member-from-payment` (CRÍTICA)
- **Arquivo:** `supabase/functions/create-member-from-payment/index.ts`
- **Propósito:** Criar membro + auth user + member_access após pagamento
- **Status:** 214 linhas, production-ready, com email_exists error recovery

### 2. `mercadopago-webhook` (CRÍTICA)
- **Arquivo:** `supabase/functions/mercadopago-webhook/index.ts`
- **Propósito:** Receber notificações de pagamento do Mercado Pago
- **Status:** 570 linhas, com retry logic + múltiplos produtos

### 3. `create-mercado-pago-payment` (CRÍTICA)
- **Arquivo:** `supabase/functions/create-mercado-pago-payment/index.ts`
- **Propósito:** Criar pagamento no Mercado Pago com product_id correto
- **Status:** 470 linhas, external_reference FIXED

### 4. `retroactive-member-provision` (AUXILIAR)
- **Arquivo:** `supabase/functions/retroactive-member-provision/index.ts`
- **Propósito:** Criar membros retroativamente para compras antigas
- **Status:** Novo, para backfill de dados

## Verificação Pós-Deploy

```bash
# Ver logs da função
supabase functions logs create-member-from-payment

# Testar invocação
curl -i --location --request POST 'https://your-project.supabase.co/functions/v1/create-member-from-payment' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"email":"test@example.com","name":"Test User","product_id":"prod-123","payment_id":"payment-456","checkout_id":"checkout-789"}'
```

## Timeline Esperado

| Passo | Tempo |
|-------|-------|
| Deploy 3 funções | 5-10 min |
| Verificar logs | 2-5 min |
| Testar com novo pagamento | 1-5 min |
| **Membros começam a ser criados** | ✅ IMEDIATO |

## Próximas Ações Após Deploy

1. ✅ Deployar 3 funções
2. ✅ Fazer pagamento de teste
3. ✅ Verificar logs: `WEBHOOK_DEBUG: Payment approved!`
4. ✅ Rodar `retroactive-member-provision` para criar membros de compras antigas
5. ✅ Confirmar que membros aparecem na área de membros

---

**Por que não foi feito antes?**
- As funções foram atualizadas localmente mas não sincronizadas com Supabase remoto
- Precisavas de deploy manual para ativar

**Próximo passo:**
Execute o comando de deploy acima! 🚀
