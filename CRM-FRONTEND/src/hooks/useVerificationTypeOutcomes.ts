/**
 * F2.7.1 — TanStack Query hook for the verification_type_outcomes
 * lookup table. Single fetch per session (1h staleTime); each consumer
 * filters/maps as needed.
 */

import { useQuery } from '@tanstack/react-query';
import {
  verificationTypeOutcomesService,
  type VerificationTypeOutcome,
} from '@/services/verificationTypeOutcomes';

const STALE_TIME_MS = 60 * 60 * 1000; // 1 hour

/** All active outcomes across all types. */
export function useAllVerificationTypeOutcomes() {
  return useQuery({
    queryKey: ['verification-type-outcomes'],
    queryFn: () => verificationTypeOutcomesService.list(),
    staleTime: STALE_TIME_MS,
  });
}

/**
 * Outcomes filtered to a single verification type.
 * Pass either short code (RV/OV/...) or verbose name (RESIDENCE/OFFICE/...).
 */
export function useVerificationTypeOutcomes(verificationTypeCode: string | null | undefined) {
  const { data, ...rest } = useAllVerificationTypeOutcomes();

  const filtered: VerificationTypeOutcome[] =
    verificationTypeCode && data
      ? data
          .filter(
            (o) =>
              normalizeTypeKey(o.verificationTypeCode) === normalizeTypeKey(verificationTypeCode)
          )
          .sort((a, b) => a.sortOrder - b.sortOrder)
      : [];

  return { data: filtered, ...rest };
}

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
