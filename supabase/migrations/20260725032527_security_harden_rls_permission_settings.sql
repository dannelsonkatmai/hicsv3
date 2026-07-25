/*
# Harden RLS on permission_settings — restrict writes to admins only

## Problem
The original RLS policies on `permission_settings` allow any authenticated
tenant member to INSERT/UPDATE permission overrides. A responder could
theoretically grant themselves elevated privileges.

## Changes
- Drop the existing INSERT and UPDATE policies on `permission_settings`.
- Re-create them with an `is_admin()` check so only org_admin,
  facility_admin, or super_admin roles can modify permission settings.
- SELECT and DELETE policies remain unchanged (SELECT is tenant-scoped;
  DELETE already required is_admin()).

## Security
- INSERT: restricted to admins within the tenant.
- UPDATE: restricted to admins within the tenant.
*/

DROP POLICY IF EXISTS "tenant_insert_permission_settings" ON permission_settings;
DROP POLICY IF EXISTS "tenant_update_permission_settings" ON permission_settings;

CREATE POLICY "admin_insert_permission_settings" ON permission_settings
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.is_admin());

CREATE POLICY "admin_update_permission_settings" ON permission_settings
  FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.is_admin())
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.is_admin());
