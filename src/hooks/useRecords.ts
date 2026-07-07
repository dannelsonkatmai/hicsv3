import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { listRecords, subscribeTable, type ListOptions } from '../lib/repo';

/**
 * Load rows through the offline-first repo, with optional Realtime refresh.
 * Pages re-render from cache when offline and live-update when online.
 */
export function useRecords<T = Record<string, unknown>>(
  table: string,
  options: ListOptions = {},
  config: { realtime?: boolean } = {}
) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const optionsKey = JSON.stringify(options);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const reload = useCallback(async () => {
    const data = await listRecords<T>(table, optionsRef.current);
    setRows(data);
    setLoading(false);
  }, [table, optionsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setLoading(true);
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!config.realtime) return;
    return subscribeTable(table, () => void reload());
  }, [table, config.realtime, reload]);

  return useMemo(() => ({ rows, loading, reload, setRows }), [rows, loading, reload]);
}
