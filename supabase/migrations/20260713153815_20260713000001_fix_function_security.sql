/*
# Fix Function Security: Search Path & PUBLIC Execute Permissions

## Summary
Fixes two categories of security vulnerabilities flagged by Supabase's security advisor:

1. **Mutable search_path on trigger functions** — `set_updated_at()`, `assign_request_number()`, and `assign_message_number()` were defined without a `SET search_path` clause, making them vulnerable to search-path hijacking. All three are now pinned with `SET search_path = public`.

2. **PUBLIC execute on SECURITY DEFINER functions** — Six functions (`current_tenant_id`, `current_platform_role`, `is_admin`, `handle_new_user`, `setup_organization`, `join_organization`) were executable by the `anon` role via `/rest/v1/rpc/...`, allowing unauthenticated users to invoke SECURITY DEFINER functions. `EXECUTE` is revoked from `PUBLIC` and `anon`, and granted only to `authenticated`.

## Changes

### Search path hardening (3 functions)
- `public.set_updated_at()` — redefined with `SET search_path = public`
- `public.assign_request_number()` — redefined with `SET search_path = public`
- `public.assign_message_number()` — redefined with `SET search_path = public`

### Execute permission tightening (6 functions)
- `public.current_tenant_id()` — REVOKE from PUBLIC, anon; GRANT to authenticated
- `public.current_platform_role()` — REVOKE from PUBLIC, anon; GRANT to authenticated
- `public.is_admin()` — REVOKE from PUBLIC, anon; GRANT to authenticated
- `public.handle_new_user()` — REVOKE from PUBLIC, anon; GRANT to authenticated
- `public.setup_organization(text, text)` — REVOKE from PUBLIC, anon; GRANT to authenticated
- `public.join_organization(text)` — REVOKE from PUBLIC, anon; GRANT to authenticated

## Security Impact
- Unauthenticated (`anon`) callers can no longer invoke any SECURITY DEFINER function.
- Trigger functions are immune to search-path hijacking.
- All existing authenticated-user functionality is preserved.
*/
