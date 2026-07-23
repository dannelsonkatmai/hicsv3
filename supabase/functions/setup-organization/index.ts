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

    // Preload the standard HICS standing incident objectives so new orgs can
    // pull them into HICS 202 / the Objectives tab immediately.
    const defaultObjectives = [
      'Ensure the life safety of all patients, visitors, staff, and responders through implementation of appropriate protective actions throughout the operational period.',
      'Maintain the continuity of essential patient care services while prioritizing critical clinical operations and allocating available resources based on patient acuity.',
      'Establish and maintain an effective Hospital Incident Command System organization with appropriate staffing, incident action planning, and operational coordination.',
      'Maintain situational awareness through continuous assessment of incident conditions, operational impacts, resource status, and anticipated needs, providing regular updates to incident leadership.',
      'Coordinate timely and accurate internal and external communications with staff, patients, families, partner agencies, and the public to support incident response and operational decision-making.',
      'Identify, obtain, and manage personnel, equipment, supplies, pharmaceuticals, and other critical resources necessary to sustain hospital operations throughout the incident.',
      'Protect hospital facilities, infrastructure, information systems, medical equipment, and other critical assets while minimizing environmental impacts resulting from the incident.',
      'Coordinate patient movement activities, including patient tracking, transfers, admissions, discharges, and evacuation or shelter-in-place operations, as required by incident conditions.',
      'Maintain the safety, health, and well-being of staff and responders through appropriate work practices, personal protective measures, behavioral health support, and management of staff needs.',
      'Develop and implement a transition strategy for demobilization and recovery that supports restoration of normal operations while documenting incident actions and identifying improvement opportunities.'
    ];
    const { error: defaultsError } = await supabase.from('form_defaults').insert(
      defaultObjectives.map((objective, i) => ({
        tenant_id: newOrg.id,
        category: 'objectives',
        data: { priority: i + 1, objective },
        sort_order: i,
        is_active: true
      }))
    );
    if (defaultsError) {
      // Non-fatal: org is created; defaults can be added later.
      console.error('Failed to seed default objectives:', defaultsError.message);
    }

    return corsResponse({ id: newOrg.id });
  } catch (err) {
    return corsResponse({ error: err instanceof Error ? err.message : 'Internal error' }, 500);
  }
});
