-- 📊 VERIFICAÇÃO: Membros e Produtos Comprados

-- 1️⃣ VERIFICAR PAGAMENTOS APROVADOS
SELECT 
  p.id as payment_id,
  p.status as payment_status,
  p.payer->>'email' as customer_email,
  p.metadata->>'customer_data' as customer_data,
  p.transaction_amount,
  p.created_at
FROM payments p
WHERE p.status = 'approved'
ORDER BY p.created_at DESC
LIMIT 10;

-- 2️⃣ VERIFICAR COMPRAS REGISTRADAS
SELECT 
  c.id,
  c.mercadopago_payment_id,
  c.cliente_email,
  c.cliente_nome,
  c.produto_id,
  c.status_pagamento,
  c.created_at
FROM compras c
ORDER BY c.created_at DESC
LIMIT 10;

-- 3️⃣ VERIFICAR MEMBROS CRIADOS
SELECT 
  m.id,
  m.user_id,
  m.email,
  m.name,
  m.checkout_id,
  m.payment_id,
  m.created_at
FROM members m
ORDER BY m.created_at DESC
LIMIT 10;

-- 4️⃣ VERIFICAR MEMBER_ACCESS (Acessos)
SELECT 
  ma.id,
  ma.member_id,
  ma.product_id,
  ma.member_area_id,
  ma.access_granted_at,
  m.email
FROM member_access ma
LEFT JOIN members m ON ma.member_id = m.id
ORDER BY ma.access_granted_at DESC
LIMIT 10;

-- 5️⃣ VERIFICAR DIFERENÇA (Compras sem membros)
SELECT 
  c.id as compra_id,
  c.cliente_email,
  c.cliente_nome,
  c.produto_id,
  COALESCE(m.id, 'SEM MEMBRO') as member_id,
  COALESCE(ma.id, 'SEM ACESSO') as member_access_id
FROM compras c
LEFT JOIN members m ON c.cliente_email = m.email
LEFT JOIN member_access ma ON m.id = ma.member_id AND c.produto_id = ma.product_id
WHERE c.status_pagamento = 'approved'
ORDER BY c.created_at DESC;

-- 6️⃣ CONTAR TOTAIS
SELECT 
  (SELECT COUNT(*) FROM compras WHERE status_pagamento = 'approved') as compras_aprovadas,
  (SELECT COUNT(*) FROM members) as membros_total,
  (SELECT COUNT(*) FROM member_access) as acessos_total,
  (SELECT COUNT(DISTINCT cliente_email) FROM compras WHERE status_pagamento = 'approved') as clientes_unicos;
