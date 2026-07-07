import { useState, type FormEvent } from 'react';
import { Building2, Plus } from 'lucide-react';
import { useRecords } from '../../hooks/useRecords';
import { saveRecord, deleteRecord } from '../../lib/repo';
import { Badge, Button, Card, DataTable, EmptyState, Field, Input, Modal, PageHeader, Select } from '../../components/ui';
import { titleCase } from '../../lib/utils';
import type { Facility, Unit } from '../../types/domain';

const UNIT_TYPES = ['ed', 'icu', 'med_surg', 'peds', 'ob', 'periop', 'behavioral', 'stepdown', 'other'];

export function FacilitiesPage() {
  const { rows: facilities, reload: reloadFacilities } = useRecords<Facility>('facilities', { orderBy: 'name' });
  const { rows: units, reload: reloadUnits } = useRecords<Unit>('units', { orderBy: 'sort_order' });

  const [editingFacility, setEditingFacility] = useState<Partial<Facility> | null>(null);
  const [editingUnit, setEditingUnit] = useState<Partial<Unit> | null>(null);

  const saveFacility = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingFacility) return;
    await saveRecord('facilities', editingFacility as Record<string, unknown>);
    setEditingFacility(null);
    await reloadFacilities();
  };

  const saveUnit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingUnit) return;
    await saveRecord('units', editingUnit as Record<string, unknown>);
    setEditingUnit(null);
    await reloadUnits();
  };

  return (
    <div>
      <PageHeader
        title="Facilities & Units"
        subtitle="Campuses, nursing units, and bed configuration (licensed + surge)"
        actions={<Button onClick={() => setEditingFacility({ facility_type: 'acute_care', licensed_beds: 100 })}><Plus size={16} /> Add Facility</Button>}
      />

      {facilities.length === 0 ? (
        <EmptyState title="No facilities configured" />
      ) : (
        <div className="space-y-4">
          {facilities.map((facility) => {
            const facilityUnits = units.filter((u) => u.facility_id === facility.id);
            const licensed = facilityUnits.reduce((a, u) => a + u.licensed_beds, 0);
            const surge = facilityUnits.reduce((a, u) => a + u.surge_beds, 0);
            return (
              <Card
                key={facility.id}
                title={<span className="flex items-center gap-2"><Building2 size={15} /> {facility.name} {facility.is_primary && <Badge tone="blue">Primary</Badge>}</span>}
                subtitle={`${facility.licensed_beds} licensed beds · units total ${licensed} licensed / ${surge} surge`}
                actions={
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setEditingFacility(facility)}>Edit</Button>
                    <Button size="sm" variant="secondary" onClick={() => setEditingUnit({ facility_id: facility.id, unit_type: 'med_surg', licensed_beds: 0, surge_beds: 0 })}>
                      <Plus size={14} /> Add Unit
                    </Button>
                  </div>
                }
              >
                {facilityUnits.length === 0 ? (
                  <p className="text-sm text-slate-500">No units yet — add ED, ICU, med-surg, and other units to drive the bed board.</p>
                ) : (
                  <DataTable head={['Unit', 'Type', 'Licensed Beds', 'Surge Beds', '']}>
                    {facilityUnits.map((unit) => (
                      <tr key={unit.id} className="hover:bg-slate-800/70">
                        <td className="px-4 py-3 text-sm font-medium">{unit.name}</td>
                        <td className="px-4 py-3 text-sm">{titleCase(unit.unit_type)}</td>
                        <td className="px-4 py-3 text-sm">{unit.licensed_beds}</td>
                        <td className="px-4 py-3 text-sm">{unit.surge_beds}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button className="text-sm text-brand-400 hover:text-brand-300" onClick={() => setEditingUnit(unit)}>Edit</button>
                            <button className="text-sm text-slate-500 hover:text-red-300" onClick={() => void deleteRecord('units', unit.id).then(reloadUnits)}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </DataTable>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={editingFacility !== null} onClose={() => setEditingFacility(null)} title={editingFacility?.id ? 'Edit Facility' : 'Add Facility'}>
        <form onSubmit={saveFacility} className="space-y-4">
          <Field label="Facility Name" required>
            <Input value={editingFacility?.name ?? ''} onChange={(e) => setEditingFacility((d) => ({ ...d, name: e.target.value }))} required />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Licensed Beds">
              <Input type="number" min={0} value={editingFacility?.licensed_beds ?? 100} onChange={(e) => setEditingFacility((d) => ({ ...d, licensed_beds: Number(e.target.value) }))} />
            </Field>
            <Field label="Phone">
              <Input value={editingFacility?.phone ?? ''} onChange={(e) => setEditingFacility((d) => ({ ...d, phone: e.target.value }))} />
            </Field>
          </div>
          <Field label="Address">
            <Input value={editingFacility?.address ?? ''} onChange={(e) => setEditingFacility((d) => ({ ...d, address: e.target.value }))} />
          </Field>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={editingFacility?.is_primary ?? false} onChange={(e) => setEditingFacility((d) => ({ ...d, is_primary: e.target.checked }))} className="h-5 w-5 rounded border-slate-500 bg-slate-800 text-brand-600" />
            Primary facility
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setEditingFacility(null)}>Cancel</Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </Modal>

      <Modal open={editingUnit !== null} onClose={() => setEditingUnit(null)} title={editingUnit?.id ? 'Edit Unit' : 'Add Unit'}>
        <form onSubmit={saveUnit} className="space-y-4">
          <Field label="Unit Name" required>
            <Input value={editingUnit?.name ?? ''} onChange={(e) => setEditingUnit((d) => ({ ...d, name: e.target.value }))} required placeholder="e.g., 4 West, ED, ICU" />
          </Field>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Type">
              <Select value={editingUnit?.unit_type ?? 'med_surg'} onChange={(e) => setEditingUnit((d) => ({ ...d, unit_type: e.target.value as Unit['unit_type'] }))}>
                {UNIT_TYPES.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}
              </Select>
            </Field>
            <Field label="Licensed Beds">
              <Input type="number" min={0} value={editingUnit?.licensed_beds ?? 0} onChange={(e) => setEditingUnit((d) => ({ ...d, licensed_beds: Number(e.target.value) }))} />
            </Field>
            <Field label="Surge Beds">
              <Input type="number" min={0} value={editingUnit?.surge_beds ?? 0} onChange={(e) => setEditingUnit((d) => ({ ...d, surge_beds: Number(e.target.value) }))} />
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setEditingUnit(null)}>Cancel</Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
