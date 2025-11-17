# 🚀 AÇÃO IMEDIATA: Deploy da Correção

## 🎯 Situação
Compradores **não estavam sendo cadastrados** na área de membros. **Problema identificado e corrigido.**

## ⚡ O Que Mudar

### O Problema
- ✅ `external_reference` estava usando `checkoutId` (incorreto)
- ✅ Webhook não processava múltiplos produtos

### A Solução
- ✅ `external_reference` agora usa `purchasedProductIds[0]`
- ✅ Webhook processa **CADA produto** individualmente

## 🚀 Deploy Agora (2 Funções)

```bash
cd /workspaces/elyon-digital-nexus-69

# 1. Deploy: create-mercado-pago-payment (ALTERADO)
supabase functions deploy create-mercado-pago-payment

# 2. Deploy: mercadopago-webhook (ALTERADO)
supabase functions deploy mercadopago-webhook
```

**Tempo total:** ~3 minutos

---

## 🧪 Validar Após Deploy

### Teste 1: Fazer novo pagamento
1. Abrir checkout
2. Selecionar 2+ produtos
3. Completar pagamento

### Teste 2: Verificar membros criados
1. Abrir Supabase Dashboard
2. Ir para "Membros" (ou sua área de membros)
3. Verificar que comprador apareceu

### Teste 3: Ver logs
1. Supabase Dashboard → Functions → mercadopago-webhook → Logs
2. Procurar por: `purchasedProductIds`
3. Verificar que cada produto foi processado

### Teste 4: Email recebido
- Comprador deve receber email com:
  - Login: email
  - Senha: enviada
  - Link de acesso

---

## 📋 Checklist Pós-Deploy

- [ ] Funções deployadas (supabase functions list)
- [ ] Novo pagamento testado
- [ ] Membro apareceu na área
- [ ] Email recebido
- [ ] Logs mostram "purchasedProductIds"
- [ ] Acesso ao produto funciona

---

## 💡 Se Algo Falhar

| Sintoma | Solução |
|---------|---------|
| Função não encontrada | Aguarde 30s e teste novamente (deploy pode estar propagando) |
| Membro não apareceu | Ver logs: `CREATE_MEMBER_FROM_PAYMENT: Erro...` |
| Email não recebido | Verificar função `send-deliverable-email` |
| Apenas 1 membro para 3 produtos | Novo webhook ainda não processando metadata (redeploy) |

---

## 📚 Documentação Completa

Ver: `CORREÇÃO_COMPRADORES_NÃO_CADASTRADOS.md` para detalhes técnicos

---

**Status:** ✅ Pronto para deploy  
**Próximo:** Execute os 2 comandos de deploy acima
