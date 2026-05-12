// Prevents CSV/XLSX formula injection (CWE-1236). User-controlled cells that
// start with =/+/-/@/TAB execute as formulas when opened in Excel/LibreOffice.
// Prefixing with a single quote neutralises that while staying human-readable.
const FORMULA_PREFIX_RE = /^[=+\-@\t\r]/;

export function escapeFormula(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  let s: string;
  if (typeof value === 'string') {
    s = value;
  } else if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    s = String(value);
  } else if (value instanceof Date) {
    s = value.toISOString();
  } else {
    return '';
  }
  return FORMULA_PREFIX_RE.test(s) ? `'${s}` : s;
}

// Maps a row (array or plain object) through escapeFormula, leaving numbers,
// booleans, Date instances, and ExcelJS rich-value objects untouched so cell
// types in the workbook stay correct.
export function escapeFormulaRow<T>(row: T): T {
  if (Array.isArray(row)) {
    return row.map(cellGuard) as unknown as T;
  }
  if (row && typeof row === 'object' && !(row instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row as Record<string, unknown>)) {
      out[k] = cellGuard(v);
    }
    return out as unknown as T;
  }
  return row;
}

function cellGuard(v: unknown): unknown {
  if (typeof v !== 'string') {
    return v;
  }
  return FORMULA_PREFIX_RE.test(v) ? `'${v}` : v;
}
