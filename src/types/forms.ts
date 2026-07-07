// Template-driven forms engine types. HICS forms (and future org-custom forms)
// are pure data — the renderer interprets these definitions, so new/updated
// forms are configuration, not code.

export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'time'
  | 'datetime'
  | 'select'
  | 'checkbox'
  | 'table'
  | 'signature'
  | 'note';

export interface TemplateColumn {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'date' | 'time' | 'checkbox';
  options?: string[];
  width?: 'narrow' | 'normal' | 'wide';
}

export interface TemplateField {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  columns?: TemplateColumn[];
  /** Pre-seeded rows for table fields (e.g., the standard HICS 251 system list). */
  defaultRows?: Array<Record<string, unknown>>;
  /**
   * Context path auto-filled when a new instance is created, e.g.
   * 'incident.name', 'period.label', 'user.full_name', 'now.date', 'now.time',
   * 'org.name', 'facility.name', 'himt.table' (org-chart rows for 203/207).
   */
  prefill?: string;
  placeholder?: string;
  help?: string;
  /** Grid width: 1 = third, 2 = two-thirds, 3 = full row. Default 1. */
  span?: 1 | 2 | 3;
}

export interface TemplateSection {
  title: string;
  description?: string;
  fields: TemplateField[];
}

export interface FormTemplateDef {
  code: string;
  title: string;
  category: 'command' | 'resource' | 'personnel' | 'situation' | 'custom';
  description: string;
  /**
   * Aggregate-only forms (HICS 254/255/259/260): count/status fields only.
   * The renderer shows a no-PHI banner and save-time validation rejects
   * content that looks like patient identifiers.
   */
  noPhi?: boolean;
  version: number;
  schema: { sections: TemplateSection[] };
}
