import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, GraduationCap } from 'lucide-react';
import { useRecords } from '../../hooks/useRecords';
import { useAuth } from '../../contexts/AuthContext';
import { Badge, Button, DataTable, EmptyState, PageHeader, Tabs, statusTone } from '../../components/ui';
import { fmtDateTime, titleCase } from '../../lib/utils';
import type { Incident } from '../../types/domain';

export function IncidentsPage() {
  const { can } = useAuth();
  const [filter, setFilter] = useState('active');
  const { rows: incidents, loading } = useRecords<Incident>('incidents', { orderBy: 'started_at', ascending: false });

  const filtered = incidents.filter((i) => {
    if (filter === 'active') return i.status === 'active' || i.status === 'demobilizing' || i.status === 'pending';
    if (filter === 'training') return i.is_training || i.incident_type === 'exercise' || i.incident_type === 'drill';
    if (filter === 'closed') return i.status === 'closed';
    return true;
  });

  return (
    <div>
      <PageHeader
        title="Incidents"
        subtitle="Real events, exercises, drills, and planned events"
        actions={
          can('declare_incident') && (
            <Link to="/incidents/new">
              <Button variant="danger"><AlertTriangle size={16} /> Activate Incident</Button>
            </Link>
          )
        }
      />

      <Tabs
        tabs={[
          { key: 'active', label: 'Active' },
          { key: 'training', label: 'Exercises & Drills' },
          { key: 'closed', label: 'Closed' },
          { key: 'all', label: 'All' }
        ]}
        active={filter}
        onChange={setFilter}
      />

      {!loading && filtered.length === 0 ? (
        <EmptyState
          title="No incidents in this view"
          hint="Activate an incident to stand up the HIMT, build the IAP, and open the command workspace."
          action={can('declare_incident') ? (
            <Link to="/incidents/new"><Button>Activate Incident</Button></Link>
          ) : undefined}
        />
      ) : (
        <DataTable head={['Incident', 'Type', 'Activation', 'Severity', 'Status', 'Started', '']}>
          {filtered.map((incident) => (
            <tr key={incident.id} className="hover:bg-slate-800/70">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{incident.name}</span>
                  {incident.is_training && (
                    <span title="Training mode"><GraduationCap size={14} className="text-purple-400" /></span>
                  )}
                </div>
                {incident.incident_number && <p className="text-xs text-slate-500">#{incident.incident_number}</p>}
              </td>
              <td className="px-4 py-3 text-sm">{titleCase(incident.incident_type)}</td>
              <td className="px-4 py-3 text-sm">{titleCase(incident.activation_level)}</td>
              <td className="px-4 py-3"><Badge tone={statusTone(incident.severity)}>{titleCase(incident.severity)}</Badge></td>
              <td className="px-4 py-3"><Badge tone={statusTone(incident.status)}>{titleCase(incident.status)}</Badge></td>
              <td className="px-4 py-3 text-sm text-slate-400">{fmtDateTime(incident.started_at)}</td>
              <td className="px-4 py-3">
                <Link to={`/incidents/${incident.id}`} className="text-sm font-medium text-brand-400 hover:text-brand-300">
                  Open →
                </Link>
              </td>
            </tr>
          ))}
        </DataTable>
      )}
    </div>
  );
}
