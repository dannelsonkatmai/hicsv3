import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, corsResponse } from '../_shared/cors.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData?.user) {
      return corsResponse({ error: 'Unauthorized' }, 401);
    }

    const userId = userData.user.id;
    const body = await req.json();
    const code: string = body?.code;

    if (!code || !code.trim()) {
      return corsResponse({ error: 'Invite code is required' }, 400);
    }

    const { data: existing } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', userId)
      .maybeSingle();

    if (existing?.tenant_id) {
      return corsResponse({ error: 'User already belongs to an organization' }, 409);
    }

    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id')
      .eq('invite_code', code.trim())
      .maybeSingle();

    if (orgError || !org) {
      return corsResponse({ error: 'Invalid invite code' }, 404);
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        tenant_id: org.id,
        platform_role: 'responder'
      })
      .eq('id', userId);

    if (profileError) {
      return corsResponse({ error: profileError.message ?? 'Failed to join organization' }, 500);
    }

    return corsResponse({ id: org.id });
  } catch (err) {
    return corsResponse({ error: err instanceof Error ? err.message : 'Internal error' }, 500);
  }
});
