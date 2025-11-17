import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

async function generatePassword(): Promise<string> {
  const length = 12;
  const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}

async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password);
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders, status: 200 });

  try {
    console.log('🔧 RETROACTIVE_MEMBER_PROVISION: Iniciando provisão retroativa de membros...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1️⃣ Buscar todas as compras aprovadas
    console.log('1️⃣ RETROACTIVE_MEMBER_PROVISION: Buscando compras aprovadas...');
    const { data: compras, error: comprasError } = await supabase
      .from('compras')
      .select('id, cliente_email, cliente_nome, produto_id, mercadopago_payment_id')
      .eq('status_pagamento', 'approved')
      .order('created_at', { ascending: false });

    if (comprasError) {
      throw new Error(`Erro ao buscar compras: ${comprasError.message}`);
    }

    console.log(`📦 RETROACTIVE_MEMBER_PROVISION: ${compras?.length || 0} compras encontradas`);

    let processados = 0;
    let criados = 0;
    let erros = 0;

    // 2️⃣ Processar cada compra
    for (const compra of compras || []) {
      processados++;
      console.log(`\n[${processados}/${compras?.length}] RETROACTIVE_MEMBER_PROVISION: Processando compra ${compra.id}`);

      try {
        // Verificar se membro já existe
        const { data: existingMember } = await supabase
          .from('members')
          .select('id')
          .eq('email', compra.cliente_email)
          .maybeSingle();

        if (existingMember) {
          console.log(`  ⏭️  Membro já existe para ${compra.cliente_email}`);
          
          // Verificar se já tem acesso ao produto
          const { data: existingAccess } = await supabase
            .from('member_access')
            .select('id')
            .eq('member_id', existingMember.id)
            .eq('product_id', compra.produto_id)
            .maybeSingle();

          if (existingAccess) {
            console.log(`  ⏭️  Acesso já existe para produto ${compra.produto_id}`);
            continue;
          } else {
            console.log(`  🔗 Adicionando acesso para produto ${compra.produto_id}...`);
            // Buscar product para saber member_area_id
            const { data: product } = await supabase
              .from('products')
              .select('member_area_id')
              .eq('id', compra.produto_id)
              .single();

            if (product?.member_area_id) {
              await supabase
                .from('member_access')
                .upsert({
                  member_id: existingMember.id,
                  product_id: compra.produto_id,
                  member_area_id: product.member_area_id,
                  access_granted_at: new Date().toISOString(),
                });
              console.log(`  ✅ Acesso adicionado!`);
              criados++;
            }
            continue;
          }
        }

        // Criar novo membro
        console.log(`  ✨ Criando novo membro para ${compra.cliente_email}...`);

        // 3️⃣ Buscar produto para member_area_id e password config
        const { data: product } = await supabase
          .from('products')
          .select('member_area_id')
          .eq('id', compra.produto_id)
          .single();

        if (!product?.member_area_id) {
          throw new Error(`Produto ${compra.produto_id} sem member_area_id`);
        }

        // 4️⃣ Buscar configuração de senha
        const { data: settings } = await supabase
          .from('member_settings')
          .select('default_password_mode, default_fixed_password')
          .eq('member_area_id', product.member_area_id)
          .maybeSingle();

        let password = await generatePassword();
        if (settings?.default_password_mode === 'fixed' && settings.default_fixed_password) {
          password = settings.default_fixed_password;
        }

        const passwordHash = await hashPassword(password);

        // 5️⃣ Criar usuário auth
        console.log(`  👤 Criando usuário de autenticação...`);
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email: compra.cliente_email,
          password,
          email_confirm: true,
          user_metadata: { name: compra.cliente_nome },
        });

        let userId: string | null = null;

        if (authError) {
          if (authError.message?.includes('duplicate') || authError.code === 'email_exists') {
            console.log(`  ⚠️  Email já existe em auth, recuperando user_id...`);
            const { data: { users } } = await supabase.auth.admin.listUsers();
            const existingUser = users.find((u: any) => u.email === compra.cliente_email);
            if (existingUser?.id) {
              userId = existingUser.id;
              console.log(`  ✅ user_id recuperado: ${userId}`);
            } else {
              throw new Error(`Email existe mas não conseguimos recuperar user_id`);
            }
          } else {
            throw authError;
          }
        } else {
          userId = authData.user?.id || null;
          console.log(`  ✅ Usuário auth criado: ${userId}`);
        }

        // 6️⃣ Criar membro
        console.log(`  💾 Criando membro no banco...`);
        const { data: memberData, error: memberError } = await supabase
          .from('members')
          .insert({
            user_id: userId,
            name: compra.cliente_nome,
            email: compra.cliente_email,
            password_hash: passwordHash,
            checkout_id: '00000000-0000-0000-0000-000000000000',
            payment_id: compra.mercadopago_payment_id,
            plan_type: 'standard',
            status: 'active',
          })
          .select()
          .single();

        if (memberError) {
          throw memberError;
        }

        // 7️⃣ Criar member_access
        console.log(`  🔗 Criando member_access...`);
        await supabase
          .from('member_access')
          .upsert({
            member_id: memberData.id,
            product_id: compra.produto_id,
            member_area_id: product.member_area_id,
            access_granted_at: new Date().toISOString(),
          });

        console.log(`  ✅ Membro criado com sucesso! ID: ${memberData.id}`);
        criados++;

      } catch (error: any) {
        console.error(`  ❌ Erro ao processar compra: ${error?.message || error}`);
        erros++;
      }
    }

    const resultado = {
      processados,
      criados,
      erros,
      resumo: `${criados} membros criados/atualizados, ${erros} erros, ${processados - criados - erros} já existentes`
    };

    console.log(`\n✅ RETROACTIVE_MEMBER_PROVISION: Concluído! ${JSON.stringify(resultado)}`);

    return new Response(
      JSON.stringify({
        success: true,
        ...resultado
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('❌ RETROACTIVE_MEMBER_PROVISION: Erro:', error?.message || error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || String(error),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
