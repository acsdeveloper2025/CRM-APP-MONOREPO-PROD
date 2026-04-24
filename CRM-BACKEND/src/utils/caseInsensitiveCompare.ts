/**
 * Case-insensitive equality for form-field values that may arrive in any
 * casing from any client (mobile, web, future integrations). The literal
 * stays visible at the call site for grep / auditability; the helper
 * centralises the null-safety + casing normalization.
 *
 * Why: backend validators / field mappings compared `formData.X === 'Open'`
 * against exact title-case strings. Historically the backend relied on the
 * mobile app always sending those exact strings — fragile and a documented
 * fix-pattern (A) in project_form_audit_conventions.md. Replacing these
 * sites with eqCI makes them resilient to any casing drift without
 * changing current behaviour (all known callers send the exact literal).
 */
export const eqCI = (value: unknown, literal: string): boolean => {
  if (typeof value !== 'string') {
    return false;
  }
  return value.toLowerCase() === literal.toLowerCase();
};
