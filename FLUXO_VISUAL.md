# 🎯 FLUXO VISUAL - MEMBROS NÃO CRIADOS

## ⚠️ FLUXO ATUAL (QUEBRADO)

```
┌─────────────────────────────────────────────────────────────────┐
│                    PAGAMENTO NO CHECKOUT                        │
│                      (Cartão válido)                            │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│              MERCADO PAGO APROVA PAGAMENTO                      │
│              (status: approved)                                 │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│           WEBHOOK MERCADO PAGO ENVIA NOTIFICAÇÃO               │
│        (payment.updated com status approved)                    │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│         WEBHOOK TENTA INVOCAR FUNÇÃO EDGE                       │
│         invoke('create-member-from-payment')                    │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                 ┌─────────────┴──────────────┐
                 │                            │
                 ▼                            │
┌──────────────────────────────────────────┐  │
│  ❌ ERRO: FUNCTION NOT FOUND             │  │
│  "create-member-from-payment" não existe │  │
│   remotamente (não foi deployada)        │  │
└──────────────────────────────────────────┘  │
                 │                            │
                 └────────────┬───────────────┘
                              │
                              ▼
         ┌────────────────────────────────────────┐
         │  ❌ NENHUM MEMBRO CRIADO               │
         │  ❌ NENHUM AUTH USER CRIADO            │
         │  ❌ NENHUM MEMBER_ACCESS CRIADO        │
         │  ❌ EMAIL NÃO ENVIADO COM CREDENCIAIS  │
         └────────────────────────────────────────┘
```

---

## ✅ FLUXO CORRETO (APÓS DEPLOY)

```
┌─────────────────────────────────────────────────────────────────┐
│                    PAGAMENTO NO CHECKOUT                        │
│                      (Cartão válido)                            │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│              MERCADO PAGO APROVA PAGAMENTO                      │
│              (status: approved)                                 │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│           WEBHOOK MERCADO PAGO ENVIA NOTIFICAÇÃO               │
│        (payment.updated com status approved)                    │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│         WEBHOOK RECEBE E PROCESSA PAGAMENTO                     │
│         ✅ Valida assinatura                                    │
│         ✅ Extrai product_ids de external_reference             │
│         ✅ Extrai metadata.purchased_product_ids                │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
         ┌─────────────────────────────────────────┐
         │ ✅ WEBHOOK INVOCA FUNÇÃO EDGE           │
         │ create-member-from-payment              │
         │ (AGORA EXISTE - FOI DEPLOYADA!)         │
         └──────────────┬──────────────────────────┘
                        │
          ┌─────────────┴────────────────┐
          │ PARA CADA PRODUTO COMPRADO:  │
          │ (suporta múltiplos)          │
          │                              │
          ├─ Produto 1 ✅               │
          ├─ Produto 2 ✅               │
          ├─ Produto 3 ✅               │
          └─ Produto N ✅               │
          │                              │
          ▼
┌─────────────────────────────────────────┐
│  1️⃣  CRIA AUTH USER                     │
│   ├─ Se email não existe:               │
│   │  └─ Cria novo user com password    │
│   └─ Se email já existe:                │
│      └─ Recupera user_id existente      │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  2️⃣  CRIA MEMBRO (members table)        │
│   ├─ user_id (linkado ao auth)          │
│   ├─ email                              │
│   ├─ name                               │
│   ├─ password_hash (bcrypt)             │
│   └─ status: active                     │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  3️⃣  CRIA MEMBER_ACCESS                │
│   ├─ member_id                          │
│   ├─ product_id                         │
│   ├─ member_area_id                     │
│   └─ access_granted_at                  │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  ✅ MEMBRO CRIADO COM SUCESSO!          │
│  ✅ AUTH USER CRIADO                    │
│  ✅ MEMBER_ACCESS CRIADO                │
│  ✅ EMAIL ENVIADO COM CREDENCIAIS       │
│                                         │
│  Cliente pode fazer login em:           │
│  https://www.elyondigital.com.br/      │
│    membros/ba42a4fb-efef-4087-9f43    │
│                                         │
│  Email: usuario@example.com             │
│  Senha: [gerada automaticamente]        │
└─────────────────────────────────────────┘
```

---

## 📊 COMPARAÇÃO: ANTES vs DEPOIS

