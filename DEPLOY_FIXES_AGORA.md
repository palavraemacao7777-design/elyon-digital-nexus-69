# 🚀 DEPLOY AGORA: Correção de Erros Críticos

## 🔴 CRÍTICA: 3 Problemas Identificados e Corrigidos

### ❌ Erro 1: `email_exists` - Email já cadastrado  
**Log:** `A user with this email address has already been registered`  
**Solução:** Recuperar user_id existente + criar member linkado

### ❌ Erro 2: `external_reference` = checkoutId (deve ser product_id)
**Solução:** Usar `purchasedProductIds[0]` + metadata com todos os produtos

### ❌ Erro 3: Webhook não processa múltiplos produtos
**Solução:** Loop para processar CADA produto individualmente + retry inteligente

---

## 🚀 Deploy (3 Functions)

```bash
cd /workspaces/elyon-digital-nexus-69

# Priority 1: Fix email_exists + recuperação
supabase functions deploy create-member-from-payment

# Priority 2: Fix retry + múltiplos produtos
supabase functions deploy mercadopago-webhook

# Priority 3: Fix external_reference
supabase functions deploy create-mercado-pago-payment
```

**Tempo:** ~5 minutos total

---

## ✅ O Que Foi Corrigido

### create-member-from-payment
- ✅ Se email existe → Recupera user_id (profiles ou admin API)
- ✅ Se recupera → Cria member linkado
- ✅ Se falha 2x → Loga erro permanente

### mercadopago-webhook
- ✅ Extrai `purchased_product_ids` do metadata
- ✅ Loop para processar CADA produto
- ✅ Retry 1x com delay de 2s (se falhar na 1ª)
- ✅ Logs rastreiam tentativas

### create-mercado-pago-payment
- ✅ `external_reference` = purchasedProductIds[0]
- ✅ `metadata.purchased_product_ids` = [ALL]
- ✅ `metadata.checkout_id` preservado

---

## 🧪 Testes Pós-Deploy

### Teste 1: Email Novo
```
Pagamento com email novo
→ ✅ Cria auth user
→ ✅ Cria member
```

### Teste 2: Email Já Existe (IMPORTANTE!)
```
Pagamento 1 com email@example.com
→ ✅ Cria auth user + member

Pagamento 2 com MESMO email@example.com
→ Tenta criar auth user → Falha (email_exists)
→ Recupera user_id existente
→ ✅ Cria novo member para novo produto
```

### Teste 3: 2+ Produtos Uma Vez
```
Comprador compra [Produto A] + [Produto B]
→ ✅ Cria member A
→ ✅ Cria member B
```

---

## 📋 Checklist Pós-Deploy

- [ ] Funções deployadas
- [ ] Teste 1: Email novo ✅
- [ ] Teste 2: Email existe (mesmo email 2x) ✅
- [ ] Teste 3: 2+ produtos ✅
- [ ] Dashboard: Múltiplos membros aparecem
- [ ] Email: Credenciais enviadas

---

## 💡 Troubleshooting

| Log | Significado | Ação |
|-----|-----------|------|
| `email_exists` | Email já em auth | ✅ Esperado, função recupera |
| `user_id recuperado` | Sucesso retry | ✅ Membro criado |
| `Aguardando 2s antes de retry` | 1ª tentativa falhou | ✅ Aguardando próxima tentativa |
| `Falha permanente` | 2x falhou | ❌ Ver logs para erro |

---

## 📚 Documentação

- `FIX_EMAIL_EXISTS_ERROR.md` - Detalhes técnicos do fix
- `CORREÇÃO_COMPRADORES_NÃO_CADASTRADOS.md` - Contexto anterior

---

**Status:** ✅ Pronto  
**Próximo:** Execute os 3 deploys acima  
**Validação:** Faça Teste 2 (mesmo email 2x) para confirmar fix  
