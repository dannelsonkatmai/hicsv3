import { useCallback, useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';
import { getRecord, listRecords } from '../../../lib/repo';
import { cn, fmtDateTime, titleCase } from '../../../lib/utils';
import { Badge, Spinner, statusTone } from '../../../components/ui';
import type { Incident, OperationalPeriod } from '../../../types/domain';
import { IncidentContext } from './IncidentContext';
import { OverviewTab } from './OverviewTab';
import { HimtTab } from './HimtTab';
import { ObjectivesTab } from './ObjectivesTab';
import { FormsTab } from './FormsTab';
import { FormFillPage } from './FormFillPage';
import { IapTab } from './IapTab';
import { BoardsTab } from './BoardsTab';
import { SitRepTab } from './SitRepTab';
import { ResourcesTab } from './ResourcesTab';
import { LaborTab } from './LaborTab';
import { PatientsTab } from './PatientsTab';
import { CommsTab } from './CommsTab';
import { JasTab } from './JasTab';
import { DemobTab } from './DemobTab';

const tabs = [
  { path: '', label: 'Overview' },
  { path: 'himt', label: 'HIMT' },
  { path: 'objectives', label: 'Objectives' },
  { path: 'iap', label: 'IAP Builder' },
  { path: 'forms', label: 'Forms' },
  { path: 'boards', label: 'Status Boards' },
  { path: 'sitrep', label: 'SitRep' },
  { path: 'resources', label: 'Resources & Cost' },
  { path: 'labor', label: 'Labor Pool' },
  { path: 'patients', label: 'Patient Tracking' },
  { path: 'comms', label: 'Messages & Log' },
  { path: 'jas', label: 'JAS / IRG' },
  { path: 'demob', label: 'Demobilization' }
];

export function IncidentWorkspace() {
  const { incidentId = '' } = useParams();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [periods, setPeriods] = useState<OperationalPeriod[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const [inc, pds] = await Promise.all([
      getRecord<Incident>('incidents', incidentId),
      listRecords<OperationalPeriod>('operational_periods', {
        match: { incident_id: incidentId },
        orderBy: 'period_number',
        ascending: true
      })
    ]);
    setIncident(inc);
    setPeriods(pds);
    setLoading(false);
  }, [incidentId]);

  useEffect(() => {
    setLoading(true);
    void reload();
  }, [reload]);

  if (loading) return <Spinner label="Opening incident workspace…" />;
  if (!incident) return <Navigate to="/incidents" replace />;

  const currentPeriod = periods.find((p) => p.is_current) ?? periods[periods.length - 1] ?? null;

  return (
    <IncidentContext.Provider value={{ incident, periods, currentPeriod, reload }}>
      <div>
        {incident.is_training && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-purple-800 bg-purple-950/50 px-4 py-2 text-sm text-purple-200">
            <GraduationCap size={16} /> Training mode — this {incident.incident_type} is separated from real operations data.
          </div>
        )}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-100">{incident.name}</h1>
            <p className="text-xs text-slate-400">
              {titleCase(incident.incident_type)} · {titleCase(incident.activation_level)} activation ·
              {currentPeriod
                ? ` OP ${currentPeriod.period_number}: ${fmtDateTime(currentPeriod.starts_at)} – ${fmtDateTime(currentPeriod.ends_at)}`
                : ' No operational period'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={statusTone(incident.severity)}>{titleCase(incident.severity)}</Badge>
            <Badge tone={statusTone(incident.status)}>{titleCase(incident.status)}</Badge>
          </div>
        </div>

        <nav className="mb-5 flex gap-1 overflow-x-auto rounded-lg border border-slate-700 bg-slate-800/70 p-1">
          {tabs.map((tab) => (
            <NavLink
              key={tab.path}
              to={tab.path === '' ? `/incidents/${incidentId}` : `/incidents/${incidentId}/${tab.path}`}
              end={tab.path === ''}
              className={({ isActive }) =>
                cn(
                  'whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors min-h-touch',
                  isActive ? 'bg-brand-600 text-white' : 'text-slate-300 hover:bg-slate-700'
                )
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>

        <Routes>
          <Route index element={<OverviewTab />} />
          <Route path="himt" element={<HimtTab />} />
          <Route path="objectives" element={<ObjectivesTab />} />
          <Route path="iap" element={<IapTab />} />
          <Route path="forms" element={<FormsTab />} />
          <Route path="forms/:instanceId" element={<FormFillPage />} />
          <Route path="boards" element={<BoardsTab />} />
          <Route path="sitrep" element={<SitRepTab />} />
          <Route path="resources" element={<ResourcesTab />} />
          <Route path="labor" element={<LaborTab />} />
          <Route path="patients" element={<PatientsTab />} />
          <Route path="comms" element={<CommsTab />} />
          <Route path="jas" element={<JasTab />} />
          <Route path="demob" element={<DemobTab />} />
          <Route path="*" element={<Navigate to={`/incidents/${incidentId}`} replace />} />
        </Routes>
      </div>
    </IncidentContext.Provider>
  );
}
