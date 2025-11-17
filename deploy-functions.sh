#!/bin/bash

# Script para testar e deployar funções Edge do Supabase
# Requer: Supabase CLI instalada e acesso ao projeto

set -e

PROJECT_ID="jgmwbovvydimvnmmkfpy"
FUNCTIONS=(
    "create-member-from-payment"
    "mercadopago-webhook"
    "create-mercado-pago-payment"
    "retroactive-member-provision"
)

echo "========================================="
echo "🚀 DEPLOY DE EDGE FUNCTIONS"
echo "========================================="
echo "Project ID: $PROJECT_ID"
echo "Funções: ${#FUNCTIONS[@]}"
echo ""

# Verificar se supabase CLI está instalada
if ! command -v supabase &> /dev/null; then
    echo "❌ ERRO: supabase CLI não encontrada"
    echo ""
    echo "📖 Instale via:"
    echo "   macOS:  brew install supabase/tap/supabase"
    echo "   Ubuntu: sudo apt-get install supabase"
    echo "   Outras: https://github.com/supabase/cli#install-the-cli"
    echo ""
    echo "Depois faça login:"
    echo "   supabase login"
    echo ""
    exit 1
fi

echo "✅ Supabase CLI encontrada: $(supabase --version)"
echo ""

# Deploy de cada função
for func in "${FUNCTIONS[@]}"; do
    echo "📤 Deployando $func..."
    
    if supabase functions deploy "$func" 2>&1; then
        echo "✅ $func deployada com sucesso!"
    else
        echo "❌ ERRO ao deployar $func"
        echo "   Tente novamente ou verifique os logs:"
        echo "   supabase functions logs $func"
    fi
    echo ""
done

echo "========================================="
echo "✅ DEPLOY CONCLUÍDO!"
echo "========================================="
echo ""
echo "🔍 Próximos passos:"
echo ""
echo "1️⃣  Verificar status das funções:"
echo "   supabase functions list"
echo ""
echo "2️⃣  Ver logs (em tempo real):"
echo "   supabase functions logs create-member-from-payment --tail"
echo ""
echo "3️⃣  Testar pagamento de teste:"
echo "   - Ir ao checkout"
echo "   - Fazer pagamento com credenciais de teste"
echo "   - Verificar se membro foi criado"
echo ""
echo "4️⃣  Se algo falhar, rodar retroactive:"
echo "   curl -i \\
echo "     --location \\
echo "     --request POST 'https://jgmwbovvydimvnmmkfpy.supabase.co/functions/v1/retroactive-member-provision' \\
echo "     --header 'Authorization: Bearer YOUR_ANON_KEY' \\
echo "     --header 'Content-Type: application/json'"
echo ""
