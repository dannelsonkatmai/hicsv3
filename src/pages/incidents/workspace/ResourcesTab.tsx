import { useMemo, useState, type FormEvent } from 'react';
import { CheckCircle2, Download, Plus, ShoppingCart, XCircle } from 'lucide-react';
import { useIncident } from './IncidentContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useRecords } from '../../../hooks/useRecords';
import { saveRecord } from '../../../lib/repo';
import { logAudit } from '../../../lib/audit';
import { downloadCsv, fmtDateTime, fmtMoney, sumBy, titleCase } from '../../../lib/utils';
import { exportTablePdf } from '../../../lib/pdf';
import { Badge, Button, Card, DataTable, EmptyState, Field, Input, Modal, Select, StatCard, Tabs, Textarea, statusTone } from '../../../components/ui';
import type { CostRecord, MutualAidRecord, ProcurementOrder, ResourceCheckout, ResourceRequest, Vendor } from '../../../types/domain';

// End-to-end resource lifecycle (spec §3.3): 213RR-style request →
// Logistics/Finance review → procurement order → delivery → cost capture with
// FEMA PA tagging → demobilization.

const SECTIONS = ['Command', 'Operations', 'Planning', 'Logistics', 'Finance/Admin'];
const CATEGORIES = ['equipment', 'supplies', 'medications', 'beds', 'vehicles', 'facilities', 'personnel', 'other'];

