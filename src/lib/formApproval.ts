import type { FormTemplateDef } from '../types/forms';
import type { FormInstance } from '../types/domain';

export interface ApprovalStamp {
  /** Approver's full name (goes into the visible form field). */
  approverName: string;
  /** ISO timestamp string. */
  approvedAt: string;
}

/**
 * The visible "Approved by" fields that live inside a form instance's `data`.
 * Most HICS command forms use approved_by + approval_datetime; HICS 206 uses
 * the print-name / datetime pair. We stamp every known key so the PDF shows
 * the approver regardless of which template the form uses.
 */
const STAMP_KEYS = {
  approved_by: ['approved_by', 'approved_print_name'] as const,
  approved_at: ['approval_datetime', 'approved_datetime'] as const
};

/**
 * Write the approver's name and timestamp into the form's visible approval
 * fields. Returns a new data object — never mutates the input.
 */
export function stampApprovalData(
  data: Record<string, unknown>,
  stamp: ApprovalStamp
): Record<string, unknown> {
  const next = { ...data };
  for (const key of STAMP_KEYS.approved_by) {
    if (!(key in next)) next[key] = stamp.approverName;
  }
  for (const key of STAMP_KEYS.approved_at) {
    if (!(key in next)) next[key] = stamp.approvedAt;
  }
  return next;
}

/**
 * Clear the visible approval fields (used when reopening a form to draft).
 */
export function clearApprovalStamp(data: Record<string, unknown>): Record<string, unknown> {
  const next = { ...data };
  for (const key of [...STAMP_KEYS.approved_by, ...STAMP_KEYS.approved_at]) {
    delete next[key];
  }
  return next;
}

/**
 * Content validation that must pass before a form can be approved.
 * Returns a list of human-readable blocking issues (empty = OK to approve).
 *
 * - Any `required` field that is empty/blank blocks approval.
 * - HICS 202 must have at least one objective row with non-blank text.
 * - Any table field whose key is listed in REQUIRED_TABLE_KEYS must have at
 *   least one row with at least one non-blank cell.
 */
const REQUIRED_TABLE_KEYS: Record<string, string[]> = {
  'HICS 202': ['objectives']
};

function isBlank(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

export function validateForApproval(
  template: FormTemplateDef,
  data: Record<string, unknown>
): string[] {
  const issues: string[] = [];

  for (const section of template.schema.sections) {
    for (const field of section.fields) {
      if (field.required && isBlank(data[field.key])) {
        issues.push(`"${field.label}" is required.`);
      }
    }
  }

  const requiredTables = REQUIRED_TABLE_KEYS[template.code];
  if (requiredTables) {
    for (const key of requiredTables) {
      const rows = Array.isArray(data[key]) ? (data[key] as Array<Record<string, unknown>>) : [];
      const hasContent = rows.some((row) =>
        Object.values(row).some((v) => typeof v === 'string' && v.trim() !== '')
      );
      if (!hasContent) {
        const field = template.schema.sections
          .flatMap((s) => s.fields)
          .find((f) => f.key === key);
        issues.push(`${field ? field.label : key} must have at least one entry.`);
      }
    }
  }

  return issues;
}

/**
 * Can the current user reopen an approved/final form back to draft?
 * Mirrors the existing approve permission gate used in FormFillPage.
 */
export function canReopenForm(can: (perm: string) => boolean): boolean {
  return can('approve_iap');
}

export type { FormInstance };
