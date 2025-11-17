#!/bin/bash

# Deploy script para Edge Functions corrigidas
# Corrige o erro: column member_access.user_id does not exist

set -e

PROJECT_ID="jgmwbovvydimvnmmkfpy"
FUNCTIONS=("update-member-profile" "create-member-user")

echo "🚀 Iniciando deploy das Edge Functions corrigidas..."
echo "Projeto: $PROJECT_ID"
echo ""

# Verificar se está autenticado
if ! npx supabase projects list --project-ref "$PROJECT_ID" &>/dev/null; then
    echo "❌ Não autenticado no Supabase."
    echo ""
    echo "Para autenticar, execute:"
    echo "  npx supabase login"
    echo ""
    echo "Ou exporte o token de acesso:"
    echo "  export SUPABASE_ACCESS_TOKEN='seu_token_pessoal_aqui'"
    exit 1
fi

echo "✅ Autenticado no Supabase"
echo ""

# Deploy cada função
for FUNC in "${FUNCTIONS[@]}"; do
    echo "📦 Deployando $FUNC..."
    
    if npx supabase functions deploy "$FUNC" --project-ref "$PROJECT_ID"; then
        echo "✅ $FUNC deployado com sucesso!"
    else
        echo "❌ Erro ao deployar $FUNC"
        exit 1
    fi
    echo ""
done

echo "🎉 Todos os deploys completados com sucesso!"
echo ""
echo "Próximos passos:"
echo "1. Vá para a interface da aplicação"
echo "2. Teste criar/editar um membro via Admin UI"
echo "3. Verifique os logs em Supabase → Edge Functions → Logs"
echo ""
echo "Documentação: FIXES_DEPLOYED.md"
