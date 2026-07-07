// Data-layer guardrail for the no-PHI rule (spec §8): aggregate-only forms and
// boards must never contain patient identifiers. Templates for HICS
// 254/255/259/260 contain no identifier fields by design; this validator adds
// a save-time sweep of free-text values for identifier-shaped content.

const PHI_PATTERNS: Array<{ pattern: RegExp; message: string }> = [
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/, message: 'Content that looks like a Social Security Number' },
  { pattern: /\bMRN\b[:#]?\s*\w+/i, message: 'A medical record number (MRN) reference' },
  { pattern: /\b(date of birth|DOB)\b/i, message: 'A date-of-birth reference' },
  { pattern: /\bpatient name\b/i, message: 'A patient name reference' }
];

export interface PhiIssue {
  path: string;
  message: string;
}

export function findPhiIssues(value: unknown, path = ''): PhiIssue[] {
  const issues: PhiIssue[] = [];
  if (typeof value === 'string') {
    for (const { pattern, message } of PHI_PATTERNS) {
      if (pattern.test(value)) issues.push({ path: path || 'value', message });
    }
  } else if (Array.isArray(value)) {
    value.forEach((item, i) => issues.push(...findPhiIssues(item, `${path}[${i}]`)));
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      issues.push(...findPhiIssues(v, path ? `${path}.${k}` : k));
    }
  }
  return issues;
}
