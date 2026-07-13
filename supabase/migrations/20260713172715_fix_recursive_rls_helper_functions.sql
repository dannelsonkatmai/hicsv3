/*
  # Fix recursive RLS: switch helper functions back to SECURITY DEFINER

  The "tighten function security" migration switched current_tenant_id(),
  current_platform_role(), and is_admin() from SECURITY DEFINER to SECURITY
  INVOKER. However, these functions query the `profiles` table, whose RLS
  policies call current_tenant_id() — creating infinite recursion that
  triggers "stack depth limit exceeded" errors on every authenticated query.

  Switch them back to SECURITY DEFINER. This is safe because:
    - The functions only SELECT from profiles WHERE id = auth.uid()
    - The caller can already read their own profile row via RLS
    - SECURITY DEFINER bypasses RLS, breaking the recursion

  The EXECUTE revokes on setup_organization / join_organization / handle_new_user
  are preserved (those remain SECURITY DEFINER with no public EXECUTE).
*/

CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_platform_role()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT platform_role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.current_platform_role() IN ('super_admin', 'org_admin', 'facility_admin'), false);
$$;
