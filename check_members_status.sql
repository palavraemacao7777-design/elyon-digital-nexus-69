-- 1. Compras aprovadas
SELECT COUNT(*) as compras_aprovadas, COUNT(DISTINCT cliente_email) as clientes_unicos
FROM compras 
WHERE status_pagamento = 'approved';

-- 2. Membros registrados
SELECT COUNT(*) as membros_total, COUNT(DISTINCT email) as emails_unicos
FROM members;

-- 3. Compras SEM membros (GAP)
SELECT 
  c.id as compra_id,
  c.cliente_email,
  c.cliente_nome,
  c.produto_id,
  c.created_at,
  m.id as member_id
FROM compras c
LEFT JOIN members m ON c.cliente_email = m.email
WHERE c.status_pagamento = 'approved'
AND m.id IS NULL
ORDER BY c.created_at DESC
LIMIT 10;

-- 4. Membros registrados (últimos 5)
SELECT id, email, name, created_at, status
FROM members
ORDER BY created_at DESC
LIMIT 5;
