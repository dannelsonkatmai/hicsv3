import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import {
  flushOutbox,
  getLastSyncedAt,
  onQueueChange,
  pendingCount,
  startSyncLoop,
  unresolvedConflictCount
} from '../lib/repo';

interface ConnectivityValue {
  online: boolean;
  pending: number;
  conflicts: number;
  lastSyncedAt: string | null;
  syncNow: () => Promise<void>;
}

const ConnectivityContext = createContext<ConnectivityValue | undefined>(undefined);

export function ConnectivityProvider({ children }: { children: ReactNode }) {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [pending, setPending] = useState(0);
  const [conflicts, setConflicts] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [p, c, last] = await Promise.all([pendingCount(), unresolvedConflictCount(), getLastSyncedAt()]);
    setPending(p);
    setConflicts(c);
    setLastSyncedAt(last);
  }, []);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    const stopSync = startSyncLoop();
    const unsubQueue = onQueueChange(() => void refresh());
    const interval = window.setInterval(() => void refresh(), 15_000);
    void refresh();

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      stopSync();
      unsubQueue();
      window.clearInterval(interval);
    };
  }, [refresh]);

  const syncNow = useCallback(async () => {
    await flushOutbox();
    await refresh();
  }, [refresh]);

  return (
    <ConnectivityContext.Provider value={{ online, pending, conflicts, lastSyncedAt, syncNow }}>
      {children}
    </ConnectivityContext.Provider>
  );
}

export function useConnectivity(): ConnectivityValue {
  const ctx = useContext(ConnectivityContext);
  if (!ctx) throw new Error('useConnectivity must be used within ConnectivityProvider');
  return ctx;
}
