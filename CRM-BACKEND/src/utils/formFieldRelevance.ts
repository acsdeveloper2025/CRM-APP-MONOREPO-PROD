/**
 * Shared form-field relevance + default-value helpers for the 9
 * `*FormFieldMapping.ts` files.
 *
 * Pre-2026-04-26 each mapping file declared its own private helpers:
 *   - `getRelevant<X>FieldsForFormType(formType): string[]` — wrapper
 *     around a `Record<string, string[]>` keyed by outcome (POSITIVE /
 *     SHIFTED / NSP / ENTRY_RESTRICTED / UNTRACEABLE).
 *   - `getDefault<X>ValueForField(_fieldName): unknown` — 4-line stub,
 *     all 9 returned `null`.
 *
 * The data per type is real (different field lists per verification
 * type), but the WRAPPER LOGIC is identical. This file extracts the
 * wrappers so each mapping file declares its data as a module-scope
 * `RELEVANT_FIELDS_BY_TYPE` constant and calls the shared util.
 *
 * Behavior matches the original 9 functions exactly:
 *   - `pickRelevantFieldsForFormType(formType, fieldsByType)`:
 *     equivalent to `fieldsByType[formType] || fieldsByType['POSITIVE']`.
 *     Important: unknown formType falls back to the POSITIVE outcome's
 *     list, NOT to `[]`. Pre-2026-04-26 audit caught my first attempt at
 *     this util mis-specifying the fallback as `[]` — would have silently
 *     suppressed the missing-field warnings for unknown outcomes.
 *   - `MISSING_FIELD_DEFAULT`: the `null` value the original 9 stubs
 *     always returned. Kept as an explicit constant so the call sites
 *     read intentionally rather than as a magic literal.
 *
 * Per `project_form_field_mapping_drift_audit.md` Phase 4 Finding-#5b
 * dedup. Maintains consistency with the Phase 3 `processFormFieldValue`
 * shared util in `formFieldValueProcessor.ts`.
 */

export type RelevantFieldsByFormType = Readonly<Record<string, readonly string[]>>;

/**
 * Look up the relevant DB-column list for a given outcome (form type).
 *
 * If `formType` is not in the map, falls back to the POSITIVE outcome's
 * list. This matches the pre-dedup behavior of all 9 original wrappers
 * which used `|| fieldsByType['POSITIVE']`. The fallback exists so that
 * an unrecognized outcome still produces a non-empty relevance check —
 * the missing-field warning loop in `ensureAll<X>FieldsPopulated` then
 * surfaces unmapped fields rather than silently passing.
 *
 * Caller MUST ensure `fieldsByType` contains a POSITIVE key (every
 * existing mapping file does — POSITIVE is the canonical baseline
 * outcome). If POSITIVE is missing, returns `[]`.
 */
export function pickRelevantFieldsForFormType(
  formType: string,
  fieldsByType: RelevantFieldsByFormType
): readonly string[] {
  return fieldsByType[formType] || fieldsByType['POSITIVE'] || [];
}

/**
 * Default value the `ensureAll<X>FieldsPopulated` functions write into a
 * relevant column when the mobile payload didn't include it. All 9 prior
 * mapping files used `null` — this constant makes the call site read
 * intentionally and removes the no-op getter functions.
 */
export const MISSING_FIELD_DEFAULT: null = null;
