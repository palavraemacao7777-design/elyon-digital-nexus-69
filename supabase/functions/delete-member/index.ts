import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, DELETE',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders, status: 200 });
  }

  if (req.method !== 'DELETE') {
    return new Response(JSON.stringify({ success: false, error: 'Method Not Allowed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    });
  }

  try {
    let supabaseUrl: string | null = null;
    let supabaseServiceKey: string | null = null;
    
    try {
      supabaseUrl = Deno.env.get('SUPABASE_URL');
      supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      
      if (!supabaseUrl || !supabaseServiceKey) {
        console.error('EDGE_FUNCTION_DEBUG: Missing env vars');
        return new Response(
          JSON.stringify({ success: false, error: 'Variáveis de ambiente não configuradas.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }
    } catch (envErr) {
      console.error('EDGE_FUNCTION_DEBUG: Error reading env vars:', envErr);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao acessar configurações.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let bodyData: any = {};
    try {
      bodyData = await req.json();
    } catch (parseErr) {
      console.error('EDGE_FUNCTION_DEBUG: Error parsing JSON body:', parseErr);
      return new Response(
        JSON.stringify({ success: false, error: 'JSON inválido no corpo da requisição.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const { userId } = bodyData;

    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, error: 'User ID is required.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`EDGE_FUNCTION_DEBUG: Attempting to delete user with ID: ${userId}`);

    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error('EDGE_FUNCTION_DEBUG: Error deleting user:', deleteError);
      return new Response(
        JSON.stringify({ success: false, error: deleteError.message || 'Failed to delete user.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log(`EDGE_FUNCTION_DEBUG: User ${userId} deleted successfully.`);
    return new Response(
      JSON.stringify({ success: true, message: 'User deleted successfully.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('EDGE_FUNCTION_DEBUG: General error in delete-member function:', error.message, 'Stack:', error.stack);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Internal server error.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});