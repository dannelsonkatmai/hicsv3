import { createContext, useContext } from 'react';
import type { Incident, OperationalPeriod } from '../../../types/domain';

export interface IncidentContextValue {
  incident: Incident;
  periods: OperationalPeriod[];
  currentPeriod: OperationalPeriod | null;
  reload: () => Promise<void>;
}

export const IncidentContext = createContext<IncidentContextValue | undefined>(undefined);

export function useIncident(): IncidentContextValue {
  const ctx = useContext(IncidentContext);
  if (!ctx) throw new Error('useIncident must be used inside the incident workspace');
  return ctx;
}
