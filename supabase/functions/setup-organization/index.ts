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
    const orgName: string = body?.org_name;
    const facilityName: string = body?.facility_name || orgName;

    if (!orgName || !orgName.trim()) {
      return corsResponse({ error: 'Organization name is required' }, 400);
    }

    const { data: existing } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', userId)
      .maybeSingle();

    if (existing?.tenant_id) {
      return corsResponse({ error: 'User already belongs to an organization' }, 409);
    }

    const { data: newOrg, error: orgError } = await supabase
      .from('organizations')
      .insert({ name: orgName.trim() })
      .select('id')
      .single();

    if (orgError || !newOrg) {
      return corsResponse({ error: orgError?.message ?? 'Failed to create organization' }, 500);
    }

    const { data: newFacility, error: facilityError } = await supabase
      .from('facilities')
      .insert({
        tenant_id: newOrg.id,
        name: facilityName.trim(),
        is_primary: true
      })
      .select('id')
      .single();

    if (facilityError || !newFacility) {
      await supabase.from('organizations').delete().eq('id', newOrg.id);
      return corsResponse({ error: facilityError?.message ?? 'Failed to create facility' }, 500);
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        tenant_id: newOrg.id,
        platform_role: 'org_admin',
        facility_ids: [newFacility.id]
      })
      .eq('id', userId);

    if (profileError) {
      return corsResponse({ error: profileError.message ?? 'Failed to update profile' }, 500);
    }

    return corsResponse({ id: newOrg.id });
  } catch (err) {
    return corsResponse({ error: err instanceof Error ? err.message : 'Internal error' }, 500);
  }
});