### ANTES (Sem Deploy)
```
Webhook recebe pagamento
    ↓
Tenta invocar function
    ↓
❌ Function não found (não deployada)
    ↓
Pagamento registrado em compras
Mas NENHUM membro criado
    ↓
Resultado: 1 membro, 15+ compras órfãs
```

### DEPOIS (Com Deploy)
```
Webhook recebe pagamento
    ↓
Invoca function (✅ agora existe!)
    ↓
Cria membro + auth user + member_access
    ✅ Para cada produto
    ✅ Com retry (se falhar, tenta 2x)
    ✅ Com email exists recovery
    ↓
Resultado: 15+ membros, todos com acesso
```

---

## 🔄 RETRY LOGIC (Proteção contra falhas temporárias)

```
Invocar create-member-from-payment
    │
    ├─ Tentativa 1
    │  ├─ Sucesso? ✅ → Continuar
    │  └─ Erro?     → ⏳ Aguardar 2s
    │                    │
    │                    ▼
    ├─ Tentativa 2
    │  ├─ Sucesso? ✅ → Continuar
    │  └─ Erro?     → ❌ Falha (log & notify)
    │
    └─ Status retorna para webhook
```

---

## 🔐 EMAIL EXISTS RECOVERY (Smart user reuse)

```
Tentar criar auth user com email já existente
    │
    ├─ Buscar em profiles table
    │  ├─ Encontrou? ✅ → Usar user_id
    │  └─ Não found? → Próximo passo
    │                    │
    │                    ▼
    ├─ Buscar em auth.admin.listUsers()
    │  ├─ Encontrou? ✅ → Usar user_id
    │  └─ Não found? → ❌ Erro (email inválido)
    │
    └─ Criar membro com user_id recuperado
```

---

## 📦 MÚLTIPLOS PRODUTOS (Loop inteligente)

```
Compra contém 3 produtos:
[prod-A, prod-B, prod-C]

Para cada produto:
├─ prod-A
│  ├─ Criar membro 1
│  ├─ Criar auth user 1
│  └─ Criar member_access 1
│
├─ prod-B
│  ├─ Criar membro 2
│  ├─ Criar auth user 2 (ou reusar se email)
│  └─ Criar member_access 2
│
└─ prod-C
   ├─ Criar membro 3
   ├─ Criar auth user 3 (ou reusar se email)
   └─ Criar member_access 3

Resultado: 3 membros, 3 acessos, 1 auth user
```

---

## ✅ FLUXO DE DEPLOY

```
1️⃣  Instalar CLI
    brew install supabase/tap/supabase
    │
    ▼

2️⃣  Login
    supabase login
    │
    ▼

3️⃣  Deploy Função 1
    supabase functions deploy create-member-from-payment
    │
    ▼ (repeat para funções 2, 3, 4)

4️⃣  Verificar
    supabase functions list
    ├─ create-member-from-payment   ✅
    ├─ mercadopago-webhook          ✅
    ├─ create-mercado-pago-payment  ✅
    └─ retroactive-member-provision ✅
    │
    ▼

5️⃣  PRONTO! Funções agora ativas
    Novos pagamentos criarão membros automaticamente
```

---

## 🧪 TESTE PÓS-DEPLOY

```
Fazer pagamento de teste
    ├─ Email: test_user_123456789@testuser.com
    ├─ Cartão: 4111 1111 1111 1111
    └─ Completar checkout
         │
         ▼
    ✅ Email recebido com credenciais?
    ✅ Membro aparece na Área?
    ✅ Consegue fazer login?
         │
         ▼
    SE TUDO OK: ✅ Deploy bem-sucedido!
    SE ERRO:    ❌ Ver logs: supabase functions logs [func] --tail
```

---

## 📈 CRESCIMENTO PÓS-DEPLOY

```
Dia 0 (Hoje):
├─ Funções deployadas
├─ Teste feito: ✅
└─ Membros: 1

Dia 0 (Retroactive):
├─ retroactive-member-provision rodado
├─ Membros retroativos criados: 15+
└─ Membros: 16

Dia 1+:
├─ Novos pagamentos criam membros automaticamente
├─ Cada pagamento aprovado = novo membro + credenciais
└─ Membros crescem conforme vendas
```

---

**Próximo passo:** Executar o deploy! 🚀
