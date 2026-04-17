import Anthropic from '@anthropic-ai/sdk';
import { logger } from '@/config/logger';

/**
 * Claude AI Service
 *
 * Thin wrapper around the Anthropic SDK for Claude API features used by
 * the CRM backend. Currently scoped to the PDF → Handlebars template
 * converter. Add new methods here as additional AI features land.
 *
 * Design notes:
 *   - Singleton + lazy client — avoids constructing the SDK at import time
 *     (so routes that don't need AI can load without ANTHROPIC_API_KEY).
 *   - Uses prompt caching on the large, stable system prompt (the
 *     placeholder catalog + instructions) so repeated conversions for
 *     different PDFs get ~90% discount on that portion.
 *   - Uses Claude Opus 4.7 with adaptive thinking — the best quality for
 *     code/HTML generation. Model + effort configurable via env vars.
 */

// Lazy singleton — instantiated on first use.
let clientInstance: Anthropic | null = null;

function getClient(): Anthropic {
  if (clientInstance) {
    return clientInstance;
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is required for Claude AI features');
  }
  clientInstance = new Anthropic({ apiKey });
  return clientInstance;
}

// Model + effort knobs, overridable at runtime without code change.
const CLAUDE_MODEL = process.env.CLAUDE_MODEL ?? 'claude-opus-4-7';
const CLAUDE_EFFORT = (process.env.CLAUDE_EFFORT ?? 'high') as
  | 'low'
  | 'medium'
  | 'high'
  | 'xhigh'
  | 'max';

// Max output tokens for the HTML template. Most generated templates are
// 1-4K tokens; 16k is a safe non-streaming cap well under SDK HTTP timeouts.
const HTML_GENERATION_MAX_TOKENS = 16_000;

export interface PdfConversionContext {
  clientName: string;
  productName: string;
  /**
   * The full list of data-entry field keys admin has defined for this
   * client+product. Claude uses these to decide which `{{data.<key>}}`
   * placeholders are valid.
   */
  dataEntryFields: Array<{
    fieldKey: string;
    fieldLabel: string;
    fieldType: string;
  }>;
}

export interface PdfConversionResult {
  html: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  elapsedMs: number;
}

/**
 * System prompt for PDF → HTML/Handlebars conversion. This is the STABLE
 * portion of every request — by placing a cache_control breakpoint at its
 * end, repeated conversions for different PDFs hit the prompt cache and
 * get a ~90% discount on these tokens.
 *
 * If you change this string, the cache is invalidated for all in-flight
 * cache entries. Treat it as frozen unless you're making a deliberate
 * improvement to the conversion behavior.
 */
