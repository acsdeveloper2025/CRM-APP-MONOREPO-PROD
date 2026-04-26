/**
 * Shared field-value processor for `*FormValidator.ts` files.
 *
 * Pre-2026-04-26 each of 9 validator files defined its own private
 * `processFieldValue(fieldName, value)` function with an identical body
 * except for two type-specific arrays:
 *   - `numericFields` — fields that should be coerced to Number
 *   - `dateFields` — fields that should be validated as ISO date strings
 *
 * The 9 copies were a code-duplication smell flagged in
 * `project_form_field_mapping_drift_audit.md` Finding #5/#8. This module
 * extracts the shared logic and parameterizes the two arrays so each
 * validator can pass its own lists.
 *
 * Behavior matches the original 9 functions exactly:
 *   1. null/undefined → null
 *   2. empty / whitespace-only string → null
 *   3. numericFields member → coerce to Number, NaN → null. If value is a
 *      composite `{value, unit}` object, take `.value` first.
 *   4. dateFields member → string passes parseable-Date check or null
 *   5. composite `{value, unit}` object → "value unit" trimmed
 *   6. anything else → String(value).trim() (or JSON.stringify for objects),
 *      empty → null
 *
 * Each validator file holds its own NUMERIC_FIELDS + DATE_FIELDS constants
 * (deliberately at module scope so the lookup happens once per file load,
 * not per call).
 */

export interface ProcessFieldOptions {
  numericFields: readonly string[];
  dateFields?: readonly string[];
}

export function processFormFieldValue(
  fieldName: string,
  value: unknown,
  options: ProcessFieldOptions
): unknown {
  // Handle null/undefined values
  if (value === null || value === undefined) {
    return null;
  }

  // Handle empty strings
  if (typeof value === 'string' && value.trim() === '') {
    return null;
  }

  // Handle numeric fields
  if (options.numericFields.includes(fieldName)) {
    const raw =
      typeof value === 'object' && value !== null && 'value' in (value as Record<string, unknown>)
        ? (value as Record<string, unknown>).value
        : value;
    const num = Number(raw);
    return isNaN(num) ? null : num;
  }

  // Handle date fields
  if (options.dateFields && options.dateFields.includes(fieldName)) {
    if (typeof value === 'string' && value.trim() !== '') {
      const date = new Date(value);
      return isNaN(date.getTime()) ? null : value;
    }
    return null;
  }

  // Handle composite objects (e.g., { value: 3, unit: 'Years' } from mobile dropdowns)
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    if ('value' in obj && 'unit' in obj) {
      return (
        `${String(obj.value as string | number)} ${String(obj.unit as string | number)}`.trim() ||
        null
      );
    }
  }

  // Default: convert to string and trim, return null if empty
  const trimmedValue = (
    typeof value === 'object' && value !== null
      ? JSON.stringify(value)
      : String(value as string | number | boolean | null | undefined)
  ).trim();
  return trimmedValue === '' ? null : trimmedValue;
}
