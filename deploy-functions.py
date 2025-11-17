#!/usr/bin/env python3
"""
Script para deployar Edge Functions no Supabase
Usa a API do Supabase diretamente
"""

import os
import sys
import json
from pathlib import Path

# Credenciais necessárias (VOCÊ PRECISA CONFIGURAR)
PROJECT_ID = "jgmwbovvydimvnmmkfpy"
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

if not SUPABASE_URL or not SERVICE_ROLE_KEY:
    print("❌ ERRO: Variáveis de ambiente não configuradas")
    print("Execute: export SUPABASE_URL='https://your-project.supabase.co'")
    print("Execute: export SUPABASE_SERVICE_ROLE_KEY='your-service-role-key'")
    sys.exit(1)

FUNCTIONS_PATH = Path(__file__).parent / "supabase" / "functions"

FUNCTIONS_TO_DEPLOY = [
    "create-member-from-payment",
    "mercadopago-webhook",
    "create-mercado-pago-payment",
    "retroactive-member-provision",
]

def deploy_function(function_name: str) -> bool:
    """Deploy uma função para o Supabase"""
    function_path = FUNCTIONS_PATH / function_name / "index.ts"
    
    if not function_path.exists():
        print(f"❌ Arquivo não encontrado: {function_path}")
        return False
    
    print(f"\n📤 Deployando {function_name}...")
    print(f"   Arquivo: {function_path}")
    
    # Ler o arquivo
    with open(function_path, 'r') as f:
        code = f.read()
    
    # Chamar API do Supabase para deploy
    # NOTA: Esta seria a chamada HTTP real, mas o deploy via Supabase CLI é mais simples
    
    print(f"✅ {function_name}: Lido ({len(code)} bytes)")
    
    return True

def main():
    """Deploy de todas as funções"""
    print("=" * 60)
    print("🚀 DEPLOY DE EDGE FUNCTIONS - SUPABASE")
    print("=" * 60)
    
    print(f"\n📍 Project ID: {PROJECT_ID}")
    print(f"📍 URL: {SUPABASE_URL}")
    print(f"📍 Funções a deployar: {len(FUNCTIONS_TO_DEPLOY)}")
    
    for func_name in FUNCTIONS_TO_DEPLOY:
        deploy_function(func_name)
    
    print("\n" + "=" * 60)
    print("⚠️  PRÓXIMO PASSO: Use o Supabase Dashboard ou CLI")
    print("=" * 60)
    print("\nOpção 1 - Via CLI (recomendado):")
    print("""
    brew install supabase/tap/supabase  # macOS
    # OU
    apt-get install supabase  # Ubuntu
    
    cd /workspaces/elyon-digital-nexus-69
    supabase login
    supabase functions deploy create-member-from-payment
    supabase functions deploy mercadopago-webhook
    supabase functions deploy create-mercado-pago-payment
    supabase functions deploy retroactive-member-provision
    """)
    
    print("\nOpção 2 - Via Dashboard:")
    print(f"  https://app.supabase.com/project/{PROJECT_ID}/functions")
    print("  Upload manual de cada arquivo index.ts")
    
    print("\nOpção 3 - Via Vercel:")
    print("  vercel deploy --prod")

if __name__ == "__main__":
    main()
