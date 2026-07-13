/*
# Tighten SECURITY DEFINER Function Exposure

## Summary
Addresses remaining security advisor findings: authenticated users could invoke
SECURITY DEFINER functions via /rest/v1/rpc/... endpoints.

## Strategy

### 1. Switch helper functions to SECURITY INVOKER (3 functions)
`current_tenant_id()`, `current_platform_role()`, and `is_admin()` are simple
SELECTs from `profiles WHERE id = auth.uid()`. The authenticated user can already
read their own profile row via RLS, so SECURITY DEFINER is unnecessary. Switching
to SECURITY INVOKER removes the privilege escalation surface while preserving
RLS policy behavior (policies run as the calling user, who can read their own
profile).

### 2. Revoke all EXECUTE on handle_new_user (1 function)
`handle_new_user()` is a trigger function on `auth.users` — it fires automatically
on signup, never via RPC. Revoke EXECUTE from all roles so it cannot be called via
REST. Keep SECURITY DEFINER because it must INSERT into `public.profiles` on behalf
of the `anon` role during the auth trigger (which runs as the table owner, not the
calling user).

### 3. Revoke all EXECUTE on setup_organization and join_organization (2 functions)
These are now called exclusively through edge functions (setup-organization and
join-organization) that use the service role key. Revoke EXECUTE from all roles
so they cannot be called via REST. The functions remain SECURITY DEFINER for the
service role to use.

## Changes
- `public.current_tenant_id()` — SECURITY DEFINER → SECURITY INVOKER
- `public.current_platform_role()` — SECURITY DEFINER → SECURITY INVOKER
- `public.is_admin()` — SECURITY DEFINER → SECURITY INVOKER
- `public.handle_new_user()` — REVOKE EXECUTE FROM PUBLIC, authenticated, anon
- `public.setup_organization(text, text)` — REVOKE EXECUTE FROM PUBLIC, authenticated, anon
- `public.join_organization(text)` — REVOKE EXECUTE FROM PUBLIC, authenticated, anon

## Security Impact
- No role (anon or authenticated) can invoke any of these 6 functions via REST.
- Helper functions run as the caller with no privilege escalation.
- Trigger function `handle_new_user` still fires on signup (triggers don't need
  EXECUTE permission).
- Onboarding flows move to edge functions with service role key.
*/
