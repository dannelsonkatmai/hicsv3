/*
# Role-based RLS for sensitive incident mutations

## Problem
The existing incident-related RLS policies only enforce tenant isolation:
any authenticated member of an org can INSERT, UPDATE, or DELETE incidents
and related operational data. This means a viewer or responder could bypass
client-side permission checks to close incidents, approve IAPs, or delete
incident records.

## Changes
- Replace the INSERT/UPDATE/DELETE policies on `incidents` with role-gated
  versions. Only program_manager, facility_admin, org_admin, and super_admin
  can create or modify incidents.
- Replace the UPDATE policy on `objectives` so only those roles can approve
  or modify incident objectives.
- Replace the UPDATE policy on `operational_periods` so only those roles
  can modify op-period status (approve IAPs, close periods).
- SELECT policies remain unchanged: all tenant members can view.

## Roles allowed for sensitive mutations
- super_admin
- org_admin
- facility_admin
- program_manager

## Security
Ensures that viewers, responders, and auditors cannot modify critical
incident state even if they craft direct API calls.
*/

-- ============================================================================
-- incidents: restrict INSERT/UPDATE/DELETE to manager+ roles
-- ============================================================================

DROP POLICY IF EXISTS "tenant_insert_incidents" ON incidents;
DROP POLICY IF EXISTS "tenant_update_incidents" ON incidents;
DROP POLICY IF EXISTS "tenant_delete_incidents" ON incidents;

CREATE POLICY "manager_insert_incidents" ON incidents
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.current_platform_role() IN ('super_admin', 'org_admin', 'facility_admin', 'program_manager')
  );

CREATE POLICY "manager_update_incidents" ON incidents
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_platform_role() IN ('super_admin', 'org_admin', 'facility_admin', 'program_manager')
  )
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "manager_delete_incidents" ON incidents
  FOR DELETE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_platform_role() IN ('super_admin', 'org_admin', 'facility_admin', 'program_manager')
  );

-- ============================================================================
-- operational_periods: restrict UPDATE/DELETE to manager+ roles
-- (INSERT stays tenant-wide so responders can start new op periods from UI)
-- ============================================================================

DROP POLICY IF EXISTS "tenant_update_operational_periods" ON operational_periods;
DROP POLICY IF EXISTS "tenant_delete_operational_periods" ON operational_periods;

CREATE POLICY "manager_update_operational_periods" ON operational_periods
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_platform_role() IN ('super_admin', 'org_admin', 'facility_admin', 'program_manager')
  )
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "manager_delete_operational_periods" ON operational_periods
  FOR DELETE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_platform_role() IN ('super_admin', 'org_admin', 'facility_admin', 'program_manager')
  );

-- ============================================================================
-- objectives: restrict UPDATE/DELETE to manager+ (responders can still add)
-- ============================================================================

DROP POLICY IF EXISTS "tenant_update_objectives" ON objectives;
DROP POLICY IF EXISTS "tenant_delete_objectives" ON objectives;

CREATE POLICY "manager_update_objectives" ON objectives
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_platform_role() IN ('super_admin', 'org_admin', 'facility_admin', 'program_manager')
  )
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "manager_delete_objectives" ON objectives
  FOR DELETE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_platform_role() IN ('super_admin', 'org_admin', 'facility_admin', 'program_manager')
  );
