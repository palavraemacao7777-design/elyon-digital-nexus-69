# 🚀 COMO DEPLOYAR AS FUNÇÕES - GUIA COMPLETO

## 🎯 O PROBLEMA

A imagem mostra **1 membro** na área de membros, mas você comprou **múltiplos produtos**.

### Por que?
As Edge Functions foram **atualizadas localmente** mas **não foram deployadas no Supabase remoto**.

Quando acontece um pagamento aprovado:
```
1. Mercado Pago webhook → seu servidor
2. Webhook tenta invocar 'create-member-from-payment' 
3. ❌ ERRO: Função não existe remotamente
4. ❌ Membro não é criado
5. ❌ Cliente não recebe credenciais
```

---

## ✅ SOLUÇÃO: FAZER DEPLOY

### 🔧 Opção 1: Via Supabase CLI (RECOMENDADO) ⭐

#### Passo 1: Instalar Supabase CLI

**MacOS:**
```bash
brew install supabase/tap/supabase
```

**Ubuntu/Debian:**
```bash
sudo snap install --classic supabase
# OU
sudo apt-get install supabase
```

**Windows (WSL):**
```bash
choco install supabase
# OU
scoop install supabase
```

**Outra plataforma:** https://github.com/supabase/cli#install-the-cli

#### Passo 2: Fazer Login

```bash
supabase login
# Será aberto uma aba do navegador para autenticação
```

#### Passo 3: Deploy das 4 Funções

```bash
cd /workspaces/elyon-digital-nexus-69

# Fazer deploy de cada função
supabase functions deploy create-member-from-payment
supabase functions deploy mercadopago-webhook
supabase functions deploy create-mercado-pago-payment
supabase functions deploy retroactive-member-provision
```

**Esperado:**
```
✓ Created Edge Function: create-member-from-payment
✓ Created Edge Function: mercadopago-webhook
✓ Created Edge Function: create-mercado-pago-payment
✓ Created Edge Function: retroactive-member-provision
```

---

### 📱 Opção 2: Via Dashboard Supabase

1. Abrir: https://app.supabase.com
2. Selecionar seu projeto
3. Ir para: **Edge Functions** (menu esquerdo)
4. Para cada função:
   - Clicar **"Create new function"** OU selecionar função existente
   - Colar o código de: `supabase/functions/[nome]/index.ts`
   - Clicar **Deploy**

#### Funções a fazer upload:
- `supabase/functions/create-member-from-payment/index.ts`
- `supabase/functions/mercadopago-webhook/index.ts`
- `supabase/functions/create-mercado-pago-payment/index.ts`
- `supabase/functions/retroactive-member-provision/index.ts`

---

### 🚀 Opção 3: Via GitHub + Supabase (AUTO-DEPLOY)

Se seu repositório está conectado ao Supabase:

```bash
git add supabase/functions/
git commit -m "Deploy edge functions"
git push origin main
# Supabase fará auto-deploy
```

---

### ⚡ Opção 4: Via Vercel (Se usar Vercel)

Se as funções estão em `/api/` (Vercel Functions):

```bash
cd /workspaces/elyon-digital-nexus-69
vercel deploy --prod
```

---

## ✔️ VERIFICAR DEPLOY

### Após fazer deploy, verificar:

#### Via CLI:
```bash
# Listar todas as funções
supabase functions list

# Ver logs em tempo real
supabase functions logs create-member-from-payment --tail

# Ou específico:
supabase functions logs mercadopago-webhook --tail
```

#### Via Dashboard:
1. https://app.supabase.com → seu projeto
2. **Edge Functions** → Clicar em cada função
3. Ver aba **"Logs"** para ver execuções recentes

---

## 🧪 TESTAR APÓS DEPLOY

### Teste 1: Fazer pagamento de teste

1. Ir ao checkout: `https://www.elyondigital.com.br/checkout`
2. Usar credenciais de teste do Mercado Pago:
   ```
   Email: test_user_123456789@testuser.com
   Cartão: 4111 1111 1111 1111
   Validade: 11/25
   CVV: 123
   ```
3. Completar compra
4. **VERIFICAR:**
   - Email recebido com credenciais? ✅
   - Membro aparece em Área de Membros? ✅
   - Consegue fazer login? ✅

### Teste 2: Criar membros de compras antigas

Se tem compras anteriores sem membros, rodar:

```bash
curl -i --location --request POST \
  'https://jgmwbovvydimvnmmkfpy.supabase.co/functions/v1/retroactive-member-provision' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json'
```

(Substituir `YOUR_ANON_KEY` pela sua chave anon do Supabase)

**Esperado:**
```json
{
  "success": true,
  "processados": 5,
  "criados": 5,
  "erros": 0,
  "resumo": "5 membros criados/atualizados, 0 erros, 0 já existentes"
}
```

---

## 🐛 TROUBLESHOOTING

### ❌ "Função não encontrada"

```
Error: Function not found: create-member-from-payment
```

**Solução:** Fazer deploy novamente:
```bash
supabase functions deploy create-member-from-payment --force
```

### ❌ "Erro de autenticação"

```
Error: 401 Unauthorized
```

**Solução:** Fazer login novamente:
```bash
supabase logout
supabase login
```

### ❌ "Email já existe"

Se vê erro: `email_exists`

**Isso é NORMAL!** A função recupera o user_id existente. Verificar logs:
```bash
supabase functions logs create-member-from-payment --tail
```

Procurar: `✅ user_id recuperado:`

### ❌ "Permissão negada" (RLS)

```
new row violates row-level security policy
```

**Solução 1:** Aplicar migração RLS:
```sql
-- Executar em Supabase SQL Editor
-- Arquivo: MIGRATION_SQL_READY_TO_PASTE.sql
```

**Solução 2:** Verificar que `SUPABASE_SERVICE_ROLE_KEY` está correto

---

## 📋 CHECKLIST PÓS-DEPLOY

- [ ] CLI instalada e loginado
- [ ] 4 funções deployadas com sucesso
- [ ] Logs mostram `✅ Deployed` para cada função
- [ ] Teste de pagamento concluído
- [ ] Email de confirmação recebido
- [ ] Novo membro aparece em "Área de Membros"
- [ ] Consegue fazer login com credenciais
- [ ] `retroactive-member-provision` rodou para membros antigos
- [ ] Todos os membros aparecem na área

---

## 🎉 RESULTADO ESPERADO

Após deploy + retroactive-member-provision:

```
Área de Membros RE-MÃE
📊 Membros: 15  (antes: 1)
📊 Acessos: 15  (antes: 1)

✅ João da Silva - estevao.garcia1010@gmail.com (Ativo, Seller)
✅ Maria Santos - maria@example.com (Ativo, Seller)
✅ Pedro Oliveira - pedro@example.com (Ativo, Seller)
... (12 mais)
```

---

## 📞 PRÓXIMOS PASSOS

1. ✅ **Deploy** (10 min)
2. ✅ **Teste** pagamento novo (5 min)
3. ✅ **Retroactive** provision (2 min)
4. ✅ **Verificar** que todos aparecem (2 min)

**Total: ~20 minutos para tudo funcionando!** ⏱️

---

## 💡 IMPORTANTE

- **Não é necessário fazer git push** - Deploy é independente
- **Funções estarão ativas imediatamente** após deploy
- **Novos pagamentos criarão membros automaticamente** de agora em diante
- **Antigos membros podem ser criados com retroactive**

---

**Próximo passo:** Escolher a opção de deploy acima e executar! 🚀
