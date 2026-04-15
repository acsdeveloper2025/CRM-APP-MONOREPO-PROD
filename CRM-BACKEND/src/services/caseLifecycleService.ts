// -----------------------------------------------------------------------------
// caseLifecycleService
// -----------------------------------------------------------------------------
// Thin helpers for case-level state transitions and data-entry history writes.
// Extracted from caseDataEntriesController during Sprint 1 of the Case Data
// Entry audit so future callers (e.g. reject/reopen flows) don't duplicate the
// SQL or forget to emit the history row.
//
// These helpers all accept a `PoolClient` so callers can compose them inside
// an existing transaction — they do NOT open their own transactions.
// -----------------------------------------------------------------------------

import type { PoolClient } from 'pg';

type HistoryChangeType = 'CREATE' | 'UPDATE' | 'COMPLETE' | 'REOPEN';

export interface RecordEntryHistoryParams {
  entryId: number;
  caseId: string;
  templateId: number;
  templateVersion: number;
  data: Record<string, unknown>;
  changeType: HistoryChangeType;
  changedBy: string;
}

/**
 * Append an immutable audit row for a data entry change. Must be called from
 * the same transaction as the write that caused the change so the audit log
 * and the entry can never disagree.
 */
export const recordEntryHistory = async (
  client: PoolClient,
  params: RecordEntryHistoryParams
): Promise<void> => {
  await client.query(
    `INSERT INTO case_data_entries_history
       (entry_id, case_id, template_id, template_version, data, change_type, changed_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      params.entryId,
      params.caseId,
      params.templateId,
      params.templateVersion,
      JSON.stringify(params.data ?? {}),
      params.changeType,
      params.changedBy,
    ]
  );
};

/**
 * Transition a case to COMPLETED. Callers that need per-entry marking should
 * do that separately inside the same transaction.
 */
export const markCaseCompleted = async (
  client: PoolClient,
  caseId: string
): Promise<{ id: string; status: string; completedAt: Date }> => {
  const result = await client.query(
    `UPDATE cases
        SET status = 'COMPLETED',
            "completedAt" = NOW(),
            updated_at = NOW()
      WHERE id = $1
      RETURNING id, status, "completedAt"`,
    [caseId]
  );
  return result.rows[0];
};
