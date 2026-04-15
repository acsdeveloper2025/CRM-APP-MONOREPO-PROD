// -----------------------------------------------------------------------------
// templateImportService
// -----------------------------------------------------------------------------
// Parses an uploaded Excel (.xlsx) or CSV (.csv) file into a draft list of
// fields ready for the Case Data Template "preview & save" UI. This service
// is pure — it does NOT touch the database. The controller layer is
// responsible for auth, the existing-template guard, and (after the admin
// reviews the preview) calling the regular template-create endpoint.
//
// Spec (Sprint 4):
//   - Headers come from row 1.
//   - Every column becomes a field with fieldType='TEXT', isRequired=false,
//     section=null. Admin overrides on the preview screen.
//   - If data rows exist, we sample distinct non-empty values per column as
//     the `options` payload (useful when the admin later switches that
//     field to SELECT or MULTISELECT).
//   - Header → fieldKey via a deterministic slug that matches the template
//     field-key regex (/^[a-zA-Z][a-zA-Z0-9_]*$/). Unusable headers
//     (all symbols, starts with a digit, etc.) return a structured error
//     the controller turns into a 400.
// -----------------------------------------------------------------------------

import ExcelJS from 'exceljs';
import Papa from 'papaparse';

// Cap how many distinct sample values we keep per column. Protects response
// size when someone uploads 10k rows where every cell is unique.
const MAX_OPTION_SAMPLES = 20;

// Headers are truncated to this on import so a user who types a long
// sentence as a header doesn't create a field_label longer than the DB
// column allows (VARCHAR(255)).
const MAX_HEADER_LEN = 200;

export interface ParsedField {
  fieldKey: string;
  fieldLabel: string;
  fieldType: 'TEXT';
  isRequired: false;
  displayOrder: number;
  section: null;
  placeholder: null;
  defaultValue: null;
  validationRules: Record<string, unknown>;
  options: Array<{ label: string; value: string }>;
}

export interface ParseError {
  code:
    | 'EMPTY_FILE'
    | 'NO_HEADER_ROW'
    | 'BLANK_HEADER'
    | 'DUPLICATE_HEADER'
    | 'INVALID_HEADER'
    | 'TOO_MANY_COLUMNS'
    | 'UNSUPPORTED_FORMAT'
    | 'PARSE_FAILURE';
  message: string;
}

export interface ParseResult {
  fields: ParsedField[];
  sheetName?: string;
  rowCount: number;
}

// ---------------------------------------------------------------------------
// Header → fieldKey slug
// ---------------------------------------------------------------------------
//
// Must produce a string that passes /^[a-zA-Z][a-zA-Z0-9_]*$/. Strategy:
//   1. Replace any run of non-alphanumeric with a single underscore.
//   2. Strip leading/trailing underscores.
//   3. If the result starts with a digit, prefix with `f_`.
//   4. Lowercase. Trim to 100 chars (the DB column limit on field_key).
//   5. Empty after sanitising → null (caller reports INVALID_HEADER).
const slugifyHeader = (header: string): string | null => {
  const cleaned = header
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!cleaned) {
    return null;
  }
  const withPrefix = /^[0-9]/.test(cleaned) ? `f_${cleaned}` : cleaned;
  return withPrefix.toLowerCase().slice(0, 100);
};

// ---------------------------------------------------------------------------
// Shared: normalise parsed rows → fields + sample options
// ---------------------------------------------------------------------------
const buildFieldsFromRows = (
  headers: string[],
  dataRows: string[][]
): { fields: ParsedField[] } | { error: ParseError } => {
  if (headers.length === 0) {
    return { error: { code: 'NO_HEADER_ROW', message: 'File has no header row' } };
  }
  if (headers.length > 200) {
    return {
      error: {
        code: 'TOO_MANY_COLUMNS',
        message: `File has ${headers.length} columns; maximum is 200`,
      },
    };
  }

  const seenKeys = new Set<string>();
  const fields: ParsedField[] = [];

  for (let colIdx = 0; colIdx < headers.length; colIdx++) {
    const rawHeader = (headers[colIdx] ?? '').trim();
    if (!rawHeader) {
      return {
        error: {
          code: 'BLANK_HEADER',
          message: `Column ${colIdx + 1} has no header`,
        },
      };
    }

    const label = rawHeader.slice(0, MAX_HEADER_LEN);
    const key = slugifyHeader(label);
    if (!key) {
      return {
        error: {
          code: 'INVALID_HEADER',
          message: `Header "${label}" cannot be converted to a field key — please rename it to include at least one letter`,
        },
      };
    }
    if (seenKeys.has(key)) {
      return {
        error: {
          code: 'DUPLICATE_HEADER',
          message: `Two columns produce the same field key "${key}" — please rename so headers are distinct`,
        },
      };
    }
    seenKeys.add(key);

    // Sample distinct non-empty values from the column for use as
    // pre-filled options if the admin switches this field to SELECT.
    const samples = new Set<string>();
    for (const row of dataRows) {
      if (samples.size >= MAX_OPTION_SAMPLES) { break; }
      const cell = (row[colIdx] ?? '').toString().trim();
      if (cell) { samples.add(cell); }
    }
    const options = Array.from(samples).map(v => ({ label: v, value: v }));

    fields.push({
      fieldKey: key,
      fieldLabel: label,
      fieldType: 'TEXT',
      isRequired: false,
      displayOrder: colIdx,
      section: null,
      placeholder: null,
      defaultValue: null,
      validationRules: {},
      options,
    });
  }

  return { fields };
};

