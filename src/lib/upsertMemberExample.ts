// Example: how to call upsert-member-profile from frontend using supabase-js
import { supabase } from '@/integrations/supabase/client';

type UpsertBody = {
  user_id: string;
  name: string;
  email: string;
  phone: string;
  checkout_id: string;
  member_area_id?: string;
  selectedProducts?: string[];
  status?: 'active' | 'inactive';
};

export async function upsertMember(body: UpsertBody) {
  // supabase.functions.invoke will automatically attach the current session token
  try {
    const { data, error } = await supabase.functions.invoke('upsert-member-profile', {
      method: 'POST',
      body,
    });

    if (error) {
      // Error from invocation (non-2xx) — supabase-js surfaces this as error
      console.error('Edge function error:', error);
      throw new Error(error.message || 'Erro ao chamar função de membros');
    }

    if (!data?.success) {
      // Our function returns structured JSON { success: boolean, error?: string }
      throw new Error(data.error || 'Falha ao criar/atualizar membro');
    }

    return data;
  } catch (err: any) {
    console.error('Unexpected error calling upsert-member-profile:', err);
    throw err;
  }
}
