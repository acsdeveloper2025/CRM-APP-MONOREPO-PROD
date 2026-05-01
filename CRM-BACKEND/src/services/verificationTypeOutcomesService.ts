/**
 * F2.7.1 — single source of truth for valid form_type / outcome codes
 * per verification type. Hydrated from the `verification_type_outcomes`
 * lookup table. Replaces hardcoded arrays previously in:
 *   - utils/formTypeDetection.ts (isValidFormType + getValidFormTypes)
 *   - services/taskCompletionValidator.ts (VALID_OUTCOMES map)
 *   - utils/comprehensiveFormFieldMapping.ts (per-type formTypes arrays)
 *
 * Cache: in-memory map, 5-minute TTL. Invalidate via `invalidate()` after
 * admin edits to the table.
 */

import { query } from '../config/database';
import { logger } from '../utils/logger';

export interface VerificationTypeOutcome {
  id: number;
  verificationTypeId: number;
  verificationTypeCode: string;
  outcomeCode: string;
  displayLabel: string;
  sortOrder: number;
  isActive: boolean;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
let cache: VerificationTypeOutcome[] | null = null;
let cacheLoadedAt = 0;

async function loadFromDb(): Promise<VerificationTypeOutcome[]> {
  const result = await query<{
    id: number;
    verification_type_id: number;
    verification_type_code: string;
    outcome_code: string;
    display_label: string;
    sort_order: number;
    is_active: boolean;
  }>(
    `SELECT vto.id,
            vto.verification_type_id,
            vt.code AS verification_type_code,
            vto.outcome_code,
            vto.display_label,
            vto.sort_order,
            vto.is_active
       FROM verification_type_outcomes vto
       JOIN verification_types vt ON vt.id = vto.verification_type_id
      WHERE vto.is_active = true
      ORDER BY vto.verification_type_id, vto.sort_order`
  );
  return result.rows.map(r => ({
    id: r.id,
    verificationTypeId: r.verification_type_id,
    verificationTypeCode: r.verification_type_code,
    outcomeCode: r.outcome_code,
    displayLabel: r.display_label,
    sortOrder: r.sort_order,
    isActive: r.is_active,
  }));
}

/** Returns all active outcomes (cached). */
export async function getAllOutcomes(): Promise<VerificationTypeOutcome[]> {
  const now = Date.now();
  if (cache && now - cacheLoadedAt < CACHE_TTL_MS) {
    return cache;
  }
  const fresh = await loadFromDb();
  cache = fresh;
  cacheLoadedAt = now;
  logger.info('verification_type_outcomes cache refreshed', {
    count: fresh.length,
  });
  return fresh;
}

/** Invalidate the in-memory cache (call after admin edits the table). */
export function invalidateCache(): void {
  cache = null;
  cacheLoadedAt = 0;
}

/**
 * Outcomes for a given verification-type code (e.g. 'RESIDENCE', 'OFFICE',
 * 'PROPERTY_APF'). Accepts either the canonical code (RV/OV/...) or the
 * verbose name with underscores. Returns empty array if type unknown.
 */
export async function getOutcomesForType(
  verificationTypeCodeOrName: string
): Promise<VerificationTypeOutcome[]> {
  const all = await getAllOutcomes();
  const normalized = normalizeTypeKey(verificationTypeCodeOrName);
  return all.filter(o => normalizeTypeKey(o.verificationTypeCode) === normalized);
}

/** Just the outcome codes (for legacy callers that returned `string[]`). */
export async function getValidOutcomeCodes(verificationTypeCodeOrName: string): Promise<string[]> {
  const outcomes = await getOutcomesForType(verificationTypeCodeOrName);
  return outcomes.map(o => o.outcomeCode);
}

/** Returns true if `outcomeCode` is a valid outcome for the given verification type. */
export async function isValidOutcome(
  verificationTypeCodeOrName: string,
  outcomeCode: string
): Promise<boolean> {
  const codes = await getValidOutcomeCodes(verificationTypeCodeOrName);
  return codes.includes(outcomeCode.toUpperCase());
}

/**
 * Maps the verbose verification-type names used in the legacy callers
 * (RESIDENCE, OFFICE, BUSINESS, BUILDER, RESIDENCE_CUM_OFFICE, NOC,
 * DSA_CONNECTOR, PROPERTY_APF, PROPERTY_INDIVIDUAL) to the short codes
 * stored in verification_types.code (RV, OV, EV, BV, RC, NV, DV, PAV, PIV).
 * Returns the input unchanged if it's already a short code.
 */
function normalizeTypeKey(input: string): string {
  const upper = input.toUpperCase().trim();
  const verboseToCode: Record<string, string> = {
    RESIDENCE: 'RV',
    OFFICE: 'OV',
    BUSINESS: 'EV',
    BUILDER: 'BV',
    RESIDENCE_CUM_OFFICE: 'RC',
    NOC: 'NV',
    DSA_CONNECTOR: 'DV',
    PROPERTY_APF: 'PAV',
    PROPERTY_INDIVIDUAL: 'PIV',
  };
  return verboseToCode[upper] ?? upper;
}