// ---------------------------------------------------------------------------
// Excel (.xlsx) parser
// ---------------------------------------------------------------------------
const parseXlsxBuffer = async (
  buffer: Buffer
): Promise<{ result: ParseResult } | { error: ParseError }> => {
  const wb = new ExcelJS.Workbook();
  try {
    // exceljs's type declaration predates the Node 20+ generic `Buffer<…>`
    // split, so the TS checker rejects a fresh Node Buffer at the call
    // site even though the runtime is happy. Bridge via unknown to stay
    // strict-null safe without importing a legacy @types shim.
    await wb.xlsx.load(buffer as unknown as Parameters<typeof wb.xlsx.load>[0]);
  } catch {
    return { error: { code: 'PARSE_FAILURE', message: 'Could not read Excel file — it may be corrupt or password-protected' } };
  }

  const ws = wb.worksheets[0];
  if (!ws) {
    return { error: { code: 'EMPTY_FILE', message: 'Workbook has no sheets' } };
  }

  const rowCount = ws.rowCount;
  if (rowCount < 1) {
    return { error: { code: 'EMPTY_FILE', message: 'Sheet is empty' } };
  }

  const colCount = ws.columnCount;
  const headerRow = ws.getRow(1);
  const headers: string[] = [];
  for (let c = 1; c <= colCount; c++) {
    const v = headerRow.getCell(c).value;
    headers.push(v === null || v === undefined ? '' : String(v));
  }
  // Trim trailing blank columns (common in Excel files where formatting
  // extends past actual data).
  while (headers.length > 0 && !headers[headers.length - 1].trim()) {
    headers.pop();
  }

  const dataRows: string[][] = [];
  for (let r = 2; r <= rowCount; r++) {
    const row = ws.getRow(r);
    const cells: string[] = [];
    for (let c = 1; c <= headers.length; c++) {
      const v = row.getCell(c).value;
      cells.push(
        v === null || v === undefined
          ? ''
          : v instanceof Date
            ? v.toISOString().slice(0, 10)
            : typeof v === 'object' && 'text' in v
              ? String((v as { text: unknown }).text ?? '')
              : String(v)
      );
    }
    if (cells.some(c => c.trim())) { dataRows.push(cells); }
  }

  const built = buildFieldsFromRows(headers, dataRows);
  if ('error' in built) { return built; }
  return {
    result: { fields: built.fields, sheetName: ws.name, rowCount: dataRows.length },
  };
};

// ---------------------------------------------------------------------------
// CSV parser
// ---------------------------------------------------------------------------
const parseCsvBuffer = (
  buffer: Buffer
): { result: ParseResult } | { error: ParseError } => {
  const text = buffer.toString('utf8');
  // Strip UTF-8 BOM if present — Excel-exported CSVs frequently include it
  // and papaparse treats the BOM as part of the first header otherwise.
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  const parsed = Papa.parse<string[]>(clean, {
    skipEmptyLines: 'greedy',
  });
  if (parsed.errors.length > 0) {
    return {
      error: {
        code: 'PARSE_FAILURE',
        message: `CSV parse error: ${parsed.errors[0]?.message ?? 'unknown'}`,
      },
    };
  }

  const rows = parsed.data as string[][];
  if (rows.length === 0) {
    return { error: { code: 'EMPTY_FILE', message: 'CSV is empty' } };
  }
  const headers = (rows[0] ?? []).map(h => (h ?? '').toString());
  while (headers.length > 0 && !headers[headers.length - 1].trim()) {
    headers.pop();
  }
  const dataRows = rows.slice(1).map(r => r.slice(0, headers.length));

  const built = buildFieldsFromRows(headers, dataRows);
  if ('error' in built) { return built; }
  return { result: { fields: built.fields, rowCount: dataRows.length } };
};

// ---------------------------------------------------------------------------
// Public entry point — dispatches on mime/extension.
// ---------------------------------------------------------------------------
export const parseTemplateUpload = async (
  file: { originalname: string; mimetype: string; buffer: Buffer }
): Promise<{ result: ParseResult } | { error: ParseError }> => {
  const name = file.originalname.toLowerCase();
  const isXlsx =
    name.endsWith('.xlsx') ||
    file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const isCsv =
    name.endsWith('.csv') ||
    file.mimetype === 'text/csv' ||
    file.mimetype === 'application/csv';

  if (isXlsx) { return parseXlsxBuffer(file.buffer); }
  if (isCsv) { return parseCsvBuffer(file.buffer); }
  return {
    error: {
      code: 'UNSUPPORTED_FORMAT',
      message: 'Only .xlsx and .csv files are supported',
    },
  };
};
