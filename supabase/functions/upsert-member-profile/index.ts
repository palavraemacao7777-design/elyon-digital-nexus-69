// upsert-member-profile - Deno Edge Function (corrigido)
// - Corrige problemas com DELETE id=in.(...), adiciona Prefer resolution=merge-duplicates
// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type BodyShape = {
  user_id?: string;
  name: string;
  email: string;
  phone?: string;
  checkout_id?: string;
  member_area_id?: string;
  selectedProducts?: string[];
  status?: 'active' | 'inactive';
};

function jsonError(msg: string, status = 400) {
  return new Response(JSON.stringify({ success: false, error: msg }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}

function env(name: string) {
  // @ts-ignore
  return Deno.env.get(name) || '';
}

async function restFetch(path: string, options: RequestInit & { serviceKey: string }) {
  const { serviceKey, ...rest } = options as any;
  const res = await fetch(path, {
    ...rest,
    headers: {
      ...(rest.headers || {}),
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
    },
  });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
  return { status: res.status, ok: res.ok, data, headers: res.headers };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonError('Método não permitido', 405);

  const SUPABASE_URL = env('SUPABASE_URL');
  const SERVICE_ROLE_KEY = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return jsonError('SUPABASE_URL ou SERVICE_ROLE_KEY não configuradas.', 500);

  // Parse JSON
  let body: any;
  try { body = await req.json(); } catch (e) { return jsonError('JSON inválido no corpo da requisição.', 400); }

  // Normalize payload and support camelCase keys from frontend
  const payloadRaw: any = { ...(body || {}) };
  if (payloadRaw.memberAreaId && !payloadRaw.member_area_id) payloadRaw.member_area_id = payloadRaw.memberAreaId;
  if (payloadRaw.selectedProducts && !payloadRaw.selected_products) payloadRaw.selected_products = payloadRaw.selectedProducts;
  if (payloadRaw.userId && !payloadRaw.user_id) payloadRaw.user_id = payloadRaw.userId;

  const required = ['name', 'email', 'member_area_id'];
  for (const f of required) {
    if (!Object.prototype.hasOwnProperty.call(payloadRaw, f) || payloadRaw[f] === null || payloadRaw[f] === undefined || String(payloadRaw[f]).trim() === '') {
      return jsonError(`Campo obrigatório ausente ou inválido: ${f}`, 422);
    }
  }

  const payload: BodyShape = {
    user_id: payloadRaw.user_id ? String(payloadRaw.user_id) : undefined,
    name: String(payloadRaw.name),
    email: String(payloadRaw.email).toLowerCase(),
    phone: payloadRaw.phone ? String(payloadRaw.phone) : undefined,
    checkout_id: payloadRaw.checkout_id ? String(payloadRaw.checkout_id) : undefined,
    member_area_id: payloadRaw.member_area_id ? String(payloadRaw.member_area_id) : undefined,
    selectedProducts: Array.isArray(payloadRaw.selected_products) ? payloadRaw.selected_products.map(String) : (Array.isArray(payloadRaw.selectedProducts) ? payloadRaw.selectedProducts.map(String) : []),
    status: payloadRaw.status === 'inactive' ? 'inactive' : 'active',
  };

  // Validate Authorization header belongs to the same user
  const authHeader = req.headers.get('authorization') || '';
  const tokenMatch = authHeader.match(/Bearer\s+(.+)/i);
  if (!tokenMatch) return jsonError('Authorization header faltando ou mal formado.', 401);
  const token = tokenMatch[1];

  try {
    const userUrl = `${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/user`;
    const userRes = await fetch(userUrl, { headers: { Authorization: `Bearer ${token}` } });
    if (!userRes.ok) return jsonError('Não foi possível validar o token do usuário.', 401);
    const userData = await userRes.json();
    const tokenUserId = userData?.id;
    if (!tokenUserId) return jsonError('Token inválido: user id não encontrado.', 401);
    if (tokenUserId !== payload.user_id) return jsonError('user_id no payload não corresponde ao usuário autenticado.', 403);
  } catch (err) {
    console.warn('Erro ao verificar token:', err);
    return jsonError('Erro interno ao verificar token.', 500);
  }

  const restBase = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1`;

  try {
    // Determine existing member by user_id or email
    let existingMember: any = null;
    let effectiveUserId: string | null = payload.user_id ?? null;
    if (payload.user_id) {
      const q = `user_id=eq.${encodeURIComponent(String(payload.user_id))}&select=id,password_hash&limit=1`;
      const checkUrl = `${restBase}/members?${q}`;
      const check = await restFetch(checkUrl, { method: 'GET', serviceKey: SERVICE_ROLE_KEY });
      if (!check.ok && check.status !== 404) {
        return jsonError(`Erro ao consultar members (status ${check.status}): ${JSON.stringify(check.data)}`, 500);
      }
      existingMember = Array.isArray(check.data) && check.data.length > 0 ? check.data[0] : null;
    }
    let memberId: string | null = null;

    if (!existingMember) {
      // New member: check member_settings for default fixed password
      let chosenPassword: string | null = null;
      if (payload.member_area_id) {
        const sUrl = `${restBase}/member_settings?member_area_id=eq.${encodeURIComponent(payload.member_area_id)}&select=default_password_mode,default_fixed_password&limit=1`;
        const sResp = await restFetch(sUrl, { method: 'GET', serviceKey: SERVICE_ROLE_KEY });
        if (!sResp.ok) {
          console.warn('Aviso: falha ao consultar member_settings:', sResp.status, sResp.data);
        } else {
          const settings = Array.isArray(sResp.data) && sResp.data.length ? sResp.data[0] : null;
          if (settings && settings.default_password_mode === 'fixed' && settings.default_fixed_password) chosenPassword = settings.default_fixed_password;
        }
      }

      const generatedUserId = payload.user_id || crypto.randomUUID();
      effectiveUserId = generatedUserId;
      const upsertPayload: any = {
        user_id: generatedUserId,
        name: payload.name,
        email: payload.email,
        phone: payload.phone,
        checkout_id: payload.checkout_id || null,
        member_area_id: payload.member_area_id || null,
        status: payload.status || 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      // Ensure password_hash is always set (schema requires it)
      let finalPassword = chosenPassword;
      if (!finalPassword) {
        finalPassword = Array.from(crypto.getRandomValues(new Uint8Array(12))).map(b => (b % 36).toString(36)).join('');
      }
      upsertPayload.password_hash = await bcrypt.hash(finalPassword as string);

      const insertUrl = `${restBase}/members`;
      const insertRes = await restFetch(insertUrl, {
        method: 'POST',
        serviceKey: SERVICE_ROLE_KEY,
        headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify(upsertPayload),
      });
      if (!insertRes.ok) {
        return jsonError(`Erro ao criar membro (status ${insertRes.status}): ${JSON.stringify(insertRes.data)}`, 500);
      }
      const inserted = Array.isArray(insertRes.data) && insertRes.data.length ? insertRes.data[0] : null;
      if (!inserted || !inserted.id) return jsonError('Falha ao criar membro: sem id retornado.', 500);
      memberId = inserted.id;
    } else {
      memberId = existingMember.id;
      const updatePayload: any = {
        name: payload.name,
        email: payload.email,
        phone: payload.phone,
        checkout_id: payload.checkout_id,
        member_area_id: payload.member_area_id || null,
        status: payload.status || 'active',
        updated_at: new Date().toISOString(),
      };
      if (!existingMember.password_hash && payload.member_area_id) {
        const sUrl = `${restBase}/member_settings?member_area_id=eq.${encodeURIComponent(payload.member_area_id)}&select=default_password_mode,default_fixed_password&limit=1`;
        const sResp = await restFetch(sUrl, { method: 'GET', serviceKey: SERVICE_ROLE_KEY });
        if (sResp.ok) {
          const settings = Array.isArray(sResp.data) && sResp.data.length ? sResp.data[0] : null;
          if (settings && settings.default_password_mode === 'fixed' && settings.default_fixed_password) {
            updatePayload.password_hash = await bcrypt.hash(settings.default_fixed_password as string);
          }
        } else {
          console.warn('Aviso: falha ao consultar member_settings no update:', sResp.status, sResp.data);
        }
      }

      const updateUrl = `${restBase}/members?id=eq.${encodeURIComponent(String(memberId))}`;
      const updateRes = await restFetch(updateUrl, {
        method: 'PATCH',
        serviceKey: SERVICE_ROLE_KEY,
        headers: { 'Content-Type': 'application/json' , Prefer: 'return=representation'},
        body: JSON.stringify(updatePayload),
      });
      if (!updateRes.ok) return jsonError(`Erro ao atualizar membro (status ${updateRes.status}): ${JSON.stringify(updateRes.data)}`, 500);
    }

    // Upsert profile (on_conflict=user_id) - resolution=merge-duplicates
    const profilePayload = [{ user_id: effectiveUserId, email: payload.email, name: payload.name, phone: payload.phone, member_area_id: payload.member_area_id || null, updated_at: new Date().toISOString() }];
    const profilesUrl = `${restBase}/profiles?on_conflict=user_id`;
    const profilesRes = await restFetch(profilesUrl, {
      method: 'POST',
      serviceKey: SERVICE_ROLE_KEY,
      headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify(profilePayload),
    });
    if (!profilesRes.ok) console.warn('Warning: profiles upsert failed:', profilesRes.status, profilesRes.data);

    // Sync member_access
    if (Array.isArray(payload.selectedProducts) && payload.selectedProducts.length > 0) {
      const accessInserts = payload.selectedProducts.map((p: string) => ({ member_id: memberId, product_id: p, status: 'active' }));
      const accessUrl = `${restBase}/member_access?on_conflict=member_id,product_id`;
      const accessRes = await restFetch(accessUrl, {
        method: 'POST',
        serviceKey: SERVICE_ROLE_KEY,
        headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify(accessInserts),
      });
      if (!accessRes.ok) return jsonError(`Erro ao atualizar member_access (status ${accessRes.status}): ${JSON.stringify(accessRes.data)}`, 500);

      // delete not selected
      const currentUrl = `${restBase}/member_access?member_id=eq.${encodeURIComponent(String(memberId))}&select=id,product_id`;
      const currentRes = await restFetch(currentUrl, { method: 'GET', serviceKey: SERVICE_ROLE_KEY });
      const currentAccess = (currentRes.ok && Array.isArray(currentRes.data)) ? currentRes.data : [];
      const toDelete = currentAccess.filter((a: any) => !payload.selectedProducts!.includes(a.product_id)).map((a: any) => a.id);

      if (toDelete.length > 0) {
        // IMPORTANT: for string/uuid ids PostgREST requires quoting: in.('id1','id2')
        const quoted = toDelete.map((id: any) => `'${String(id).replace(/'/g, "''")}'`).join(',');
        const deleteUrl = `${restBase}/member_access?id=in.(${quoted})`;
        const delRes = await restFetch(deleteUrl, { method: 'DELETE', serviceKey: SERVICE_ROLE_KEY });
        if (!delRes.ok) console.warn('Warning deleting old member_access:', delRes.status, delRes.data);
      }
    } else {
      const delAllUrl = `${restBase}/member_access?member_id=eq.${encodeURIComponent(String(memberId))}`;
      const delAllRes = await restFetch(delAllUrl, { method: 'DELETE', serviceKey: SERVICE_ROLE_KEY });
      if (!delAllRes.ok) console.warn('Warning deleting member_access:', delAllRes.status, delAllRes.data);
    }

    // Best-effort update to auth user metadata via Admin API
    try {
      if (effectiveUserId) {
        const adminUrl = `${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/admin/users/${encodeURIComponent(String(effectiveUserId))}`;
        const adminRes = await fetch(adminUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_ROLE_KEY}`, apikey: SERVICE_ROLE_KEY },
        body: JSON.stringify({ user_metadata: { name: payload.name, phone: payload.phone, member_area_id: payload.member_area_id || null, status: payload.status || 'active' } }),
      });
        if (!adminRes.ok) console.warn('Warning updating auth metadata:', adminRes.status, await adminRes.text());
      } else {
        console.warn('No effectiveUserId available to update auth metadata.');
      }
    } catch (e) {
      console.warn('Warning updating auth metadata error:', e);
    }

    return new Response(JSON.stringify({ success: true, memberId }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
  } catch (err: any) {
    console.error('Unhandled error in upsert-member-profile:', err);
    return jsonError('Erro interno não tratado: ' + (err?.message || String(err)), 500);
  }
});
