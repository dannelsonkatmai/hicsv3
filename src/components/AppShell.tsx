import { useState, type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Activity, TriangleAlert as AlertTriangle, ChartBar as BarChart3, Bell, Building2, ClipboardList, CloudOff, FileText, FolderCog, LayoutDashboard, Library, LogOut, Menu, RefreshCw, Settings, Shield, ShieldCheck, Users, Wifi, X, CreditCard, ScrollText, CalendarClock, ListChecks, Landmark, BookOpenCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useConnectivity } from '../contexts/ConnectivityContext';
import { cn, fmtTime } from '../lib/utils';

const navSections: Array<{
  label: string;
  items: Array<{ to: string; label: string; icon: typeof Activity; adminOnly?: boolean }>;
}> = [
  {
    label: 'Operations',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/incidents', label: 'Incidents', icon: AlertTriangle },
      { to: '/defaults', label: 'Form Defaults', icon: Library },
      { to: '/notifications', label: 'Notifications', icon: Bell }
    ]
  },
  {
    label: 'Preparedness',
    items: [
      { to: '/preparedness/hva', label: 'HVA', icon: Activity },
      { to: '/preparedness/plans', label: 'EOP & Plans', icon: FileText },
      { to: '/preparedness/plan-builder', label: 'Plan Builder', icon: BookOpenCheck },
      { to: '/preparedness/exercises', label: 'Exercises & Drills', icon: CalendarClock },
      { to: '/preparedness/aar', label: 'AAR / Improvement', icon: ClipboardList },
      { to: '/preparedness/capa', label: 'Corrective Actions', icon: ListChecks },
      { to: '/preparedness/compliance', label: 'Compliance', icon: ShieldCheck }
    ]
  },
  {
    label: 'Insights',
    items: [{ to: '/reports', label: 'Report Center', icon: BarChart3 }]
  },
  {
    label: 'Administration',
    items: [
      { to: '/admin/organization', label: 'Organization', icon: Settings, adminOnly: true },
      { to: '/admin/facilities', label: 'Facilities & Units', icon: Building2, adminOnly: true },
      { to: '/admin/users', label: 'Users & Personnel', icon: Users, adminOnly: true },
      { to: '/admin/catalog', label: 'Resources & Vendors', icon: FolderCog, adminOnly: true },
      { to: '/admin/forms', label: 'Form Templates', icon: ScrollText, adminOnly: true },
      { to: '/admin/jas', label: 'Job Action Sheets', icon: ClipboardList, adminOnly: true },
      { to: '/admin/permissions', label: 'Roles & Permissions', icon: Shield, adminOnly: true },
      { to: '/admin/billing', label: 'Billing', icon: CreditCard, adminOnly: true },
      { to: '/admin/audit', label: 'Audit Log', icon: Landmark, adminOnly: true }
    ]
  }
];

export function AppShell({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { profile, organization, signOut, can } = useAuth();
  const navigate = useNavigate();
  const isAdmin = can('manage_admin') || can('view_audit_log');

  return (
    <div className="flex min-h-screen bg-slate-900 text-slate-100">
      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-64 transform border-r border-slate-700 bg-slate-950/95 transition-transform lg:static lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-800 px-4">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 text-left">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg overflow-hidden">
              <img src="/Essential_HICS-256.png" alt="Essential HICS" className="h-9 w-9 object-contain" />
            </div>
            <div>
              <p className="text-sm font-bold leading-tight">Essential HICS</p>
              <p className="max-w-[150px] truncate text-xs text-slate-400">{organization?.name ?? 'No organization'}</p>
            </div>
          </button>
          <button className="rounded p-1.5 text-slate-400 hover:bg-slate-800 lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>
        <nav className="h-[calc(100vh-4rem)] space-y-5 overflow-y-auto p-3 pb-24">
          {navSections.map((section) => {
            const items = section.items.filter((i) => !i.adminOnly || isAdmin);
            if (!items.length) return null;
            return (
              <div key={section.label}>
                <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">{section.label}</p>
                {items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'flex min-h-touch items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                        isActive ? 'bg-brand-600/20 text-brand-300' : 'text-slate-300 hover:bg-slate-800 hover:text-slate-100'
                      )
                    }
                  >
                    <item.icon size={17} />
                    {item.label}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>
      </aside>
      {sidebarOpen && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-slate-700 bg-slate-900/95 px-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <button className="rounded p-2 text-slate-400 hover:bg-slate-800 lg:hidden" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
              <Menu size={20} />
            </button>
            <SyncIndicator />
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium leading-tight">{profile?.full_name || profile?.email}</p>
              <p className="text-xs capitalize text-slate-400">{profile?.platform_role?.replace(/_/g, ' ')}</p>
            </div>
            <button
              onClick={() => void signOut()}
              className="flex min-h-touch items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}

function SyncIndicator() {
  const { online, pending, conflicts, lastSyncedAt, syncNow } = useConnectivity();
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncNow();
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => void handleSync()}
        title={lastSyncedAt ? `Last synced ${fmtTime(lastSyncedAt)}` : 'Not synced yet'}
        className={cn(
          'flex min-h-touch items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium',
          online
            ? 'border-emerald-800 bg-emerald-950/60 text-emerald-300'
            : 'border-amber-700 bg-amber-950/60 text-amber-300'
        )}
      >
        {online ? <Wifi size={14} /> : <CloudOff size={14} />}
        {online ? (pending > 0 ? `Online · ${pending} to sync` : 'Online · Synced') : `Offline · ${pending} queued`}
        {syncing && <RefreshCw size={13} className="animate-spin" />}
      </button>
      {conflicts > 0 && (
        <span className="flex items-center gap-1 rounded-full border border-red-800 bg-red-950/60 px-3 py-1.5 text-xs font-medium text-red-300">
          <AlertTriangle size={13} /> {conflicts} sync conflict{conflicts > 1 ? 's' : ''}
        </span>
      )}
    </div>
  );
}