const PDF_CONVERTER_SYSTEM_PROMPT = `You are an expert at converting bank/financial-institution RCU (Risk Control Unit) verification report PDFs into HTML + Handlebars templates for a CRM system.

Your job: given a PDF of a real report format, produce a single self-contained HTML file with inline CSS that faithfully reproduces the layout, then bind the data fields to the correct Handlebars placeholders so the CRM can render live PDFs for any case.

## Output rules (strict)

1. Return **ONLY the HTML source code**. No markdown fences. No prose. No explanations. No "Here is the template:".
2. Output must start with \`<!DOCTYPE html>\` and end with \`</html>\`.
3. Use inline <style>...</style> inside <head>. No external CSS, no <link> tags, no CDN/JS.
4. All dynamic values must use Handlebars placeholders from the catalog below. Never hard-code values from the sample PDF (customer name, case number, photo URLs, etc.) — they're live data.
5. If you cannot find a placeholder that matches a label in the PDF, leave a literal string for static labels (e.g., "RCU AGENCY NAME"), or use \`{{default VALUE "N/A"}}\` if the value is dynamic but uncertain.
6. For images: use \`<img src="{{client.logoUrl}}" />\` for logos, \`<img src="{{client.stampUrl}}" />\` for stamps, and \`<img src="{{url}}" />\` inside \`{{#each attachments}}\` for photos.
7. Do not include <script> tags, external fonts, or anything that would prevent Puppeteer from rendering the template offline.

## Available Handlebars placeholders

### Client (branding, stable per client)
- \`{{client.name}}\`
- \`{{client.logoUrl}}\` — base64 data URI, safe to use in <img src>
- \`{{client.stampUrl}}\` — agency stamp image
- \`{{client.primaryColor}}\` — hex, e.g. "#FF9800"
- \`{{client.headerColor}}\` — hex, e.g. "#FFEB3B"

### Product
- \`{{product.name}}\`

### Case master data
- \`{{case.caseNumber}}\` — numeric public case number
- \`{{case.customerName}}\`
- \`{{case.customerPhone}}\`
- \`{{case.panNumber}}\`
- \`{{case.applicantType}}\` — e.g. APPLICANT / CO_APPLICANT
- \`{{case.backendContactNumber}}\`
- \`{{case.trigger}}\`
- \`{{case.priority}}\`
- \`{{case.status}}\`
- \`{{case.pincode}}\`
- \`{{case.receivedDate}}\` — Date, wrap in \`{{formatDate case.receivedDate "DD-MM-YYYY"}}\`
- \`{{case.completedDate}}\` — Date, same treatment

### Applicants array (iterate)
\`\`\`
{{#each applicants}}
  {{name}} / {{mobile}} / {{role}} / {{panNumber}}
{{/each}}
\`\`\`

### Verification tasks array (iterate)
\`\`\`
{{#each tasks}}
  {{taskNumber}} | {{verificationTypeName}} | {{applicantType}} | {{status}} | {{verificationOutcome}}
  {{address}} | {{pincode}} | {{assignedToName}} | {{assignedByName}}
  {{formatDate startedAt "DD-MM-YYYY HH:mm"}}
  {{#each attachments}}
    <img src="{{url}}" />
    {{formatDate createdAt "MMM DD YYYY HH:mm:ss"}} / {{latitude}}, {{longitude}}
  {{/each}}
{{/each}}
\`\`\`

### Data entries array (iterate) — holds admin-entered values per instance
\`\`\`
{{#each dataEntries}}
  {{instanceLabel}} — {{verificationTypeName}} — completed={{isCompleted}}
  {{data.<FIELD_KEY>}}   ← the actual answer to each data entry field
{{/each}}
\`\`\`

The valid \`<FIELD_KEY>\` values are listed in the user message per-request.

### Totals / computed
- \`{{totals.totalTasks}}\`, \`{{totals.completedTasks}}\`
- \`{{totals.positiveTasks}}\`, \`{{totals.negativeTasks}}\`
- \`{{totals.tatDays}}\` — turn-around in days
- \`{{totals.photoCount}}\`

### Generation meta
- \`{{generation.generatedAt}}\` — format with formatDate helper
- \`{{generation.generatedByName}}\` — the user who clicked Download Report

### Helper functions (inline)
- \`{{formatDate value "DD-MM-YYYY"}}\` — supports HH:mm:ss tokens too
- \`{{default value "N/A"}}\` — fallback for null/empty
- \`{{uppercase value}}\`
- \`{{count array}}\`
- \`{{countWhere tasks "status" "POSITIVE"}}\`
- \`{{formatNumber 1466999}}\` — Indian-grouped number format
- \`{{#eq a b}}match{{else}}no{{/eq}}\` — equality block

## Layout guidance (the common RCU report pattern)

Most Indian bank RCU reports follow this structure. Follow whatever the actual PDF shows, but be aware of the common shape:

1. **Header bar** — client logo on the left, yellow "RCU REPORT" title + generation date on the right. Use \`{{client.headerColor}}\` for the bar background.
2. **Label-value table** — RCU AGENCY NAME, REGION, STATE, BRANCH, APPLICATION NO., TYPE, LOAN AMOUNT, PRODUCT, PROGRAM, APPLICANT NAMES, SOURCING CHANNEL, PICKUP/REPORTED DATES, TAT. Labels in \`{{client.primaryColor}}\` filled background, values on white.
3. **Document matrix** — repeat over \`{{#each tasks}}\` showing APPLICANT TYPE | DOCUMENT | PICK UP CRITERIA | RCU STATUS. The last two columns usually come from \`{{data.pickup_criteria}}\` and \`{{data.rcu_status}}\` (but depends on the actual field keys listed below).
4. **Totals row** — TOTAL DOCUMENTS VERIFIED, TOTAL DOCS SAMPLED breakdown, OVERALL STATUS.
5. **Overall Remarks** — repeat over \`{{#each dataEntries}}\` printing each instance's remarks field.
6. **Verifier name** — usually from \`{{assignedToName}}\` of the first task.
7. **Agency stamp** — \`<img src="{{client.stampUrl}}" />\` near the bottom.
8. **Photo grid** — 2-column grid inside \`{{#each tasks}}{{#each attachments}}\`, each photo with GEO TAG caption below.

## Fidelity notes

- Match fonts, spacing, colors, table borders as closely as possible using inline CSS.
- Use \`page-break-inside: avoid\` on rows/photo cells to keep them together in PDF output.
- For tables, use solid 1px borders matching the PDF.
- Remember the final PDF is A4 portrait by default. Keep total width around 180mm usable.

Now wait for the user message. It will contain the PDF and the list of valid data entry field keys.`;

