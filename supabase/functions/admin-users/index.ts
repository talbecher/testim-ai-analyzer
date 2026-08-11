import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, type User } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function requireAuth(req: Request): Promise<User | Response> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  return user;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof Response) return authResult;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    const { data: callerRole, error: roleError } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('id', authResult.id)
      .maybeSingle();

    if (roleError || callerRole?.role !== 'admin') {
      return jsonResponse({ error: 'Forbidden' }, 403);
    }

    const body = await req.json();
    const { action } = body;

    if (action === 'list') {
      const { data: authData, error: listError } = await adminClient.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });
      if (listError) throw listError;

      const userIds = authData.users.map((u) => u.id);
      const { data: roles } = await adminClient
        .from('user_roles')
        .select('id, role')
        .in('id', userIds);

      const roleMap = new Map((roles ?? []).map((r) => [r.id, r.role]));

      const users = authData.users.map((u) => ({
        id: u.id,
        email: u.email ?? '',
        role: roleMap.get(u.id) ?? 'member',
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
      }));

      return jsonResponse({ users });
    }

    if (action === 'updateRole') {
      const { userId, role } = body;
      if (!userId || !['admin', 'member'].includes(role)) {
        return jsonResponse({ error: 'Invalid userId or role' }, 400);
      }

      const { error } = await adminClient
        .from('user_roles')
        .upsert({ id: userId, role, updated_at: new Date().toISOString() });

      if (error) throw error;
      return jsonResponse({ success: true });
    }

    if (action === 'delete') {
      const { userId } = body;
      if (!userId) return jsonResponse({ error: 'userId required' }, 400);
      if (userId === authResult.id) {
        return jsonResponse({ error: 'Cannot delete yourself' }, 400);
      }

      const { error } = await adminClient.auth.admin.deleteUser(userId);
      if (error) throw error;
      return jsonResponse({ success: true });
    }

    return jsonResponse({ error: 'Unknown action' }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    console.error('admin-users error:', message);
    return jsonResponse({ error: message }, 500);
  }
});
