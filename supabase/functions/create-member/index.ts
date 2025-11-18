import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CreateMemberRequest {
  name: string;
  email: string;
  checkoutId: string;
  paymentId: string;
  planType: string;
  productIds?: string[];
  memberAreaId?: string | null;
  phone?: string | null;
}

interface CreateMemberResponse {
  success: boolean;
  memberId?: string;
  userId?: string;
  password?: string;
  message?: string;
  error?: string;
}

function generateRandomPassword(): string {
  const length = 12;
  const charset =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}

async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const payload: CreateMemberRequest = await req.json();
    const {
      name,
      email,
      checkoutId,
      paymentId,
      planType,
      productIds,
      memberAreaId,
      phone,
    } = payload;

    console.log("CREATE_MEMBER_DEBUG: Starting member creation", {
      email,
      memberAreaId,
      productIds,
    });

      // Fetch member_settings for password configuration.
      // If a memberAreaId wasn't provided, try to derive one from productIds.
      let effectiveMemberAreaId: string | null = memberAreaId || null;
      const prodIds = productIds || [];
      if (!effectiveMemberAreaId && prodIds.length > 0) {
        try {
          for (const pid of prodIds) {
            if (!pid) continue;
            const { data: pRow } = await supabase
              .from('products')
              .select('member_area_id')
              .eq('id', pid)
              .maybeSingle();
            if (pRow?.member_area_id) { effectiveMemberAreaId = pRow.member_area_id; break; }
          }
          if (!effectiveMemberAreaId) {
            // Try member_areas that list the product in associated_products
            const { data: areas } = await supabase
              .from('member_areas')
              .select('id')
              .overlaps('associated_products', prodIds)
              .limit(1);
            if (areas && areas.length) effectiveMemberAreaId = areas[0].id;
          }
        } catch (e) {
          console.warn('CREATE_MEMBER_DEBUG: erro ao derivar memberAreaId a partir de productIds', e);
        }
      }

      const { data: settingsData, error: settingsError } = await (effectiveMemberAreaId ?
        supabase.from('member_settings').select('default_password_mode, default_fixed_password').eq('member_area_id', effectiveMemberAreaId).maybeSingle()
        : Promise.resolve({ data: null, error: null } as any)
      );

      if (settingsError && settingsError.code !== 'PGRST116') {
        console.error('CREATE_MEMBER_DEBUG: Error fetching settings', settingsError);
      }

      // Determine password based on mode: USE ONLY fixed password from member_settings
      let password = '';
      let forceChangePassword = false;

      if (settingsData && settingsData.default_password_mode) {
        const mode = settingsData.default_password_mode || 'random';
        if (mode === 'fixed' && settingsData.default_fixed_password) {
          password = settingsData.default_fixed_password;
        } else {
          console.error('CREATE_MEMBER_DEBUG: Fixed default password not configured for this member area.');
          return new Response(JSON.stringify({ success: false, error: 'Senha fixa não configurada para esta área de membros.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
        }
      } else {
        console.error('CREATE_MEMBER_DEBUG: member_settings missing or not configured for this member area.');
        return new Response(JSON.stringify({ success: false, error: 'Senha fixa não configurada para esta área de membros.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
      }

    console.log("CREATE_MEMBER_DEBUG: Password mode determined", {
      mode: settingsData?.default_password_mode || "random",
      passwordLength: password.length,
    });

    let userId: string | null = null;
    let createdNewAuthUser = false;
    try {
      const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: name,
          force_password_change: forceChangePassword,
        },
      });

      if (authError) {
        // If email already exists, we'll try to recover existing user id
        console.error("CREATE_MEMBER_DEBUG: Auth user creation returned error", authError);
        throw authError;
      }

      userId = authData.user.id;
      createdNewAuthUser = true;
      console.log("CREATE_MEMBER_DEBUG: Auth user created", { userId });
    } catch (authErr: any) {
      // Handle duplicate email: try to find existing member record with that email
      const authMsg = authErr?.message || String(authErr);
      console.warn('CREATE_MEMBER_DEBUG: auth.createUser failed, attempting fallback. Message:', authMsg);

      if (authMsg && authMsg.toLowerCase().includes('duplicate')) {
        // try to find existing member entry
        try {
          // First try to find an existing profile linked to this email
          const { data: existingProfile } = await supabase
            .from('profiles')
            .select('user_id')
            .eq('email', email)
            .maybeSingle();

          if (existingProfile && existingProfile.user_id) {
            userId = existingProfile.user_id;
            console.log('CREATE_MEMBER_DEBUG: Found existing profile for email, using user_id', { userId });
          } else {
            // Fallback: try to locate an existing member record
            const { data: existingMember } = await supabase
              .from('members')
              .select('id, user_id')
              .eq('email', email)
              .maybeSingle();

            if (existingMember && existingMember.user_id) {
              userId = existingMember.user_id;
              console.log('CREATE_MEMBER_DEBUG: Found existing member record for email, using user_id', { userId, memberId: existingMember.id });
            } else {
              // As a last resort, attempt to find the auth user via admin API list (best-effort)
              try {
                const listRes = await adminClient.auth.admin.listUsers();
                const found = (listRes?.users || []).find((u: any) => (u.email || '').toLowerCase() === (email || '').toLowerCase());
                if (found && found.id) {
                  userId = found.id;
                  console.log('CREATE_MEMBER_DEBUG: Found auth user via admin.listUsers fallback', { userId });
                }
              } catch (listErr) {
                console.warn('CREATE_MEMBER_DEBUG: admin.listUsers fallback failed', listErr);
              }
            }

            if (!userId) {
              console.warn('CREATE_MEMBER_DEBUG: No user_id found after duplicate email handling; returning conflict to caller.');
              return new Response(JSON.stringify({ success: false, error: 'E-mail já cadastrado. Faça login ou recupere a senha.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 409 });
            }
          }
        } catch (e) {
          console.error('CREATE_MEMBER_DEBUG: Error while looking up existing member for duplicate email', e);
          return new Response(JSON.stringify({ success: false, error: 'E-mail já cadastrado e não foi possível localizar usuário.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 409 });
        }
      } else {
        console.error('CREATE_MEMBER_DEBUG: Unexpected auth error:', authErr);
        return new Response(JSON.stringify({ success: false, error: authMsg || 'Falha ao criar usuário de autenticação.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
      }
    }

    // Hash password for storage in members table
    const passwordHash = await hashPassword(password);

    // Prepare memberId variable; if we found existing member earlier (duplicate email fallback)
    // the variable may already be set. Otherwise, create a new member record.
    let memberId: string | null = null;

    if (!userId) {
      throw new Error('User id not available to create member record');
    }

    // Try to find existing member record by email
    const { data: existingMemberCheck } = await supabase
      .from('members')
      .select('id, user_id, password_hash')
      .eq('email', email)
      .maybeSingle();

    if (existingMemberCheck && existingMemberCheck.id) {
      memberId = existingMemberCheck.id;
      console.log('CREATE_MEMBER_DEBUG: Found existing member record, will update/ reuse', { memberId });

      // Update member record with latest checkout/payment and plan info
      try {
        const updatePayload: any = {
          user_id: userId,
          name,
          checkout_id: checkoutId,
          payment_id: paymentId,
          plan_type: planType,
          phone: phone || null,
          status: 'active',
          updated_at: new Date().toISOString()
        };

        // If existing record had no password_hash, set it
        if (!existingMemberCheck.password_hash) {
          updatePayload.password_hash = passwordHash;
        }

        const { error: memberUpdateError } = await supabase
          .from('members')
          .update(updatePayload)
          .eq('id', memberId);

        if (memberUpdateError) {
          console.error('CREATE_MEMBER_DEBUG: Failed to update existing member record', memberUpdateError);
        } else {
          console.log('CREATE_MEMBER_DEBUG: Existing member record updated', { memberId });
        }
      } catch (updateErr) {
        console.error('CREATE_MEMBER_DEBUG: Exception updating existing member', updateErr);
      }
    } else {
      const { data: memberData, error: memberError } = await supabase
        .from('members')
        .insert({
          user_id: userId,
          name,
          email,
          phone: phone || null,
          password_hash: passwordHash,
          checkout_id: checkoutId,
          payment_id: paymentId,
          plan_type: planType,
          status: 'active',
        })
        .select()
        .single();

      if (memberError) {
        console.error('CREATE_MEMBER_DEBUG: Member record creation failed', memberError);
        throw new Error(`Failed to create member record: ${memberError.message}`);
      }

      memberId = memberData.id;
      console.log('CREATE_MEMBER_DEBUG: Member record created', { memberId });
    }

    // Grant access to products
      if (prodIds && prodIds.length > 0) {
      const memberAccessRecords = prodIds.map((productId: string) => ({
        member_id: memberId,
        product_id: productId,
        status: "active",
      }));

            const { error: insertErr } = await supabase
              .from('member_access')
              .upsert(insertsByMember, { onConflict: 'member_id,module_id' });
            if (insertErr) throw insertErr;
            console.log('CREATE_MEMBER_DEBUG: Acesso aos módulos concedido (member_id/module_id)', { memberId, moduleCount: moduleIds.length });
              .maybeSingle();
            if (prodErr) console.warn('CREATE_MEMBER_DEBUG: Erro ao buscar product durante resolução de member areas', prodErr);
            if (productRow?.member_area_id) memberAreaIdsSet.add(productRow.member_area_id);

            const { data: areas, error: areasErr } = await supabase
              .from('member_areas')
              .select('id')
              .overlaps('associated_products', [pid]);
            if (areasErr) console.warn('CREATE_MEMBER_DEBUG: Erro ao buscar member_areas por associated_products', areasErr);
            if (areas && areas.length) areas.forEach((a: any) => a?.id && memberAreaIdsSet.add(a.id));
          } catch (e) {
            console.error('CREATE_MEMBER_DEBUG: Exceção ao resolver member areas para product', pid, e);
          }
        }

        const memberAreaIds = Array.from(memberAreaIdsSet);
        if (memberAreaIds.length > 0) {
          // Buscar módulos publicados para cada área de membro
          const moduleIdsSet = new Set<string>();
          for (const maId of memberAreaIds) {
            try {
              const { data: modulesForArea, error: modulesErr } = await supabase
                .from('modules')
                .select('id')
                .eq('member_area_id', maId)
                .eq('status', 'published');
              if (modulesErr) {
                console.warn('CREATE_MEMBER_DEBUG: Erro ao buscar módulos publicados para área', maId, modulesErr);
              } else if (modulesForArea && modulesForArea.length) {
                modulesForArea.forEach((m: any) => m?.id && moduleIdsSet.add(m.id));
              }
            } catch (e) {
              console.error('CREATE_MEMBER_DEBUG: Exceção ao buscar módulos para área', maId, e);
            }
          }

          const moduleIds = Array.from(moduleIdsSet);
          if (moduleIds.length > 0) {
            // Tentar inserir por member_id + module_id (quando schema usa member_id)
            const insertsByMember = moduleIds.map(mid => ({ member_id: memberId, module_id: mid }));
            try {
              const { error: insertErr } = await supabase
                .from('member_access')
                .upsert(insertsByMember, { onConflict: 'member_id,module_id' });
              if (insertErr) throw insertErr;
              console.log('CREATE_MEMBER_DEBUG: Acesso aos módulos concedido (member_id/module_id)', { memberId, moduleCount: moduleIds.length });
            } catch (e) {
              console.warn('CREATE_MEMBER_DEBUG: Inserção por (member_id,module_id) falhou, tentando fallback por (user_id,module_id):', (e as any)?.message || e);
              // Fallback: tentar inserir por user_id + module_id + member_area_id (quando schema usa user_id)
              try {
                const insertsByUser: any[] = [];
                for (const mid of moduleIds) {
                  for (const maId of memberAreaIds) {
                    insertsByUser.push({ user_id: userId, module_id: mid, member_area_id: maId, is_active: true });
                  }
                }
                if (insertsByUser.length > 0) {
                  const { error: insertUserErr } = await supabase
                    .from('member_access')
                    .upsert(insertsByUser, { onConflict: 'user_id,module_id' });
                  if (insertUserErr) throw insertUserErr;
                  console.log('CREATE_MEMBER_DEBUG: Acesso aos módulos concedido (user_id/module_id)', { userId, moduleCount: moduleIds.length });
                }
              } catch (e2) {
                console.error('CREATE_MEMBER_DEBUG: Falha ao conceder acesso aos módulos (ambos os métodos):', e2);
              }
            }
          } else {
            console.log('CREATE_MEMBER_DEBUG: Nenhum módulo publicado encontrado para as áreas de membros derivadas dos produtos.');
          }
        } else {
          console.log('CREATE_MEMBER_DEBUG: Nenhuma área de membros encontrada a partir dos produtos comprados.');
        }
      } catch (e) {
        console.error('CREATE_MEMBER_DEBUG: Erro ao tentar conceder acesso a módulos a partir dos produtos:', e);
      }


    const response: CreateMemberResponse = {
      success: true,
      memberId: memberId || undefined,
      userId: userId || undefined,
      password,
      message: "Member created successfully",
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("CREATE_MEMBER_ERROR:", error);

    const response: CreateMemberResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
