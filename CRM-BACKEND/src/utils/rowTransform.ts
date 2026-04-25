/**
 * Row transformation utilities for the pg ↔ application boundary.
 *
 * The pg pool is monkey-patched in src/config/db.ts so every query result
 * passes through `camelizeRow` before reaching application code. This means:
 *
 *   - Controllers always see camelCase keys on query results
 *   - Database columns stay snake_case (PostgreSQL best practice)
 *   - There is no manual `toCamelCase(result.rows[0])` call anywhere
 *   - There is no response middleware doing the conversion at the HTTP boundary
 *
 * CRITICAL: this transform is SHALLOW. It only rewrites the top-level row keys.
 * It does NOT recurse into JSONB column values — user-supplied JSON payloads
 * like `id_details: { user_id: 5 }` keep their original keys intact.
 *
 * For constructing INSERT / UPDATE statements from camelCase objects, use
 * `buildInsert()` and `buildUpdate()` below. They convert the keys back to
 * snake_case column names while leaving values untouched.
 */

// Caches avoid repeating the regex work for every row of every query.
const snakeToCamelCache = new Map<string, string>();
const camelToSnakeCache = new Map<string, string>();

export function snakeToCamel(key: string): string {
  const cached = snakeToCamelCache.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const converted = key.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
  snakeToCamelCache.set(key, converted);
  return converted;
}

export function camelToSnake(key: string): string {
  const cached = camelToSnakeCache.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const converted = key.replace(/[A-Z]/g, (c: string) => `_${c.toLowerCase()}`);
  camelToSnakeCache.set(key, converted);
  return converted;
}

/**
 * Shallow snake_case → camelCase transform on a single pg row.
 *
 * The transform is ADDITIVE: every snake_case column gets a camelCase
 * alias on the same row object, and the original snake_case key is
 * preserved. Legacy reads of `row.snake_case_field` keep working, new
 * reads of `row.camelCaseField` work too. A prior attempt to make this
 * REPLACING (deleting the snake keys) silently broke ~100 reader sites
 * across the codebase — every untouched `task.assigned_to`, `row.case_id`,
 * `taskData.task_number`, etc. became `undefined` and produced wrong
 * authorization decisions and NULL inserts. The migration to camelCase-
 * only reads is a separate cleanup; the transform stays additive until
 * that grep is genuinely zero.
 *
 * JSONB column values are NEVER inspected — the transform only touches
 * the top-level keys of the row object. User-supplied JSON payloads keep
 * their original keys intact, which is why `verification_data`, `details`,
 * `metadata_json`, etc. survive unchanged.
 *
 * The function mutates and returns the same row object (cheaper than
 * cloning for hundreds of rows per query). pg gives us fresh row objects
 * per query, so this is safe.
 */
export function camelizeRow<T = Record<string, unknown>>(row: Record<string, unknown>): T {
  for (const key in row) {
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      const camelKey = snakeToCamel(key);
      // Only set the camelCase alias if it isn't already populated by the
      // SQL itself (e.g. `SELECT ... AS "camelCase"`). This keeps the
      // transform idempotent on already-camelized rows.
      if (camelKey !== key && !(camelKey in row)) {
        row[camelKey] = row[key];
      }
    }
  }
  return row as T;
}

/**
 * Batch wrapper for convenience. Most call sites don't need this — the pg pool
 * wrapper in db.ts applies camelizeRow to every row automatically.
 */
export function camelizeRows<T = Record<string, unknown>>(rows: Record<string, unknown>[]): T[] {
  const out: T[] = new Array(rows.length);
  for (let i = 0; i < rows.length; i++) {
    out[i] = camelizeRow<T>(rows[i]);
  }
  return out;
}

/**
 * Build the `columns`, `placeholders`, and `values` fragments for an INSERT
 * from a camelCase object. Undefined values are dropped; null is preserved.
 *
 * Usage:
 *   const { columns, placeholders, values } = buildInsert({
 *     clientId, productId, customerName, verificationTypeId,
 *   });
 *   await query(
 *     `INSERT INTO cases (${columns}) VALUES (${placeholders}) RETURNING *`,
 *     values
 *   );
 */
export function buildInsert(obj: Record<string, unknown>): {
  columns: string;
  placeholders: string;
  values: unknown[];
} {
  const entries: [string, unknown][] = [];
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key) && obj[key] !== undefined) {
      entries.push([key, obj[key]]);
    }
  }
  const columns = entries.map(([k]) => camelToSnake(k)).join(', ');
  const placeholders = entries.map((_, i) => `$${i + 1}`).join(', ');
  const values = entries.map(([, v]) => v);
  return { columns, placeholders, values };
}

/**
 * Build the `setClause` and `values` for an UPDATE from a camelCase object.
 * `startIndex` lets the caller reserve $1, $2, ... for WHERE-clause params.
 *
 * Usage:
 *   const { setClause, values, nextIndex } = buildUpdate({ status, updatedAt }, 1);
 *   await query(
 *     `UPDATE cases SET ${setClause} WHERE id = $${nextIndex}`,
 *     [...values, caseId]
 *   );
 */
export function buildUpdate(
  obj: Record<string, unknown>,
  startIndex = 1
): {
  setClause: string;
  values: unknown[];
  nextIndex: number;
} {
  const entries: [string, unknown][] = [];
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key) && obj[key] !== undefined) {
      entries.push([key, obj[key]]);
    }
  }
  const setClause = entries.map(([k], i) => `${camelToSnake(k)} = $${startIndex + i}`).join(', ');
  const values = entries.map(([, v]) => v);
  return { setClause, values, nextIndex: startIndex + entries.length };
}
