/*
# Fix Function Security: Search Path & PUBLIC Execute Permissions

## Summary
Fixes two categories of security vulnerabilities:

1. Mutable search_path on trigger functions — set_updated_at(), assign_request_number(),
   assign_message_number() now pinned with SET search_path = public.
2. PUBLIC execute on SECURITY DEFINER functions — six functions revoked from PUBLIC/anon,
   granted only to authenticated.
*/

-- 1. Harden trigger functions with immutable search_path

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_request_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.request_number IS NULL THEN
    SELECT COALESCE(MAX(request_number), 0) + 1 INTO NEW.request_number
    FROM resource_requests WHERE incident_id = NEW.incident_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_message_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.message_number IS NULL THEN
    SELECT COALESCE(MAX(message_number), 0) + 1 INTO NEW.message_number
    FROM incident_messages WHERE incident_id = NEW.incident_id;
  END IF;
  RETURN NEW;
END;
$$;

-- 2. Revoke PUBLIC/anon execute on SECURITY DEFINER functions; grant to authenticated only

REVOKE EXECUTE ON FUNCTION public.current_tenant_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_tenant_id() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.current_platform_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_platform_role() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.setup_organization(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.setup_organization(text, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.join_organization(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_organization(text) TO authenticated;
