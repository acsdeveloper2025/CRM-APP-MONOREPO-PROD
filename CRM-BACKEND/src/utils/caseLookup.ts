// Case identifier resolution helper.
//
// Cases have two identifiers in the schema:
//   - `id`       — UUID primary key
//   - `case_id`  — auto-increment INT used for human-readable display
//
// Several middleware and controllers dispatch between the two based on whether
// the supplied value looks numeric. Historically this dispatch was inlined and
// diverged across call sites (e.g. `validateCaseAccess` matched either column
// but `validateCaseProductAccess` only matched UUID, so the same request could
// pass one check and fail the other). This helper centralizes the logic so
// every caller resolves by the same rule and fetches the same row.
//
// The helper intentionally returns both ids plus the client/product keys used
// by scope-access middleware. Callers that only need one field simply ignore
// the others.

import { query } from '@/config/database';

export interface ResolvedCase {
  /** UUID primary key */
  id: string;
  /** Human-readable auto-increment identifier */
  caseId: number;
  /** Owning client (always present — cases require a client) */
  clientId: number;
  /** Owning product (nullable — some legacy cases have no product) */
  productId: number | null;
}

const NUMERIC_RE = /^\d+$/;

/**
 * Resolve a case by its public identifier — accepting either the numeric
 * `case_id` or the UUID `id`. Returns `null` if no case matches.
 *
 * The SQL uses snake_case column names (PostgreSQL convention) and aliases
 * the result columns so the pg Pool's camelizeRow transform produces a
 * camelCase object matching the `ResolvedCase` interface.
 */
export async function resolveCaseByIdentifier(identifier: string): Promise<ResolvedCase | null> {
  const trimmed = identifier.trim();
  if (!trimmed) {
    return null;
  }

  const isNumeric = NUMERIC_RE.test(trimmed);
  const whereClause = isNumeric ? 'case_id = $1' : 'id = $1';
  const param: string | number = isNumeric ? parseInt(trimmed, 10) : trimmed;

  const result = await query<ResolvedCase>(
    `SELECT
       id,
       case_id  AS "case_id",
       client_id AS "client_id",
       product_id AS "product_id"
     FROM cases
     WHERE ${whereClause}
     LIMIT 1`,
    [param]
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    caseId: Number(row.caseId),
    clientId: Number(row.clientId),
    productId: row.productId == null ? null : Number(row.productId),
  };
}
