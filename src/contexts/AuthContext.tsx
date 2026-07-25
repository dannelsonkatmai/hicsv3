import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getRecord, listRecords, setRepoTenantId, clearOfflineData } from '../lib/repo';
import { setAuditActor } from '../lib/audit';
import { can, approvalThreshold, type PermissionAction, type PermissionOverride } from '../lib/permissions';
import type { Organization, Profile } from '../types/domain';

interface AuthContextValue {
  loading: boolean;
  configured: boolean;
  session: Session | null;
  profile: Profile | null;
  organization: Organization | null;
  permissionOverrides: PermissionOverride[];
  can: (action: PermissionAction) => boolean;
  requestApprovalThreshold: number;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [permissionOverrides, setPermissionOverrides] = useState<PermissionOverride[]>([]);

  const loadProfile = useCallback(async (userId: string, email: string) => {
    const prof = await getRecord<Profile>('profiles', userId);
    setProfile(prof);
    setRepoTenantId(prof?.tenant_id ?? null);
    setAuditActor(userId, email);
    if (prof?.tenant_id) {
      const [org, overrides] = await Promise.all([
        getRecord<Organization>('organizations', prof.tenant_id),
        listRecords<PermissionOverride & { tenant_id: string }>('permission_settings')
      ]);
      setOrganization(org);
      setPermissionOverrides(overrides);
    } else {
      setOrganization(null);
      setPermissionOverrides([]);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (!mounted) return;
        setSession(data.session);
        if (data.session?.user) {
          await loadProfile(data.session.user.id, data.session.user.email ?? '');
        }
      })
      .finally(() => mounted && setLoading(false));

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      if (newSession?.user) {
        await loadProfile(newSession.user.id, newSession.user.email ?? '');
      } else {
        setProfile(null);
        setOrganization(null);
        setRepoTenantId(null);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const refreshProfile = useCallback(async () => {
    if (session?.user) await loadProfile(session.user.id, session.user.email ?? '');
  }, [session, loadProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    await clearOfflineData();
    setProfile(null);
    setOrganization(null);
    setRepoTenantId(null);
  }, []);

  const value: AuthContextValue = {
    loading,
    configured: isSupabaseConfigured,
    session,
    profile,
    organization,
    permissionOverrides,
    can: (action) => can(profile, action, permissionOverrides),
    requestApprovalThreshold: approvalThreshold(permissionOverrides),
    refreshProfile,
    signOut
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
