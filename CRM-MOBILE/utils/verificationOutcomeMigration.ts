import { Case, VerificationOutcome } from '../types';

/**
 * Migration mapping for deprecated verification outcomes to new ones
 */
const OUTCOME_MIGRATION_MAP: Record<string, VerificationOutcome> = {
  // Standalone "Positive" -> "Positive & Door Locked"
  'Positive': VerificationOutcome.PositiveAndDoorLocked,
  
  // "Negative" -> "NSP & Door Lock" (closest equivalent)
  'Negative': VerificationOutcome.NSPAndDoorLocked,
  
  // Standalone "Shifted" -> "Shifted & Door Lock"
  'Shifted': VerificationOutcome.ShiftedAndDoorLocked,
  
  // Legacy "Door Locked & Shifted" -> "Shifted & Door Lock" (standardized naming)
  'Door Locked & Shifted': VerificationOutcome.ShiftedAndDoorLocked,
  'DoorLockedAndShifted': VerificationOutcome.ShiftedAndDoorLocked,
};

/**
 * Migrates a single case's verification outcome if it uses a deprecated value
 * @param caseData - The case to migrate
 * @returns The migrated case with updated verification outcome
 */
export function migrateCaseVerificationOutcome(caseData: Case): Case {
  const currentOutcome = caseData.verificationOutcome;
  
  // Check if the current outcome needs migration
  if (currentOutcome && OUTCOME_MIGRATION_MAP[currentOutcome]) {
    const newOutcome = OUTCOME_MIGRATION_MAP[currentOutcome];
    
    console.log(`Migrating case ${caseData.id}: ${currentOutcome} -> ${newOutcome}`);
    
    return {
      ...caseData,
      verificationOutcome: newOutcome,
      // Add a migration note to the case
      notes: caseData.notes 
        ? `${caseData.notes}\n\n[MIGRATED] Verification outcome changed from "${currentOutcome}" to "${newOutcome}"`
        : `[MIGRATED] Verification outcome changed from "${currentOutcome}" to "${newOutcome}"`
    };
  }
  
  return caseData;
}

/**
 * Migrates an array of cases, updating any deprecated verification outcomes
 * @param cases - Array of cases to migrate
 * @returns Array of migrated cases
 */
export function migrateCasesVerificationOutcomes(cases: Case[]): Case[] {
  return cases.map(migrateCaseVerificationOutcome);
}

/**
 * Checks if a verification outcome is deprecated and needs migration
 * @param outcome - The verification outcome to check
 * @returns True if the outcome is deprecated
 */
export function isDeprecatedOutcome(outcome: string | undefined): boolean {
  return outcome ? outcome in OUTCOME_MIGRATION_MAP : false;
}

/**
 * Gets the migration target for a deprecated outcome
 * @param outcome - The deprecated outcome
 * @returns The new outcome it should be migrated to, or undefined if not deprecated
 */
export function getMigrationTarget(outcome: string): VerificationOutcome | undefined {
  return OUTCOME_MIGRATION_MAP[outcome];
}

/**
 * Gets a list of all deprecated verification outcomes
 * @returns Array of deprecated outcome strings
 */
export function getDeprecatedOutcomes(): string[] {
  return Object.keys(OUTCOME_MIGRATION_MAP);
}

/**
 * Validates that a verification outcome is still valid (not deprecated)
 * @param outcome - The outcome to validate
 * @returns True if the outcome is valid, false if deprecated
 */
export function isValidVerificationOutcome(outcome: string | undefined): boolean {
  if (!outcome) return false;
  
  // Check if it's one of the current valid outcomes
  const validOutcomes = Object.values(VerificationOutcome);
  return validOutcomes.includes(outcome as VerificationOutcome);
}
