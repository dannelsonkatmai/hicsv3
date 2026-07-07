import { useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { useRecords } from '../../hooks/useRecords';
import { saveRecord, deleteRecord } from '../../lib/repo';
import { Badge, Button, Card, DataTable, EmptyState, Field, Input, Modal, PageHeader, Select, Tabs } from '../../components/ui';
import { fmtMoney, titleCase } from '../../lib/utils';
import type { InventoryItem, ResourceItem, Vendor } from '../../types/domain';

export function CatalogPage() {
  const [tab, setTab] = useState('resources');
  return (
    <div>
      <PageHeader title="Resources & Vendors" subtitle="Requestable resource catalog, supplier directory, and critical-supply inventory" />
      <Tabs
        tabs={[
          { key: 'resources', label: 'Resource Catalog' },
          { key: 'vendors', label: 'Vendors' },
          { key: 'inventory', label: 'Inventory & Caches' }
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'resources' && <ResourcesPanel />}
      {tab === 'vendors' && <VendorsPanel />}
      {tab === 'inventory' && <InventoryPanel />}
    </div>
  );
}

function ResourcesPanel() {
  const { rows, reload } = useRecords<ResourceItem>('resources', { orderBy: 'name' });
  const { rows: vendors } = useRecords<Vendor>('vendors', { orderBy: 'name' });
  const [editing, setEditing] = useState<Partial<ResourceItem> | null>(null);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    await saveRecord('resources', editing as Record<string, unknown>);
    setEditing(null);
    await reload();
  };

  return (
    <Card
      title="Resource Catalog"
      actions={<Button size="sm" onClick={() => setEditing({ category: 'supplies', unit_of_measure: 'each', unit_cost: 0, is_active: true })}><Plus size={14} /> Add</Button>}
    >
      {rows.length === 0 ? (
        <EmptyState title="Catalog is empty" hint="Catalog items speed up resource requests and cost estimation." />
      ) : (
        <DataTable head={['Item', 'Category', 'UoM', 'Unit Cost', 'Vendor', '']}>
          {rows.map((item) => (
            <tr key={item.id} className="hover:bg-slate-800/70">
              <td className="px-4 py-3 text-sm font-medium">{item.name}</td>
              <td className="px-4 py-3 text-sm">{titleCase(item.category)}</td>
              <td className="px-4 py-3 text-sm">{item.unit_of_measure}</td>
              <td className="px-4 py-3 text-sm">{fmtMoney(item.unit_cost)}</td>
              <td className="px-4 py-3 text-sm">{vendors.find((v) => v.id === item.vendor_id)?.name ?? '—'}</td>
              <td className="px-4 py-3">
                <div className="flex gap-2">
                  <button className="text-sm text-brand-400 hover:text-brand-300" onClick={() => setEditing(item)}>Edit</button>
                  <button className="text-sm text-slate-500 hover:text-red-300" onClick={() => void deleteRecord('resources', item.id).then(reload)}>Delete</button>
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
      )}

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing?.id ? 'Edit Resource' : 'Add Resource'}>
        <form onSubmit={save} className="space-y-4">
          <Field label="Name" required>
            <Input value={editing?.name ?? ''} onChange={(e) => setEditing((d) => ({ ...d, name: e.target.value }))} required />
          </Field>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Category">
              <Select value={editing?.category ?? 'supplies'} onChange={(e) => setEditing((d) => ({ ...d, category: e.target.value }))}>
                {['equipment', 'supplies', 'medications', 'beds', 'vehicles', 'facilities', 'personnel', 'other'].map((c) => (
                  <option key={c} value={c}>{titleCase(c)}</option>
                ))}
              </Select>
            </Field>
            <Field label="Unit of Measure">
              <Input value={editing?.unit_of_measure ?? 'each'} onChange={(e) => setEditing((d) => ({ ...d, unit_of_measure: e.target.value }))} />
            </Field>
            <Field label="Unit Cost ($)">
              <Input type="number" min={0} step="0.01" value={editing?.unit_cost ?? 0} onChange={(e) => setEditing((d) => ({ ...d, unit_cost: Number(e.target.value) }))} />
            </Field>
          </div>
          <Field label="Preferred Vendor">
            <Select value={editing?.vendor_id ?? ''} onChange={(e) => setEditing((d) => ({ ...d, vendor_id: e.target.value || null }))}>
              <option value="">—</option>
              {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </Select>
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setEditing(null)}>Cancel</Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}

function VendorsPanel() {
  const { rows, reload } = useRecords<Vendor>('vendors', { orderBy: 'name' });
  const [editing, setEditing] = useState<Partial<Vendor> | null>(null);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    await saveRecord('vendors', {
      ...editing,
      categories: typeof editing.categories === 'string' ? String(editing.categories).split(',').map((s) => s.trim()).filter(Boolean) : editing.categories ?? []
    } as Record<string, unknown>);
    setEditing(null);
    await reload();
  };

  return (
    <Card title="Vendors" actions={<Button size="sm" onClick={() => setEditing({ is_active: true })}><Plus size={14} /> Add</Button>}>
      {rows.length === 0 ? (
        <EmptyState title="No vendors" />
      ) : (
        <DataTable head={['Vendor', 'Contact', 'Phone / Email', 'Categories', '']}>
          {rows.map((vendor) => (
            <tr key={vendor.id} className="hover:bg-slate-800/70">
              <td className="px-4 py-3 text-sm font-medium">{vendor.name}</td>
              <td className="px-4 py-3 text-sm">{vendor.contact_name || '—'}</td>
              <td className="px-4 py-3 text-sm text-slate-400">{[vendor.phone, vendor.email].filter(Boolean).join(' · ') || '—'}</td>
              <td className="px-4 py-3 text-sm text-slate-400">{vendor.categories?.join(', ') || '—'}</td>
              <td className="px-4 py-3">
                <div className="flex gap-2">
                  <button className="text-sm text-brand-400 hover:text-brand-300" onClick={() => setEditing(vendor)}>Edit</button>
                  <button className="text-sm text-slate-500 hover:text-red-300" onClick={() => void deleteRecord('vendors', vendor.id).then(reload)}>Delete</button>
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
      )}

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing?.id ? 'Edit Vendor' : 'Add Vendor'}>
        <form onSubmit={save} className="space-y-4">
          <Field label="Vendor Name" required>
            <Input value={editing?.name ?? ''} onChange={(e) => setEditing((d) => ({ ...d, name: e.target.value }))} required />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Contact Name">
              <Input value={editing?.contact_name ?? ''} onChange={(e) => setEditing((d) => ({ ...d, contact_name: e.target.value }))} />
            </Field>
            <Field label="Account #">
              <Input value={editing?.account_number ?? ''} onChange={(e) => setEditing((d) => ({ ...d, account_number: e.target.value }))} />
            </Field>
            <Field label="Phone">
              <Input value={editing?.phone ?? ''} onChange={(e) => setEditing((d) => ({ ...d, phone: e.target.value }))} />
            </Field>
            <Field label="Email">
              <Input type="email" value={editing?.email ?? ''} onChange={(e) => setEditing((d) => ({ ...d, email: e.target.value }))} />
            </Field>
          </div>
          <Field label="Categories (comma-separated)">
            <Input
              value={Array.isArray(editing?.categories) ? editing?.categories.join(', ') : String(editing?.categories ?? '')}
              onChange={(e) => setEditing((d) => ({ ...d, categories: e.target.value as unknown as string[] }))}
              placeholder="PPE, pharmaceuticals, equipment rental"
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setEditing(null)}>Cancel</Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}

function InventoryPanel() {
  const { rows, reload } = useRecords<InventoryItem>('inventory_items', { orderBy: 'name' });
  const [editing, setEditing] = useState<Partial<InventoryItem> | null>(null);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    await saveRecord('inventory_items', editing as Record<string, unknown>);
    setEditing(null);
    await reload();
  };

  return (
    <Card
      title="Inventory & Caches"
      subtitle="Par levels and on-hand counts for critical supplies, PPE, pharmaceuticals, and equipment caches"
      actions={<Button size="sm" onClick={() => setEditing({ category: 'supplies', par_level: 0, on_hand: 0, unit_of_measure: 'each', is_critical: true })}><Plus size={14} /> Add</Button>}
    >
      {rows.length === 0 ? (
        <EmptyState title="No inventory tracked" />
      ) : (
        <DataTable head={['Item', 'Location', 'On Hand', 'Par Level', 'Status', '']}>
          {rows.map((item) => {
            const below = item.on_hand < item.par_level;
            return (
              <tr key={item.id} className="hover:bg-slate-800/70">
                <td className="px-4 py-3">
                  <p className="text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-slate-500">{titleCase(item.category)}{item.is_critical ? ' · critical' : ''}</p>
                </td>
                <td className="px-4 py-3 text-sm">{item.location || '—'}</td>
                <td className="px-4 py-3 text-sm font-semibold">{item.on_hand} {item.unit_of_measure}</td>
                <td className="px-4 py-3 text-sm">{item.par_level}</td>
                <td className="px-4 py-3"><Badge tone={below ? 'red' : 'green'}>{below ? 'Below Par' : 'OK'}</Badge></td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button className="text-sm text-brand-400 hover:text-brand-300" onClick={() => setEditing(item)}>Edit</button>
                    <button className="text-sm text-slate-500 hover:text-red-300" onClick={() => void deleteRecord('inventory_items', item.id).then(reload)}>Delete</button>
                  </div>
                </td>
              </tr>
            );
          })}
        </DataTable>
      )}

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing?.id ? 'Edit Inventory Item' : 'Add Inventory Item'}>
        <form onSubmit={save} className="space-y-4">
          <Field label="Item Name" required>
            <Input value={editing?.name ?? ''} onChange={(e) => setEditing((d) => ({ ...d, name: e.target.value }))} required />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Category">
              <Select value={editing?.category ?? 'supplies'} onChange={(e) => setEditing((d) => ({ ...d, category: e.target.value }))}>
                {['supplies', 'ppe', 'medications', 'equipment', 'blood_products', 'other'].map((c) => (
                  <option key={c} value={c}>{titleCase(c)}</option>
                ))}
              </Select>
            </Field>
            <Field label="Location">
              <Input value={editing?.location ?? ''} onChange={(e) => setEditing((d) => ({ ...d, location: e.target.value }))} />
            </Field>
            <Field label="On Hand">
              <Input type="number" min={0} value={editing?.on_hand ?? 0} onChange={(e) => setEditing((d) => ({ ...d, on_hand: Number(e.target.value) }))} />
            </Field>
            <Field label="Par Level">
              <Input type="number" min={0} value={editing?.par_level ?? 0} onChange={(e) => setEditing((d) => ({ ...d, par_level: Number(e.target.value) }))} />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={editing?.is_critical ?? false} onChange={(e) => setEditing((d) => ({ ...d, is_critical: e.target.checked }))} className="h-5 w-5 rounded border-slate-500 bg-slate-800 text-brand-600" />
            Critical item (surfaced on the supply status board)
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setEditing(null)}>Cancel</Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}
