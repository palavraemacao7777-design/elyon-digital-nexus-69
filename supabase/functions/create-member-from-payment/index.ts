import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface CreateMemberPayload {
  email: string;
  name: string;
  product_id: string;
  payment_id: string;
  checkout_id: string;
}

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
    console.log('🔧 CREATE_MEMBER_FROM_PAYMENT: Iniciando função centralizada...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: CreateMemberPayload = await req.json();
    const { email, name, product_id, payment_id, checkout_id } = payload;

    console.log('📋 CREATE_MEMBER_FROM_PAYMENT: Payload recebido:', { email, name, product_id, payment_id, checkout_id });

    if (!email || !name || !product_id || !payment_id) {
      throw new Error('Campos obrigatórios faltando: email, name, product_id, payment_id');
    }

    // 1️⃣ Buscar a member_area associada ao produto
    console.log('1️⃣ CREATE_MEMBER_FROM_PAYMENT: Buscando member_area para product:', product_id);
    const { data: productData, error: productError } = await supabase
      .from('products')
      .select('member_area_id')
      .eq('id', product_id)
      .single();

    if (productError || !productData?.member_area_id) {
      console.error('❌ CREATE_MEMBER_FROM_PAYMENT: Produto não encontrado ou sem member_area_id', productError);
      throw new Error(`Produto ${product_id} não encontrado ou sem member_area associada`);
    }

    const memberAreaId = productData.member_area_id;
    console.log('✅ CREATE_MEMBER_FROM_PAYMENT: member_area encontrada:', memberAreaId);

    // 2️⃣ Buscar configurações de senha da member_area
    console.log('2️⃣ CREATE_MEMBER_FROM_PAYMENT: Buscando member_settings para area:', memberAreaId);
    const { data: settingsData, error: settingsError } = await supabase
      .from('member_settings')
      .select('default_password_mode, default_fixed_password')
      .eq('member_area_id', memberAreaId)
      .maybeSingle();

    let password = await generatePassword();
    if (settingsData?.default_password_mode === 'fixed' && settingsData.default_fixed_password) {
      password = settingsData.default_fixed_password;
      console.log('🔐 CREATE_MEMBER_FROM_PAYMENT: Usando senha fixa configurada');
    } else {
      console.log('🔐 CREATE_MEMBER_FROM_PAYMENT: Gerando senha aleatória');
    }

    const passwordHash = await hashPassword(password);

    // 3️⃣ Verificar se membro já existe (por email)
    console.log('3️⃣ CREATE_MEMBER_FROM_PAYMENT: Verificando se membro já existe com email:', email);
    const { data: existingMember, error: checkError } = await supabase
      .from('members')
      .select('id, user_id')
      .eq('email', email)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('❌ CREATE_MEMBER_FROM_PAYMENT: Erro ao verificar membro existente', checkError);
      throw checkError;
    }

    let memberId: string | null = null;
    let userId: string | null = null;

    if (existingMember) {
      console.log('⚠️ CREATE_MEMBER_FROM_PAYMENT: Membro já existe com ID:', existingMember.id);
      memberId = existingMember.id;
      userId = existingMember.user_id;
    } else {
      // 4️⃣ Criar usuário de autenticação
      console.log('4️⃣ CREATE_MEMBER_FROM_PAYMENT: Criando usuário de autenticação...');
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name },
      });

      if (authError) {
        if (authError.message?.includes('duplicate') || authError.message?.includes('already')) {
          console.log('⚠️ CREATE_MEMBER_FROM_PAYMENT: Email já cadastrado em auth, tentando recuperar user_id...');
          // Tentar buscar o perfil/usuário existente
          const { data: profile } = await supabase
            .from('profiles')
            .select('user_id')
            .eq('email', email)
            .maybeSingle();
          if (profile?.user_id) {
            userId = profile.user_id;
            console.log('✅ CREATE_MEMBER_FROM_PAYMENT: user_id recuperado:', userId);
          } else {
            throw new Error('Email já cadastrado mas não foi possível recuperar user_id');
          }
        } else {
          throw authError;
        }
      } else {
        userId = authData.user?.id || null;
        console.log('✅ CREATE_MEMBER_FROM_PAYMENT: Usuário de auth criado:', userId);
      }

      // 5️⃣ Criar registro em members
      console.log('5️⃣ CREATE_MEMBER_FROM_PAYMENT: Criando registro em members...');
      const { data: memberData, error: memberError } = await supabase
        .from('members')
        .insert({
          user_id: userId,
          name,
          email,
          password_hash: passwordHash,
          checkout_id: checkout_id || '00000000-0000-0000-0000-000000000000',
          payment_id,
          plan_type: 'standard',
          status: 'active',
        })
        .select()
        .single();

      if (memberError) {
        console.error('❌ CREATE_MEMBER_FROM_PAYMENT: Erro ao criar member:', memberError);
        throw memberError;
      }

      memberId = memberData.id;
      console.log('✅ CREATE_MEMBER_FROM_PAYMENT: Membro criado:', memberId);
    }

    // 6️⃣ Criar member_access associando ao produto
    console.log('6️⃣ CREATE_MEMBER_FROM_PAYMENT: Criando member_access para produto:', product_id);
    const { error: accessError } = await supabase
      .from('member_access')
      .upsert(
        {
          member_id: memberId,
          product_id,
          status: 'active',
        },
        { onConflict: 'member_id,product_id' }
      );

    if (accessError) {
      console.error('❌ CREATE_MEMBER_FROM_PAYMENT: Erro ao criar member_access:', accessError);
      throw accessError;
    }

    console.log('✅ CREATE_MEMBER_FROM_PAYMENT: member_access criado com sucesso');

    console.log('🎉 CREATE_MEMBER_FROM_PAYMENT: Membro cadastrado com sucesso!', {
      memberId,
      userId,
      email,
      memberAreaId,
      productId: product_id,
    });

    return new Response(
      JSON.stringify({
        success: true,
        memberId,
        userId,
        email,
        message: 'Membro criado automaticamente com sucesso após pagamento aprovado.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('❌ CREATE_MEMBER_FROM_PAYMENT: Erro:', error?.message || error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || String(error),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
