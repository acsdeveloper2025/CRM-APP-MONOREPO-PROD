import { query } from '@/config/database';
import { logger } from '@/config/logger';
import { extractPdfLocally, type LocalExtractionResult } from './pdfLocalExtractor';
import { reportTemplateRenderer } from './reportTemplateRenderer';

/**
 * PDF → Handlebars Template Converter (orchestration)
 *
 * Ties the local PDF extractor to the CRM's data model. Given a PDF upload
 * and a selected (client, product), this:
 *   1. Loads the client + product names.
 *   2. Loads the Data Entry Template fields for that pair (so the extractor
 *      knows which `{{data.<key>}}` placeholders can be auto-bound).
 *   3. Runs local PDF text extraction + placeholder binding.
 *   4. Runs a Handlebars compile check on the output — fails fast if the
 *      generator produced invalid syntax.
 *   5. Returns the verified HTML + telemetry.
 *
 * No external APIs, no AI, no per-request cost. Fully offline.
 */

export interface PdfConversionRequest {
  pdfBuffer: Buffer;
  clientId: number;
  productId: number;
}

export interface PdfConversionOutcome extends LocalExtractionResult {
  /** Compile-check outcome on the generated HTML. */
  validatedOk: boolean;
  validationError?: string;
  /** Stable identifier for the generator, surfaced in admin UI. */
  model: string;
  /** The data entry template fields used as context. */
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

const GENERATOR_ID = 'local-pdf-extractor';

export async function convertPdfToTemplate(
  req: PdfConversionRequest
): Promise<PdfConversionOutcome> {
  // 1. Validate the pair exists and fetch names.
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

  // 2. Fetch active Data Entry Template fields for placeholder auto-binding.
  //    If no template is configured, extraction still produces a layout —
  //    just without dynamic field bindings.
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

  // 3. Run local extractor.
  const extraction = await extractPdfLocally(req.pdfBuffer, {
    clientName: pair.clientName,
    productName: pair.productName,
    dataEntryFields,
  });

  // 4. Compile-check the generated template. We still return the draft on
  //    failure so the admin can inspect, but flag validatedOk=false.
  const validation = reportTemplateRenderer.validate(extraction.html);

  logger.info('PDF conversion outcome', {
    clientId: req.clientId,
    productId: req.productId,
    validated: validation.valid,
    htmlBytes: Buffer.byteLength(extraction.html, 'utf8'),
    elapsedMs: extraction.elapsedMs,
    pagesCount: extraction.pagesCount,
    textItemsCount: extraction.textItemsCount,
  });

  return {
    ...extraction,
    model: GENERATOR_ID,
    validatedOk: validation.valid,
    validationError: validation.valid ? undefined : validation.error,
    dataEntryFieldsUsed: dataEntryFields.map(f => ({
      fieldKey: f.fieldKey,
      fieldLabel: f.fieldLabel,
    })),
  };
}
