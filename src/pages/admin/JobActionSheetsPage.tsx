import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, ClipboardList, Plus, Trash2 } from 'lucide-react';
import { useRecords } from '../../hooks/useRecords';
import { saveRecord, deleteRecord } from '../../lib/repo';
import { logAudit } from '../../lib/audit';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Tabs, Textarea } from '../../components/ui';
import { titleCase } from '../../lib/utils';
import { STANDARD_HIMT_POSITIONS, SECTION_LABELS, SECTION_ORDER } from '../../data/himtPositions';
import type { JasTemplate, HimtPosition } from '../../types/domain';
import type { HicsSection } from '../../types/domain';

type JasItem = { phase: string; text: string };

export function JobActionSheetsPage() {
  const [tab, setTab] = useState('templates');
  return (
    <div>
      <PageHeader
        title="Job Action Sheets"
        subtitle="Manage JAS checklists for each HICS position and create custom positions for your organization"
      />
      <Tabs
        tabs={[
          { key: 'templates', label: 'JAS Templates' },
          { key: 'positions', label: 'Positions' }
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'templates' ? <TemplatesPanel /> : <PositionsPanel />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// JAS Templates
// ---------------------------------------------------------------------------

function TemplatesPanel() {
  const { rows: templates, reload } = useRecords<JasTemplate>('jas_templates', { orderBy: 'position_code' });
  const { rows: positions } = useRecords<HimtPosition>('himt_positions', { orderBy: 'sort_order' });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Partial<JasTemplate> | null>(null);

  const allPositions = useMemo(() => {
    if (positions.length) return positions;
    return STANDARD_HIMT_POSITIONS.map((p, i) => ({
      id: `std-${i}`,
      tenant_id: null,
      code: p.code,
      title: p.title,
      section: p.section,
      parent_code: p.parentCode,
      sort_order: p.sortOrder
    }));
  }, [positions]);

  const positionTitle = (code: string) => allPositions.find((p) => p.code === code)?.title ?? code;

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openNew = () => {
    setEditing({
      position_code: '',
      title: '',
      items: [{ phase: 'immediate', text: '' }],
      version: 1
    });
  };

  const openEdit = (template: JasTemplate) => {
    setEditing({ ...template, items: [...(template.items as JasItem[])] });
  };

  const save = async () => {
    if (!editing) return;
    const items = (editing.items as JasItem[]).filter((i) => i.text.trim());
    await saveRecord('jas_templates', {
      ...editing,
      items,
      title: editing.title || `${positionTitle(editing.position_code ?? '')} — Job Action Sheet`,
      version: (editing.version ?? 1) + (editing.id ? 1 : 0)
    } as Record<string, unknown>);
    logAudit('jas_template.saved', 'jas_template', editing.id ?? editing.position_code ?? '', {
      position: editing.position_code,
      items: items.length
    });
    setEditing(null);
    await reload();
  };

  const remove = async (template: JasTemplate) => {
    await deleteRecord('jas_templates', template.id);
    logAudit('jas_template.deleted', 'jas_template', template.id, { position: template.position_code });
    await reload();
  };

  const moveItem = (index: number, dir: -1 | 1) => {
    if (!editing) return;
    const items = [...(editing.items as JasItem[])];
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    [items[index], items[target]] = [items[target], items[index]];
    setEditing({ ...editing, items });
  };

  const updateItem = (index: number, field: keyof JasItem, value: string) => {
    if (!editing) return;
    const items = [...(editing.items as JasItem[])];
    items[index] = { ...items[index], [field]: value };
    setEditing({ ...editing, items });
  };

  const addItem = () => {
    if (!editing) return;
    setEditing({ ...editing, items: [...(editing.items as JasItem[]), { phase: 'immediate', text: '' }] });
  };

  const removeItem = (index: number) => {
    if (!editing) return;
    const items = (editing.items as JasItem[]).filter((_, i) => i !== index);
    setEditing({ ...editing, items });
  };

  const tenantTemplates = templates.filter((t) => t.tenant_id);
  const standardTemplates = templates.filter((t) => !t.tenant_id);

  return (
    <div className="space-y-4">
      <Card
        title="JAS Templates"
        subtitle="Standard HICS templates are read-only. Copy a standard template to your organization to edit it, or create a new one for a custom position."
        actions={<Button size="sm" onClick={openNew}><Plus size={14} /> New Template</Button>}
      >
        {templates.length === 0 ? (
          <EmptyState title="No JAS templates found" hint="Create a new template or copy a standard one." />
        ) : (
          <div className="space-y-3">
            {tenantTemplates.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-400">Organization Templates</p>
                <div className="space-y-2">
                  {tenantTemplates.map((template) => (
                    <TemplateRow
                      key={template.id}
                      template={template}
                      positionTitle={positionTitle(template.position_code)}
                      expanded={expanded.has(template.id)}
                      onToggle={() => toggleExpand(template.id)}
                      onEdit={() => openEdit(template)}
                      onDelete={() => void remove(template)}
                      isCustom
                    />
                  ))}
                </div>
              </div>
            )}
            {standardTemplates.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Standard HICS Templates</p>
                <div className="space-y-2">
                  {standardTemplates.map((template) => {
                    const hasOrgCopy = tenantTemplates.some((t) => t.position_code === template.position_code);
                    return (
                      <TemplateRow
                        key={template.id}
                        template={template}
                        positionTitle={positionTitle(template.position_code)}
                        expanded={expanded.has(template.id)}
                        onToggle={() => toggleExpand(template.id)}
                        onEdit={() => openEdit(template)}
                        onDelete={undefined}
                        isCustom={false}
                        copyDisabled={hasOrgCopy}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Edit JAS Template' : 'New JAS Template'}
        wide
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="HICS Position" required>
              <Select
                value={editing?.position_code ?? ''}
                onChange={(e) => setEditing((d) => d ? ({ ...d, position_code: e.target.value }) : d)}
              >
                <option value="">— Select a position —</option>
                {allPositions.map((p) => (
                  <option key={p.id} value={p.code}>{p.title} ({p.code})</option>
                ))}
              </Select>
            </Field>
            <Field label="Template Title">
              <Input
                value={editing?.title ?? ''}
                onChange={(e) => setEditing((d) => d ? ({ ...d, title: e.target.value }) : d)}
                placeholder="Auto-generated from position if blank"
              />
            </Field>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Checklist Items</span>
              <Button size="sm" variant="ghost" onClick={addItem}><Plus size={14} /> Add Item</Button>
            </div>
            <div className="space-y-2">
              {(editing?.items as JasItem[] ?? []).map((item, index) => (
                <div key={index} className="flex items-start gap-2 rounded-lg border border-slate-700 bg-slate-800/60 p-2">
                  <div className="flex flex-col pt-2">
                    <button
                      onClick={() => moveItem(index, -1)}
                      disabled={index === 0}
                      className="rounded p-0.5 text-slate-500 hover:text-slate-300 disabled:opacity-30"
                      aria-label="Move up"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      onClick={() => moveItem(index, 1)}
                      disabled={index === (editing?.items as JasItem[] ?? []).length - 1}
                      className="rounded p-0.5 text-slate-500 hover:text-slate-300 disabled:opacity-30"
                      aria-label="Move down"
                    >
                      <ArrowDown size={14} />
                    </button>
                  </div>
                  <Select
                    className="!w-32 !py-1.5 text-xs"
                    value={item.phase}
                    onChange={(e) => updateItem(index, 'phase', e.target.value)}
                  >
                    <option value="immediate">Immediate</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="extended">Extended</option>
                    <option value="demobilization">Demobilization</option>
                    <option value="ongoing">Ongoing</option>
                  </Select>
                  <Textarea
                    className="!min-h-[44px] flex-1 text-sm"
                    value={item.text}
                    onChange={(e) => updateItem(index, 'text', e.target.value)}
                    placeholder="Action description…"
                  />
                  <button
                    onClick={() => removeItem(index)}
                    className="mt-2 rounded p-1 text-slate-500 hover:bg-red-900/40 hover:text-red-300"
                    aria-label="Remove item"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {(!editing?.items || (editing.items as JasItem[]).length === 0) && (
                <p className="py-4 text-center text-sm text-slate-500">No items yet. Click "Add Item" to start.</p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={() => void save()} disabled={!editing?.position_code}>Save Template</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function TemplateRow({
  template,
  positionTitle,
  expanded,
  onToggle,
  onEdit,
  onDelete,
  isCustom,
  copyDisabled
}: {
  template: JasTemplate;
  positionTitle: string;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete?: () => void;
  isCustom: boolean;
  copyDisabled?: boolean;
}) {
  const items = template.items as JasItem[];
  const phases = [...new Set(items.map((i) => i.phase))];

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/60">
      <div className="flex items-center gap-3 px-4 py-3">
        <button onClick={onToggle} className="text-slate-400 hover:text-slate-200">
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-100">{template.title}</p>
          <p className="text-xs text-slate-500">
            {positionTitle} · {items.length} items · v{template.version}
          </p>
        </div>
        {isCustom ? (
          <Badge tone="blue">Organization</Badge>
        ) : (
          <Badge tone="slate">Standard</Badge>
        )}
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={onEdit} disabled={copyDisabled && !isCustom}>
            {isCustom ? 'Edit' : 'Copy & Edit'}
          </Button>
          {isCustom && onDelete && (
            <Button size="sm" variant="ghost" onClick={onDelete}>
              <Trash2 size={14} />
            </Button>
          )}
        </div>
      </div>
      {expanded && (
        <div className="border-t border-slate-700 px-4 py-3">
          {phases.map((phase) => (
            <div key={phase} className="mb-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{titleCase(phase)}</p>
              <ul className="space-y-1">
                {items.filter((i) => i.phase === phase).map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-600" />
                    {item.text}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Positions
// ---------------------------------------------------------------------------

function PositionsPanel() {
  const { rows: positions, reload } = useRecords<HimtPosition>('himt_positions', { orderBy: 'sort_order' });
  const [editing, setEditing] = useState<Partial<HimtPosition> | null>(null);

  const allPositions = useMemo(() => {
    if (positions.length) return positions;
    return STANDARD_HIMT_POSITIONS.map((p, i) => ({
      id: `std-${i}`,
      tenant_id: null,
      code: p.code,
      title: p.title,
      section: p.section,
      parent_code: p.parentCode,
      sort_order: p.sortOrder
    }));
  }, [positions]);

  const tenantPositions = allPositions.filter((p) => p.tenant_id);
  const standardPositions = allPositions.filter((p) => !p.tenant_id);

  const openNew = () => {
    setEditing({
      code: '',
      title: '',
      section: 'command',
      parent_code: null,
      sort_order: 100
    });
  };

  const save = async () => {
    if (!editing) return;
    const code = (editing.code ?? '').toUpperCase().trim();
    if (!code) return;
    await saveRecord('himt_positions', {
      ...editing,
      code
    } as Record<string, unknown>);
    logAudit('himt_position.saved', 'himt_position', code, { title: editing.title });
    setEditing(null);
    await reload();
  };

  const remove = async (position: HimtPosition) => {
    await deleteRecord('himt_positions', position.id);
    logAudit('himt_position.deleted', 'himt_position', position.id, { code: position.code });
    await reload();
  };

  const parentOptions = allPositions.filter((p) => p.code !== editing?.code);

  return (
    <div className="space-y-4">
      <Card
        title="HICS Positions"
        subtitle="Standard HICS positions are read-only. Create custom positions for your organization — these appear in the HIMT chart, JAS templates, and user profile selection."
        actions={<Button size="sm" onClick={openNew}><Plus size={14} /> New Position</Button>}
      >
        {SECTION_ORDER.map((section) => {
          const sectionPositions = allPositions.filter((p) => p.section === section);
          if (!sectionPositions.length) return null;
          return (
            <div key={section} className="mb-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{SECTION_LABELS[section]}</p>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                {sectionPositions.map((position) => {
                  const isCustom = Boolean(position.tenant_id);
                  return (
                    <div
                      key={position.id}
                      className="rounded-lg border border-slate-700 bg-slate-800/60 p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-slate-100">{position.title}</p>
                          <p className="text-xs text-slate-500">{position.code}</p>
                        </div>
                        {isCustom ? (
                          <Badge tone="blue">Custom</Badge>
                        ) : (
                          <Badge tone="slate">Standard</Badge>
                        )}
                      </div>
                      {isCustom && (
                        <div className="mt-2 flex gap-2">
                          <button
                            onClick={() => setEditing(position)}
                            className="text-xs text-brand-400 hover:text-brand-300"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => void remove(position)}
                            className="text-xs text-slate-500 hover:text-red-300"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </Card>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Edit Position' : 'New Custom Position'}
      >
        <div className="space-y-4">
          <Field label="Position Code" required>
            <Input
              value={editing?.code ?? ''}
              onChange={(e) => setEditing((d) => d ? ({ ...d, code: e.target.value.toUpperCase() }) : d)}
              placeholder="e.g., CUSTOM-ROLE"
              disabled={Boolean(editing?.id)}
            />
          </Field>
          <Field label="Position Title" required>
            <Input
              value={editing?.title ?? ''}
              onChange={(e) => setEditing((d) => d ? ({ ...d, title: e.target.value }) : d)}
              placeholder="e.g., Surge Capacity Coordinator"
            />
          </Field>
          <Field label="Section" required>
            <Select
              value={editing?.section ?? 'command'}
              onChange={(e) => setEditing((d) => d ? ({ ...d, section: e.target.value as HicsSection }) : d)}
            >
              {SECTION_ORDER.map((s) => (
                <option key={s} value={s}>{SECTION_LABELS[s]}</option>
              ))}
            </Select>
          </Field>
          <Field label="Reports To (Parent Position)">
            <Select
              value={editing?.parent_code ?? ''}
              onChange={(e) => setEditing((d) => d ? ({ ...d, parent_code: e.target.value || null }) : d)}
            >
              <option value="">— None / Top level —</option>
              {parentOptions.map((p) => (
                <option key={p.id} value={p.code}>{p.title} ({p.code})</option>
              ))}
            </Select>
          </Field>
          <Field label="Sort Order">
            <Input
              type="number"
              value={editing?.sort_order ?? 0}
              onChange={(e) => setEditing((d) => d ? ({ ...d, sort_order: Number(e.target.value) }) : d)}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={() => void save()} disabled={!editing?.code || !editing?.title}>Save Position</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