export function ResourcesTab() {
  const [tab, setTab] = useState('requests');
  return (
    <div>
      <Tabs
        tabs={[
          { key: 'requests', label: 'Requests (213RR)' },
          { key: 'orders', label: 'Procurement' },
          { key: 'costs', label: 'Cost Analysis' },
          { key: 'tracking', label: 'Check-Out & Mutual Aid' }
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'requests' && <RequestsPanel />}
      {tab === 'orders' && <OrdersPanel />}
      {tab === 'costs' && <CostsPanel />}
      {tab === 'tracking' && <TrackingPanel />}
    </div>
  );
}

function RequestsPanel() {
  const { incident, currentPeriod } = useIncident();
  const { profile, can, requestApprovalThreshold } = useAuth();
  const { rows: requests, reload } = useRecords<ResourceRequest>('resource_requests', {
    match: { incident_id: incident.id },
    orderBy: 'created_at',
    ascending: false
  });
  const [showNew, setShowNew] = useState(false);
  const [draft, setDraft] = useState<Partial<ResourceRequest>>({ priority: 'routine', requesting_section: 'Operations', quantity: 1, category: 'supplies' });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const saved = await saveRecord('resource_requests', {
      ...draft,
      incident_id: incident.id,
      operational_period_id: currentPeriod?.id ?? null,
      status: 'submitted',
      requested_by_name: profile?.full_name ?? '',
      created_by: profile?.id ?? null
    } as Record<string, unknown>);
    logAudit('resource_request.submitted', 'resource_request', String(saved.id), { item: draft.item_description });
    setShowNew(false);
    setDraft({ priority: 'routine', requesting_section: 'Operations', quantity: 1, category: 'supplies' });
    await reload();
  };

  const review = async (request: ResourceRequest, status: ResourceRequest['status']) => {
    await saveRecord('resource_requests', {
      ...request,
      status,
      reviewed_by: profile?.id ?? null,
      reviewed_at: new Date().toISOString()
    } as unknown as Record<string, unknown>);
    logAudit(`resource_request.${status}`, 'resource_request', request.id, { item: request.item_description });
    await reload();
  };

  const open = requests.filter((r) => ['submitted', 'in_review'].includes(r.status));
  const needsFinance = (r: ResourceRequest) => (r.estimated_cost ?? 0) >= requestApprovalThreshold;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Awaiting Review" value={open.length} tone={open.length ? 'yellow' : 'green'} />
        <StatCard label="Approved / Ordered" value={requests.filter((r) => ['approved', 'ordered'].includes(r.status)).length} tone="blue" />
        <StatCard label="Delivered" value={requests.filter((r) => r.status === 'delivered').length} tone="green" />
        <StatCard label="Est. Value (open)" value={fmtMoney(sumBy(open, (r) => r.estimated_cost))} />
      </div>

      <Card
        title="Resource Requests"
        subtitle={`Requests at or above ${fmtMoney(requestApprovalThreshold)} require Finance sign-off (configurable in Admin → Roles & Permissions)`}
        actions={<Button size="sm" onClick={() => setShowNew(true)}><Plus size={14} /> New Request</Button>}
      >
        {requests.length === 0 ? (
          <EmptyState title="No resource requests" hint="Sections submit 213RR-style requests here; Logistics/Finance review and convert approved requests to orders." />
        ) : (
          <DataTable head={['#', 'Item', 'Qty', 'Priority', 'Section', 'Est. Cost', 'Status', 'Actions']}>
            {requests.map((request) => (
              <tr key={request.id} className="hover:bg-slate-800/70">
                <td className="px-4 py-3 text-sm text-slate-400">{request.request_number ?? '—'}</td>
                <td className="px-4 py-3">
                  <p className="text-sm font-medium">{request.item_description}</p>
                  <p className="text-xs text-slate-500">{titleCase(request.category)} · need by {request.needed_by ? fmtDateTime(request.needed_by) : '—'}</p>
                </td>
                <td className="px-4 py-3 text-sm">{request.quantity} {request.unit_of_measure}</td>
                <td className="px-4 py-3"><Badge tone={statusTone(request.priority)}>{titleCase(request.priority)}</Badge></td>
                <td className="px-4 py-3 text-sm">{request.requesting_section}</td>
                <td className="px-4 py-3 text-sm">
                  {fmtMoney(request.estimated_cost)}
                  {needsFinance(request) && <span className="block text-[10px] text-amber-400">Finance sign-off</span>}
                </td>
                <td className="px-4 py-3"><Badge tone={statusTone(request.status)}>{titleCase(request.status)}</Badge></td>
                <td className="px-4 py-3">
                  {['submitted', 'in_review'].includes(request.status) && can('approve_resource_request') && (
                    <div className="flex gap-1">
                      <button onClick={() => void review(request, 'approved')} className="rounded p-1.5 text-emerald-400 hover:bg-emerald-900/40" title="Approve">
                        <CheckCircle2 size={16} />
                      </button>
                      <button onClick={() => void review(request, 'denied')} className="rounded p-1.5 text-red-400 hover:bg-red-900/40" title="Deny">
                        <XCircle size={16} />
                      </button>
                    </div>
                  )}
                  {request.status === 'ordered' && can('approve_resource_request') && (
                    <Button size="sm" variant="ghost" onClick={() => void review(request, 'delivered')}>Mark Delivered</Button>
                  )}
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>

      <Modal open={showNew} onClose={() => setShowNew(false)} title="New Resource Request (213RR)" wide>
        <form onSubmit={submit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Item / Resource Description" required span={2}>
            <Input value={draft.item_description ?? ''} onChange={(e) => setDraft((d) => ({ ...d, item_description: e.target.value }))} required />
          </Field>
          <Field label="Category">
            <Select value={draft.category ?? 'supplies'} onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}
            </Select>
          </Field>
          <Field label="Quantity">
            <Input type="number" min={1} value={draft.quantity ?? 1} onChange={(e) => setDraft((d) => ({ ...d, quantity: Number(e.target.value) }))} />
          </Field>
          <Field label="Priority">
            <Select value={draft.priority ?? 'routine'} onChange={(e) => setDraft((d) => ({ ...d, priority: e.target.value as ResourceRequest['priority'] }))}>
              <option value="routine">Routine</option>
              <option value="urgent">Urgent</option>
              <option value="immediate">Immediate</option>
            </Select>
          </Field>
          <Field label="Needed By">
            <Input type="datetime-local" value={draft.needed_by ?? ''} onChange={(e) => setDraft((d) => ({ ...d, needed_by: e.target.value }))} />
          </Field>
          <Field label="Requesting Section">
            <Select value={draft.requesting_section ?? 'Operations'} onChange={(e) => setDraft((d) => ({ ...d, requesting_section: e.target.value }))}>
              {SECTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label="Estimated Cost ($)">
            <Input type="number" min={0} value={draft.estimated_cost ?? 0} onChange={(e) => setDraft((d) => ({ ...d, estimated_cost: Number(e.target.value) }))} />
          </Field>
          <Field label="Deliver To">
            <Input value={draft.deliver_to ?? ''} onChange={(e) => setDraft((d) => ({ ...d, deliver_to: e.target.value }))} placeholder="Location / unit" />
          </Field>
          <Field label="Justification" span={2}>
            <Textarea value={draft.justification ?? ''} onChange={(e) => setDraft((d) => ({ ...d, justification: e.target.value }))} />
          </Field>
          <div className="flex justify-end gap-2 md:col-span-2">
            <Button variant="ghost" type="button" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button type="submit">Submit Request</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function OrdersPanel() {
  const { incident } = useIncident();
  const { rows: orders, reload } = useRecords<ProcurementOrder>('procurement_orders', {
    match: { incident_id: incident.id },
    orderBy: 'created_at',
    ascending: false
  });
  const { rows: requests } = useRecords<ResourceRequest>('resource_requests', { match: { incident_id: incident.id } });
  const { rows: vendors } = useRecords<Vendor>('vendors', { orderBy: 'name' });
  const [showNew, setShowNew] = useState(false);
  const [draft, setDraft] = useState<Partial<ProcurementOrder>>({ quantity: 1, unit_cost: 0, status: 'placed' });

  const approvedRequests = requests.filter((r) => r.status === 'approved');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const vendor = vendors.find((v) => v.id === draft.vendor_id);
    const total = (draft.quantity ?? 1) * (draft.unit_cost ?? 0);
    const order = await saveRecord('procurement_orders', {
      ...draft,
      incident_id: incident.id,
      vendor_name: vendor?.name ?? draft.vendor_name ?? '',
      total_cost: total,
      ordered_at: new Date().toISOString()
    } as Record<string, unknown>);
    // Ordered request moves along the lifecycle; a cost record captures spend.
    if (draft.resource_request_id) {
      const request = requests.find((r) => r.id === draft.resource_request_id);
      if (request) await saveRecord('resource_requests', { ...request, status: 'ordered' } as unknown as Record<string, unknown>);
    }
    await saveRecord('cost_records', {
      incident_id: incident.id,
      cost_type: 'supplies',
      description: `PO ${draft.po_number || ''} — ${draft.description}`,
      amount: total,
      procurement_order_id: order.id,
      resource_request_id: draft.resource_request_id ?? null,
      incurred_on: new Date().toISOString().slice(0, 10)
    });
    logAudit('procurement.ordered', 'procurement_order', String(order.id), { total });
    setShowNew(false);
    setDraft({ quantity: 1, unit_cost: 0, status: 'placed' });
    await reload();
  };

  const advance = async (order: ProcurementOrder, status: ProcurementOrder['status']) => {
    await saveRecord('procurement_orders', {
      ...order,
      status,
      delivered_at: status === 'delivered' ? new Date().toISOString() : order.delivered_at
    } as unknown as Record<string, unknown>);
    await reload();
  };

  return (
    <Card
      title="Procurement Orders"
      subtitle="Fulfillment of approved requests — vendor, PO, delivery status"
      actions={<Button size="sm" onClick={() => setShowNew(true)}><ShoppingCart size={14} /> New Order</Button>}
    >
      {orders.length === 0 ? (
        <EmptyState title="No orders yet" hint="Convert approved resource requests into vendor orders here." />
      ) : (
        <DataTable head={['PO #', 'Description', 'Vendor', 'Qty', 'Total', 'Status', '']}>
          {orders.map((order) => (
            <tr key={order.id} className="hover:bg-slate-800/70">
              <td className="px-4 py-3 text-sm">{order.po_number || '—'}</td>
              <td className="px-4 py-3 text-sm font-medium">{order.description}</td>
              <td className="px-4 py-3 text-sm">{order.vendor_name || '—'}</td>
              <td className="px-4 py-3 text-sm">{order.quantity}</td>
              <td className="px-4 py-3 text-sm">{fmtMoney(order.total_cost)}</td>
              <td className="px-4 py-3"><Badge tone={statusTone(order.status)}>{titleCase(order.status)}</Badge></td>
              <td className="px-4 py-3">
                {order.status === 'placed' && <Button size="sm" variant="ghost" onClick={() => void advance(order, 'shipped')}>Mark Shipped</Button>}
                {order.status === 'shipped' && <Button size="sm" variant="ghost" onClick={() => void advance(order, 'delivered')}>Mark Delivered</Button>}
              </td>
            </tr>
          ))}
        </DataTable>
      )}

      <Modal open={showNew} onClose={() => setShowNew(false)} title="New Procurement Order" wide>
        <form onSubmit={submit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="From Approved Request" span={2}>
            <Select
              value={draft.resource_request_id ?? ''}
              onChange={(e) => {
                const request = approvedRequests.find((r) => r.id === e.target.value);
                setDraft((d) => ({
                  ...d,
                  resource_request_id: e.target.value || null,
                  description: request ? request.item_description : d.description,
                  quantity: request?.quantity ?? d.quantity,
                  unit_cost: request && request.quantity ? Math.round(((request.estimated_cost ?? 0) / request.quantity) * 100) / 100 : d.unit_cost
                }));
              }}
            >
              <option value="">— Standalone order —</option>
              {approvedRequests.map((r) => (
                <option key={r.id} value={r.id}>#{r.request_number} · {r.item_description}</option>
              ))}
            </Select>
          </Field>
          <Field label="Description" required span={2}>
            <Input value={draft.description ?? ''} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} required />
          </Field>
          <Field label="Vendor">
            <Select value={draft.vendor_id ?? ''} onChange={(e) => setDraft((d) => ({ ...d, vendor_id: e.target.value || null }))}>
              <option value="">— Enter manually —</option>
              {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </Select>
          </Field>
          {!draft.vendor_id && (
            <Field label="Vendor Name">
              <Input value={draft.vendor_name ?? ''} onChange={(e) => setDraft((d) => ({ ...d, vendor_name: e.target.value }))} />
            </Field>
          )}
          <Field label="PO Number">
            <Input value={draft.po_number ?? ''} onChange={(e) => setDraft((d) => ({ ...d, po_number: e.target.value }))} />
          </Field>
          <Field label="Quantity">
            <Input type="number" min={1} value={draft.quantity ?? 1} onChange={(e) => setDraft((d) => ({ ...d, quantity: Number(e.target.value) }))} />
          </Field>
          <Field label="Unit Cost ($)">
            <Input type="number" min={0} step="0.01" value={draft.unit_cost ?? 0} onChange={(e) => setDraft((d) => ({ ...d, unit_cost: Number(e.target.value) }))} />
          </Field>
          <div className="flex items-end pb-1 text-sm text-slate-300">
            Total: <span className="ml-2 font-semibold">{fmtMoney((draft.quantity ?? 1) * (draft.unit_cost ?? 0))}</span>
          </div>
          <div className="flex justify-end gap-2 md:col-span-2">
            <Button variant="ghost" type="button" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button type="submit">Place Order</Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}

const FEMA_CATEGORIES = [
  { code: '', label: '— None —' },
  { code: 'A', label: 'A — Debris Removal' },
  { code: 'B', label: 'B — Emergency Protective Measures' },
  { code: 'C', label: 'C — Roads & Bridges' },
  { code: 'D', label: 'D — Water Control Facilities' },
  { code: 'E', label: 'E — Buildings & Equipment' },
  { code: 'F', label: 'F — Utilities' },
  { code: 'G', label: 'G — Parks & Other' },
  { code: 'Z', label: 'Z — Management Costs' }
];

function CostsPanel() {
  const { incident } = useIncident();
  const { rows: costs, reload } = useRecords<CostRecord>('cost_records', {
    match: { incident_id: incident.id },
    orderBy: 'created_at',
    ascending: false
  });
  const [showNew, setShowNew] = useState(false);
  const [draft, setDraft] = useState<Partial<CostRecord>>({ cost_type: 'supplies', amount: 0, fema_category: '', reimbursable: false });

  const total = sumBy(costs, (c) => c.amount);
  const reimbursable = sumBy(costs.filter((c) => c.reimbursable), (c) => c.amount);
  const byType = useMemo(() => {
    const map = new Map<string, number>();
    for (const cost of costs) map.set(cost.cost_type, (map.get(cost.cost_type) ?? 0) + (Number(cost.amount) || 0));
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [costs]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await saveRecord('cost_records', {
      ...draft,
      incident_id: incident.id,
      incurred_on: draft.incurred_on ?? new Date().toISOString().slice(0, 10)
    } as Record<string, unknown>);
    setShowNew(false);
    setDraft({ cost_type: 'supplies', amount: 0, fema_category: '', reimbursable: false });
    await reload();
  };

  const exportColumns = [
    { key: 'incurred_on', label: 'Date' },
    { key: 'cost_type', label: 'Type' },
    { key: 'description', label: 'Description' },
    { key: 'amount', label: 'Amount' },
    { key: 'fema_category', label: 'FEMA Cat.' },
    { key: 'reimbursable', label: 'Reimbursable' },
    { key: 'mutual_aid', label: 'Mutual Aid' }
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Cost to Date" value={fmtMoney(total)} tone="blue" />
        <StatCard label="Flagged Reimbursable" value={fmtMoney(reimbursable)} tone="green" hint="FEMA PA / mutual aid" />
        <StatCard label="Cost Lines" value={costs.length} />
        <StatCard label="Largest Category" value={byType[0] ? `${titleCase(byType[0][0])} ${fmtMoney(byType[0][1])}` : '—'} />
      </div>

      <Card
        title="Cost Records"
        subtitle="Labor, equipment, supply, and contract costs — tagged for FEMA Public Assistance reimbursement"
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => downloadCsv(costs as unknown as Record<string, unknown>[], exportColumns, `costs-${incident.name}.csv`)}>
              <Download size={14} /> CSV
            </Button>
            <Button size="sm" variant="secondary" onClick={() => exportTablePdf(`Cost Report — ${incident.name}`, `Total ${fmtMoney(total)} · Reimbursable ${fmtMoney(reimbursable)}`, exportColumns, costs as unknown as Record<string, unknown>[], `costs-${incident.name}.pdf`)}>
              <Download size={14} /> PDF
            </Button>
            <Button size="sm" onClick={() => setShowNew(true)}><Plus size={14} /> Add Cost</Button>
          </div>
        }
      >
        {costs.length === 0 ? (
          <EmptyState title="No costs recorded" hint="Orders create cost lines automatically; labor and other costs can be added here." />
        ) : (
          <DataTable head={['Date', 'Type', 'Description', 'Amount', 'FEMA', 'Reimbursable']}>
            {costs.map((cost) => (
              <tr key={cost.id} className="hover:bg-slate-800/70">
                <td className="px-4 py-3 text-sm text-slate-400">{cost.incurred_on ?? '—'}</td>
                <td className="px-4 py-3 text-sm">{titleCase(cost.cost_type)}</td>
                <td className="px-4 py-3 text-sm">{cost.description}</td>
                <td className="px-4 py-3 text-sm font-semibold">{fmtMoney(cost.amount)}</td>
                <td className="px-4 py-3 text-sm">{cost.fema_category || '—'}</td>
                <td className="px-4 py-3">{cost.reimbursable ? <Badge tone="green">Yes</Badge> : <span className="text-sm text-slate-500">No</span>}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>

      <Modal open={showNew} onClose={() => setShowNew(false)} title="Add Cost Record">
        <form onSubmit={submit} className="space-y-4">
          <Field label="Description" required>
            <Input value={draft.description ?? ''} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} required />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Type">
              <Select value={draft.cost_type ?? 'supplies'} onChange={(e) => setDraft((d) => ({ ...d, cost_type: e.target.value as CostRecord['cost_type'] }))}>
                {['labor', 'equipment', 'supplies', 'medications', 'contract', 'facility', 'other'].map((t) => (
                  <option key={t} value={t}>{titleCase(t)}</option>
                ))}
              </Select>
            </Field>
            <Field label="Amount ($)" required>
              <Input type="number" min={0} step="0.01" value={draft.amount ?? 0} onChange={(e) => setDraft((d) => ({ ...d, amount: Number(e.target.value) }))} required />
            </Field>
            <Field label="Date Incurred">
              <Input type="date" value={draft.incurred_on ?? new Date().toISOString().slice(0, 10)} onChange={(e) => setDraft((d) => ({ ...d, incurred_on: e.target.value }))} />
            </Field>
            <Field label="FEMA PA Category">
              <Select value={draft.fema_category ?? ''} onChange={(e) => setDraft((d) => ({ ...d, fema_category: e.target.value }))}>
                {FEMA_CATEGORIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
              </Select>
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={draft.reimbursable ?? false} onChange={(e) => setDraft((d) => ({ ...d, reimbursable: e.target.checked }))} className="h-5 w-5 rounded border-slate-500 bg-slate-800 text-brand-600" />
            Potentially reimbursable (FEMA PA / Stafford Act / mutual aid)
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button type="submit">Add Cost</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function TrackingPanel() {
  const { incident } = useIncident();
  const { rows: checkouts, reload } = useRecords<ResourceCheckout>('resource_checkouts', {
    match: { incident_id: incident.id },
    orderBy: 'created_at',
    ascending: false
  });
  const { rows: mutualAid, reload: reloadAid } = useRecords<MutualAidRecord>('mutual_aid_records', {
    match: { incident_id: incident.id },
    orderBy: 'created_at',
    ascending: false
  });
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutDraft, setCheckoutDraft] = useState<Partial<ResourceCheckout>>({ quantity: 1 });
  const [showAid, setShowAid] = useState(false);
  const [aidDraft, setAidDraft] = useState<Partial<MutualAidRecord>>({ direction: 'received', status: 'open', quantity: 1, estimated_value: 0 });

  const checkout = async (e: FormEvent) => {
    e.preventDefault();
    await saveRecord('resource_checkouts', {
      ...checkoutDraft,
      incident_id: incident.id,
      checked_out_at: new Date().toISOString(),
      demobilized: false
    } as Record<string, unknown>);
    setShowCheckout(false);
    setCheckoutDraft({ quantity: 1 });
    await reload();
  };

  const checkin = async (row: ResourceCheckout) => {
    await saveRecord('resource_checkouts', { ...row, checked_in_at: new Date().toISOString() } as unknown as Record<string, unknown>);
    await reload();
  };

  const addAid = async (e: FormEvent) => {
    e.preventDefault();
    await saveRecord('mutual_aid_records', { ...aidDraft, incident_id: incident.id } as Record<string, unknown>);
    setShowAid(false);
    setAidDraft({ direction: 'received', status: 'open', quantity: 1, estimated_value: 0 });
    await reloadAid();
  };

  return (
    <div className="space-y-4">
      <Card
        title="Resource Check-Out / Check-In"
        actions={<Button size="sm" onClick={() => setShowCheckout(true)}><Plus size={14} /> Check Out</Button>}
      >
        {checkouts.length === 0 ? (
          <EmptyState title="Nothing checked out" />
        ) : (
          <DataTable head={['Resource', 'Qty', 'To', 'Location', 'Out', 'In', '']}>
            {checkouts.map((row) => (
              <tr key={row.id} className="hover:bg-slate-800/70">
                <td className="px-4 py-3 text-sm font-medium">{row.resource_name}</td>
                <td className="px-4 py-3 text-sm">{row.quantity}</td>
                <td className="px-4 py-3 text-sm">{row.checked_out_to || '—'}</td>
                <td className="px-4 py-3 text-sm">{row.location || '—'}</td>
                <td className="px-4 py-3 text-sm text-slate-400">{fmtDateTime(row.checked_out_at)}</td>
                <td className="px-4 py-3 text-sm text-slate-400">{row.checked_in_at ? fmtDateTime(row.checked_in_at) : '—'}</td>
                <td className="px-4 py-3">
                  {!row.checked_in_at && <Button size="sm" variant="ghost" onClick={() => void checkin(row)}>Check In</Button>}
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>

      <Card
        title="Mutual Aid / EMAC"
        subtitle="Resource sharing with partner facilities and agencies, tracked for cost recovery"
        actions={<Button size="sm" onClick={() => setShowAid(true)}><Plus size={14} /> Record</Button>}
      >
        {mutualAid.length === 0 ? (
          <EmptyState title="No mutual-aid records" />
        ) : (
          <DataTable head={['Partner', 'Direction', 'Description', 'Est. Value', 'Status']}>
            {mutualAid.map((row) => (
              <tr key={row.id} className="hover:bg-slate-800/70">
                <td className="px-4 py-3 text-sm font-medium">{row.partner_name}</td>
                <td className="px-4 py-3 text-sm">{titleCase(row.direction)}</td>
                <td className="px-4 py-3 text-sm">{row.description}</td>
                <td className="px-4 py-3 text-sm">{fmtMoney(row.estimated_value)}</td>
                <td className="px-4 py-3"><Badge tone={statusTone(row.status)}>{titleCase(row.status)}</Badge></td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>

      <Modal open={showCheckout} onClose={() => setShowCheckout(false)} title="Check Out Resource">
        <form onSubmit={checkout} className="space-y-4">
          <Field label="Resource / Equipment" required>
            <Input value={checkoutDraft.resource_name ?? ''} onChange={(e) => setCheckoutDraft((d) => ({ ...d, resource_name: e.target.value }))} required />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Quantity">
              <Input type="number" min={1} value={checkoutDraft.quantity ?? 1} onChange={(e) => setCheckoutDraft((d) => ({ ...d, quantity: Number(e.target.value) }))} />
            </Field>
            <Field label="Checked Out To">
              <Input value={checkoutDraft.checked_out_to ?? ''} onChange={(e) => setCheckoutDraft((d) => ({ ...d, checked_out_to: e.target.value }))} />
            </Field>
            <Field label="Location">
              <Input value={checkoutDraft.location ?? ''} onChange={(e) => setCheckoutDraft((d) => ({ ...d, location: e.target.value }))} />
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setShowCheckout(false)}>Cancel</Button>
            <Button type="submit">Check Out</Button>
          </div>
        </form>
      </Modal>

      <Modal open={showAid} onClose={() => setShowAid(false)} title="Record Mutual Aid">
        <form onSubmit={addAid} className="space-y-4">
          <Field label="Partner Facility / Agency" required>
            <Input value={aidDraft.partner_name ?? ''} onChange={(e) => setAidDraft((d) => ({ ...d, partner_name: e.target.value }))} required />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Direction">
              <Select value={aidDraft.direction ?? 'received'} onChange={(e) => setAidDraft((d) => ({ ...d, direction: e.target.value as MutualAidRecord['direction'] }))}>
                <option value="received">Received (we borrowed)</option>
                <option value="provided">Provided (we lent)</option>
              </Select>
            </Field>
            <Field label="Estimated Value ($)">
              <Input type="number" min={0} value={aidDraft.estimated_value ?? 0} onChange={(e) => setAidDraft((d) => ({ ...d, estimated_value: Number(e.target.value) }))} />
            </Field>
          </div>
          <Field label="Description">
            <Textarea value={aidDraft.description ?? ''} onChange={(e) => setAidDraft((d) => ({ ...d, description: e.target.value }))} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setShowAid(false)}>Cancel</Button>
            <Button type="submit">Record</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
