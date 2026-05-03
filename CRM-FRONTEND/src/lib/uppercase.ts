// Utilities for the global "user-typed + user-visible text is UPPERCASE"
// policy. Used by <Input> / <Textarea> to decide whether to auto-uppercase
// the typed value, and by any call site that needs the same predicate.
//
// Case preservation wins over uppercase when EITHER:
//   - the input's `type` is one that can't semantically be uppercased
//     without changing meaning (email, password, url, tel, numeric…), OR
//   - the field's `name` matches a case-sensitive token (email, token,
//     url, path, otp, etc.), OR
//   - the caller passes `uppercase={false}` as an explicit opt-out.
//
// Display-side uppercase is handled by a CSS `body { text-transform }`
// rule in `src/index.css`; this file only governs stored values.

const CASE_SENSITIVE_TYPES = new Set([
  'email',
  'password',
  'url',
  'tel',
  'number',
  'date',
  'time',
  'datetime-local',
  'month',
  'week',
  'file',
  'hidden',
  'color',
  'range',
]);

// Match against each camelCase / snake_case / kebab-case segment of the
// field name, OR against the whole name with punctuation stripped. Both
// `apiKey` (segments api, key) and `apikey` / `api_key` (full = apikey)
// resolve to the token `apikey`.
const CASE_SENSITIVE_NAME_TOKENS = [
  'email',
  'mail',
  'password',
  'pwd',
  'passwd',
  'username',
  'url',
  'link',
  'website',
  'domain',
  'token',
  'jwt',
  'secret',
  'apikey',
  'otp',
  'pin',
  'filename',
  'filepath',
  'path',
];

function isCaseSensitiveName(name: string): boolean {
  const fullAlnum = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const segments = name
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .toLowerCase()
    .split(/[_\-\s]+/)
    .filter(Boolean);
  return CASE_SENSITIVE_NAME_TOKENS.some(
    (token) => fullAlnum === token || segments.includes(token)
  );
}

export function shouldUppercaseInput(
  type?: string,
  name?: string,
  explicit?: boolean,
  id?: string
): boolean {
  if (explicit === false) {
    return false;
  }
  if (explicit === true) {
    return true;
  }
  if (type && CASE_SENSITIVE_TYPES.has(type.toLowerCase())) {
    return false;
  }
  // 2026-05-03: also check `id` as fallback. When a password Input toggles
  // show/hide via the eye icon, its `type` flips between 'password' and
  // 'text'. If the field has no `name` prop, the type-based exclusion
  // disappears the moment the user reveals the password — and global
  // uppercase kicks in. Inspecting `id` (e.g. id="custom-password" or
  // id="confirm-password") catches these toggle patterns.
  if (name && isCaseSensitiveName(name)) {
    return false;
  }
  if (id && isCaseSensitiveName(id)) {
    return false;
  }
  return true;
}

export function toUpperCaseSafe(value: unknown): string {
  if (value == null) {
    return '';
  }
  return String(value).toUpperCase();
}
