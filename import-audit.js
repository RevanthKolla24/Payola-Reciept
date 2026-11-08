// Counts only: never filenames, URLs, channel names or raw activity. Optional in v1/v2 backups.
export const ACTIVITY_AUDIT_KEYS = ['files', 'records', 'accepted', 'ambiguous', 'nonListening', 'invalid'];
const MAX_COUNT = 20000000;
export function validateActivityAudit(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || ACTIVITY_AUDIT_KEYS.some(key => !Number.isSafeInteger(value[key]) || value[key] < 0 || value[key] > MAX_COUNT)
    || value.files < 1 || value.files > value.records || value.accepted < 1
    || value.records !== value.accepted + value.ambiguous + value.nonListening + value.invalid) {
    throw new Error('Invalid activity import audit.');
  }
  return Object.fromEntries(ACTIVITY_AUDIT_KEYS.map(key => [key, value[key]]));
}
export function mergeActivityAudit(previous, incoming) {
  const next = validateActivityAudit(incoming);
  if (!previous) return next;
  const current = validateActivityAudit(previous);
  return validateActivityAudit(Object.fromEntries(ACTIVITY_AUDIT_KEYS.map(key => [key, current[key] + next[key]])));
}
export function activityAuditText(audit) {
  const a = validateActivityAudit(audit);
  return `Confirmed activity files: ${a.files}; input entries: ${a.records}; accepted before deduplication: ${a.accepted}; excluded general/ambiguous: ${a.ambiguous}; excluded non-listening: ${a.nonListening}; invalid/missing metadata: ${a.invalid}. Counts cover confirmed files only, across all dates; rejected and identical skipped files are not included. Counts are user-editable and unverified.`;
}