import { query } from '@/config/database';
import { logger } from '@/config/logger';
import { convertPdfToHandlebarsTemplate, type PdfConversionResult } from './claudeAIService';
import { reportTemplateRenderer } from './reportTemplateRenderer';

/**
 * PDF → Handlebars Template Converter (orchestration)
 *
 * Ties the Claude service to the CRM's data model. Given a PDF upload + a
 * selected (client, product), this:
 *   1. Loads the client + product names (used in the prompt).
 *   2. Loads the Data Entry Template fields for that pair (so Claude knows
 *      which `{{data.<key>}}` placeholders are valid).
 *   3. Calls Claude to generate the HTML.
 *   4. Runs a Handlebars compile check on the output — fails fast if the
 *      model produced invalid syntax, rather than letting the admin paste
 *      something that'll break on save.
 *   5. Returns the verified HTML + telemetry.
 */

export interface PdfConversionRequest {
  pdfBuffer: Buffer;
  clientId: number;
  productId: number;
}

export interface PdfConversionOutcome extends PdfConversionResult {
  // Provenance so the admin UI can display cost/latency info.
  validatedOk: boolean;
  validationError?: string;
  /**
   * The data entry template fields used as context. Handy for debugging if
   * the admin is surprised Claude didn't use a specific placeholder.
   */
  dataEntryFieldsUsed: Array<{ fieldKey: string; fieldLabel: string }>;
}

export class PdfConversionInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PdfConversionInputError';
  }
}

interface ClientProductRow {
  clientName: string;
  productName: string;
}

interface DataEntryFieldRow {
  fieldKey: string;
  fieldLabel: string;
  fieldType: string;
}

export async function convertPdfToTemplate(
  req: PdfConversionRequest
): Promise<PdfConversionOutcome> {
  // 1. Validate the pair exists and fetch names in a single query.
  const pairRes = await query<ClientProductRow>(
    `SELECT c.name AS client_name, p.name AS product_name
     FROM clients c, products p
     WHERE c.id = $1 AND p.id = $2`,
    [req.clientId, req.productId]
  );
  const pair = pairRes.rows[0];
  if (!pair) {
    throw new PdfConversionInputError(
      'Unknown client or product - both must exist before converting.'
    );
  }

  // 2. Fetch the active Data Entry Template fields so Claude sees which
  //    {{data.<key>}} placeholders are valid. If no template is configured
  //    yet, Claude still produces a layout — just without dynamic fields.
  const fieldsRes = await query<DataEntryFieldRow>(
    `SELECT f.field_key, f.field_label, f.field_type
     FROM case_data_template_fields f
     JOIN case_data_templates t ON t.id = f.template_id
     WHERE t.client_id = $1
       AND t.product_id = $2
       AND t.is_active = true
       AND f.is_active = true
     ORDER BY f.display_order ASC, f.id ASC`,
    [req.clientId, req.productId]
  );
  const dataEntryFields = fieldsRes.rows;

  // 3. Call Claude — the only AI backend in this codebase.
  const conversion: PdfConversionResult = await convertPdfToHandlebarsTemplate(req.pdfBuffer, {
    clientName: pair.clientName,
    productName: pair.productName,
    dataEntryFields,
  });

  // 4. Compile-check the returned template. If Claude's output doesn't
  //    compile, we still return it to the admin (so they can inspect and
  //    fix), but flag validatedOk=false with the error for the UI to show.
  const validation = reportTemplateRenderer.validate(conversion.html);

  logger.info('PDF conversion outcome', {
    clientId: req.clientId,
    productId: req.productId,
    validated: validation.valid,
    htmlBytes: Buffer.byteLength(conversion.html, 'utf8'),
    elapsedMs: conversion.elapsedMs,
    cacheReadTokens: conversion.cacheReadTokens,
    cacheCreationTokens: conversion.cacheCreationTokens,
  });

  return {
    ...conversion,
    validatedOk: validation.valid,
    validationError: validation.valid ? undefined : validation.error,
    dataEntryFieldsUsed: dataEntryFields.map(f => ({
      fieldKey: f.fieldKey,
      fieldLabel: f.fieldLabel,
    })),
  };
}
