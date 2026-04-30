/**
 * F2.7.1 — fetch verification_type_outcomes from backend.
 * Single source of truth for valid form_type / outcome codes per
 * verification type. Replaces hardcoded VERIFICATION_OUTCOMES const.
 */

import { apiService } from './api';

export interface VerificationTypeOutcome {
  id: number;
  verificationTypeId: number;
  verificationTypeCode: string; // RV, OV, RC, EV, BV, NV, DV, PAV, PIV
  outcomeCode: string; // POSITIVE, SHIFTED, NSP, ENTRY_RESTRICTED, UNTRACEABLE, NEGATIVE
  displayLabel: string;
  sortOrder: number;
  isActive: boolean;
}

export const verificationTypeOutcomesService = {
  /** Fetch all active verification-type-outcome rows. Server already filters is_active=true. */
  async list(): Promise<VerificationTypeOutcome[]> {
    const response = await apiService.get<VerificationTypeOutcome[]>(
      '/verification-type-outcomes'
    );
    return response.data || [];
  },
};