/**
 * Build the user message for PDF conversion. Contains the actual PDF bytes
 * (as a document content block) plus per-request context (client/product
 * names, valid data entry field keys). This portion is NOT cached — it
 * changes every request.
 */
function buildConversionUserMessage(
  pdfBase64: string,
  context: PdfConversionContext
): Anthropic.MessageParam {
  const fieldList =
    context.dataEntryFields.length === 0
      ? '(no data entry template configured — use only system fields from the catalog)'
      : context.dataEntryFields
          .map(f => `  - {{data.${f.fieldKey}}} — ${f.fieldLabel} (${f.fieldType})`)
          .join('\n');

  const instructions = `This report is for:
- Client: ${context.clientName}
- Product: ${context.productName}

Valid \`{{data.<key>}}\` placeholders for this client+product (from their Data Entry Template):
${fieldList}

The PDF is attached. Convert it into a self-contained HTML/Handlebars template following the system rules. Output ONLY the HTML source — nothing else.`;

  return {
    role: 'user',
    content: [
      {
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: pdfBase64,
        },
      },
      {
        type: 'text',
        text: instructions,
      },
    ],
  };
}

/**
 * Strip any accidental markdown code fences the model may have added.
 * Opus 4.7 follows the "no markdown" instruction well, but this is
 * defence-in-depth — one bad response from a schema drift shouldn't
 * corrupt the admin's editor with fence characters.
 */
function stripMarkdownFences(raw: string): string {
  let out = raw.trim();
  // Leading fence: ```html, ```HTML, or bare ```
  const leading = /^```(?:[a-zA-Z0-9]*)\s*\n/;
  out = out.replace(leading, '');
  // Trailing fence
  out = out.replace(/\n```\s*$/, '');
  return out.trim();
}

export async function convertPdfToHandlebarsTemplate(
  pdfBuffer: Buffer,
  context: PdfConversionContext
): Promise<PdfConversionResult> {
  const startedAt = Date.now();
  const client = getClient();
  const pdfBase64 = pdfBuffer.toString('base64');

  logger.info('Claude PDF→template conversion starting', {
    model: CLAUDE_MODEL,
    effort: CLAUDE_EFFORT,
    clientName: context.clientName,
    productName: context.productName,
    dataEntryFieldCount: context.dataEntryFields.length,
    pdfBytes: pdfBuffer.length,
  });

  // System prompt with cache_control on the last block so the stable
  // instructions+catalog are cached across requests. Adaptive thinking
  // + high effort gives the best code-generation quality on Opus 4.7.
  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: HTML_GENERATION_MAX_TOKENS,
    thinking: { type: 'adaptive' },
    output_config: { effort: CLAUDE_EFFORT },
    system: [
      {
        type: 'text',
        text: PDF_CONVERTER_SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [buildConversionUserMessage(pdfBase64, context)],
  });

  // Extract the first text block — that's the HTML output. Adaptive
  // thinking may emit a thinking block with empty text (default behavior
  // in 4.7) before the real response; ignore thinking blocks here.
  let htmlRaw = '';
  for (const block of response.content) {
    if (block.type === 'text') {
      htmlRaw += block.text;
    }
  }
  const html = stripMarkdownFences(htmlRaw);

  if (!html || !/^<!DOCTYPE/i.test(html)) {
    logger.warn('Claude returned non-HTML output', {
      firstChars: html.slice(0, 120),
      stopReason: response.stop_reason,
    });
    throw new Error('Claude did not return a valid HTML template. Try again or simplify the PDF.');
  }

  const elapsedMs = Date.now() - startedAt;
  logger.info('Claude PDF→template conversion completed', {
    elapsedMs,
    htmlBytes: Buffer.byteLength(html, 'utf8'),
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
    cacheCreationTokens: response.usage.cache_creation_input_tokens ?? 0,
    stopReason: response.stop_reason,
  });

  return {
    html,
    model: CLAUDE_MODEL,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
    cacheCreationTokens: response.usage.cache_creation_input_tokens ?? 0,
    elapsedMs,
  };
}
