#!/bin/bash

# One-liner Deploy Script
# Use: ./deploy-all-functions.sh

PROJECT_DIR="/workspaces/elyon-digital-nexus-69"
FUNCTIONS=("create-member-from-payment" "mercadopago-webhook" "create-mercado-pago-payment" "retroactive-member-provision")

cd "$PROJECT_DIR" || exit 1

echo "🚀 Iniciando deploy de Edge Functions..."
echo ""

failed=0
success=0

for func in "${FUNCTIONS[@]}"; do
    echo "📤 Deployando: $func"
    if supabase functions deploy "$func" 2>&1 | grep -q "✓\|Error\|deployed"; then
        echo "✅ $func"
        ((success++))
    else
        echo "⚠️  Verificar status de $func"
        ((failed++))
    fi
done

echo ""
echo "========================================="
echo "📊 Resultado: $success sucesso, $failed avisos"
echo "========================================="
echo ""

if [ $success -eq 4 ]; then
    echo "✅ Todas as funções foram deployadas!"
    echo ""
    echo "🔍 Verificar logs:"
    echo "   supabase functions logs create-member-from-payment --tail"
    echo ""
    echo "🧪 Testar:"
    echo "   1. Fazer pagamento de teste"
    echo "   2. Verificar se membro foi criado"
    echo ""
    echo "📦 Criar membros antigos:"
    echo "   supabase functions invoke retroactive-member-provision"
else
    echo "⚠️  Verificar que supabase CLI está instalada e autenticada"
    echo "   supabase login"
fi
