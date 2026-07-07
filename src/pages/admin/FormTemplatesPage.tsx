import { useState } from 'react';
import { Copy, Eye } from 'lucide-react';
import { HICS_FORM_TEMPLATES } from '../../data/hicsForms';
import { useRecords } from '../../hooks/useRecords';
import { saveRecord } from '../../lib/repo';
import { Badge, Button, Card, DataTable, Modal, PageHeader } from '../../components/ui';
import { titleCase } from '../../lib/utils';
import type { FormTemplateDef } from '../../types/forms';

// Form template manager (spec §4): v1 ships the standard HICS 2014 set as-is.
// The tenant-owned template model is in place — "Copy to Organization" saves a
// tenant-scoped row in form_templates that overrides the bundled standard, so
// field-level editing can be exposed later as pure configuration.

interface DbTemplate {
  id: string;
  tenant_id: string | null;
  code: string;
  title: string;
  category: string;
  version: number;
  schema: { sections: unknown[] };
  no_phi: boolean;
  is_active: boolean;
}

export function FormTemplatesPage() {
  const { rows: dbTemplates, reload } = useRecords<DbTemplate>('form_templates', { orderBy: 'code' });
  const [viewing, setViewing] = useState<FormTemplateDef | null>(null);
  const [busyCode, setBusyCode] = useState('');

  const tenantOverride = (code: string) => dbTemplates.find((t) => t.code === code && t.tenant_id);

  const copyToOrg = async (template: FormTemplateDef) => {
    setBusyCode(template.code);
    try {
      await saveRecord('form_templates', {
        code: template.code,
        title: template.title,
        category: template.category,
        description: template.description,
        schema: template.schema,
        version: 1,
        no_phi: Boolean(template.noPhi),
        is_active: true
      });
      await reload();
    } finally {
      setBusyCode('');
    }
  };

  return (
    <div>
      <PageHeader
        title="Form Templates"
        subtitle="Standard HICS 2014 set (data-driven). Copy a template to your organization to create a tenant-owned version — field-level editing arrives in a later release without code changes."
      />

      <Card>
        <DataTable head={['Code', 'Title', 'Category', 'Ownership', 'Fields', '']}>
          {HICS_FORM_TEMPLATES.map((template) => {
            const override = tenantOverride(template.code);
            const fieldCount = template.schema.sections.reduce((a, s) => a + s.fields.length, 0);
            return (
              <tr key={template.code} className="hover:bg-slate-800/70">
                <td className="px-4 py-3 text-sm font-semibold">{template.code}</td>
                <td className="px-4 py-3">
                  <p className="text-sm">{template.title}</p>
                  {template.noPhi && <Badge tone="red">Aggregate only</Badge>}
                </td>
                <td className="px-4 py-3 text-sm">{titleCase(template.category)}</td>
                <td className="px-4 py-3">
                  {override ? <Badge tone="blue">Organization copy (v{override.version})</Badge> : <Badge tone="slate">Standard</Badge>}
                </td>
                <td className="px-4 py-3 text-sm text-slate-400">{fieldCount}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setViewing(template)}><Eye size={14} /> View</Button>
                    {!override && (
                      <Button size="sm" variant="ghost" disabled={busyCode === template.code} onClick={() => void copyToOrg(template)}>
                        <Copy size={14} /> Copy to Organization
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </DataTable>
      </Card>

      <Modal open={viewing !== null} onClose={() => setViewing(null)} title={`${viewing?.code ?? ''} — Template Definition`} wide>
        <p className="mb-3 text-xs text-slate-400">
          Templates are pure configuration: sections and typed fields interpreted by the forms engine at runtime.
        </p>
        <pre className="max-h-[55vh] overflow-auto rounded-lg border border-slate-700 bg-slate-950 p-4 text-xs text-slate-300">
          {viewing ? JSON.stringify(viewing.schema, null, 2) : ''}
        </pre>
      </Modal>
    </div>
  );
}
