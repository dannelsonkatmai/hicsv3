/*
# Tighten SECURITY DEFINER Function Exposure

## Summary
- Switch current_tenant_id(), current_platform_role(), is_admin() to SECURITY INVOKER.
- Revoke all EXECUTE on handle_new_user(), setup_organization(), join_organization().
*/

-- 1. Switch helper functions to SECURITY INVOKER (simple profile reads, no escalation needed)

CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_platform_role()
RETURNS text
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public
AS $$
  SELECT platform_role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COALESCE(public.current_platform_role() IN ('super_admin', 'org_admin', 'facility_admin'), false);
$$;

-- 2. Revoke all EXECUTE on trigger + onboarding functions (not callable via REST)

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, authenticated, anon;

REVOKE EXECUTE ON FUNCTION public.setup_organization(text, text) FROM PUBLIC, authenticated, anon;

REVOKE EXECUTE ON FUNCTION public.join_organization(text) FROM PUBLIC, authenticated, anon;
