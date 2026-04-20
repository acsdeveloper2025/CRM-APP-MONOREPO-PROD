import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { logger } from '@/config/logger';

/**
 * PDF → HTML Local Extractor (offline, no AI)
 *
 * Shells out to `pdftohtml` (Poppler) in complex mode to produce pixel-perfect
 * HTML: each PDF page becomes a positioned <div> with absolutely-placed <p>
 * tags for text plus a background PNG carrying borders, lines, and any
 * embedded images. We inline the per-page PNGs as base64 data URIs and merge
 * the multi-<html> output from pdftohtml into a single Handlebars-ready
 * document, then lightly annotate text that matches known label keys with
 * inline placeholder suggestions as comments so the admin can substitute.
 *
 * Zero API cost. Fully offline. Requires `pdftohtml` (Poppler) on the host.
 */

interface LocalExtractionContext {
  clientName: string;
  productName: string;
  dataEntryFields: Array<{ fieldKey: string; fieldLabel: string; fieldType: string }>;
}

export type { LocalExtractionContext };

export interface LocalExtractionResult {
  html: string;
  elapsedMs: number;
  textItemsCount: number;
  pagesCount: number;
}

const PDFTOHTML_BIN = process.env.PDFTOHTML_BIN ?? 'pdftohtml';
const ZOOM = 1.5;
const PDFTOHTML_TIMEOUT_MS = 60_000;

const STANDARD_LABELS: Record<string, string> = {
  'customer name': '{{case.customerName}}',
  'applicant name': '{{case.customerName}}',
  name: '{{case.customerName}}',
  'customer phone': '{{case.customerPhone}}',
  'customer mobile': '{{case.customerPhone}}',
  mobile: '{{case.customerPhone}}',
  phone: '{{case.customerPhone}}',
  'application no': '{{case.caseNumber}}',
  'application number': '{{case.caseNumber}}',
  'app no': '{{case.caseNumber}}',
  'case no': '{{case.caseNumber}}',
  'case number': '{{case.caseNumber}}',
  pan: '{{case.panNumber}}',
  'pan no': '{{case.panNumber}}',
  'pan number': '{{case.panNumber}}',
  pincode: '{{case.pincode}}',
  'pin code': '{{case.pincode}}',
  'applicant type': '{{case.applicantType}}',
  'backend contact number': '{{case.backendContactNumber}}',
  'contact number': '{{case.backendContactNumber}}',
  trigger: '{{case.trigger}}',
  priority: '{{case.priority}}',
  status: '{{case.status}}',
  'received date': '{{formatDate case.receivedDate "DD-MM-YYYY"}}',
  'reported date': '{{formatDate case.receivedDate "DD-MM-YYYY"}}',
  'pickup date': '{{formatDate case.receivedDate "DD-MM-YYYY"}}',
  'completed date': '{{formatDate case.completedDate "DD-MM-YYYY"}}',
  client: '{{client.name}}',
  'client name': '{{client.name}}',
  product: '{{product.name}}',
  'product name': '{{product.name}}',
  tat: '{{totals.tatDays}}',
  'tat days': '{{totals.tatDays}}',
  'total tasks': '{{totals.totalTasks}}',
  'completed tasks': '{{totals.completedTasks}}',
};

function normalizeLabel(s: string): string {
  return s
    .replace(/&#160;|&nbsp;/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchLabel(rawText: string, customLabels: Map<string, string>): string | null {
  const norm = normalizeLabel(rawText);
  if (!norm) {
    return null;
  }
  if (customLabels.has(norm)) {
    return customLabels.get(norm) ?? null;
  }
  if (norm in STANDARD_LABELS) {
    return STANDARD_LABELS[norm];
  }
  const trimmed = norm.replace(/\s+(no|number|name|date)\.?$/, '').trim();
  if (trimmed && trimmed !== norm) {
    if (customLabels.has(trimmed)) {
      return customLabels.get(trimmed) ?? null;
    }
    if (trimmed in STANDARD_LABELS) {
      return STANDARD_LABELS[trimmed];
    }
  }
  return null;
}

async function runPdftohtml(pdfPath: string, outPrefix: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      PDFTOHTML_BIN,
      ['-c', '-s', '-fmt', 'png', '-zoom', String(ZOOM), '-q', pdfPath, outPrefix],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    );
    let stderr = '';
    child.stderr.on('data', d => {
      stderr += d.toString();
    });
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`pdftohtml timed out after ${PDFTOHTML_TIMEOUT_MS}ms`));
    }, PDFTOHTML_TIMEOUT_MS);
    child.on('error', err => {
      clearTimeout(timer);
      reject(
        new Error(
          `pdftohtml failed to launch (${err.message}). Install Poppler: brew install poppler (macOS) or apt install poppler-utils (Linux).`
        )
      );
    });
    child.on('close', code => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`pdftohtml exited ${code}: ${stderr.trim()}`));
      } else {
        resolve();
      }
    });
  });
}

/**
 * pdftohtml -c -s emits concatenated <html>...</html> blocks (one per page).
 * Extract each page's <body> content + the <style> block (deduped) and merge
 * into one valid HTML document. Inline PNG backgrounds as data URIs so the
 * saved template is self-contained.
 */
function mergeAndInline(
  raw: string,
  pngMap: Map<string, string>,
  customLabels: Map<string, string>
): { html: string; textItemsCount: number } {
  const pageBodies: string[] = [];
  const styles: string[] = [];

  const blocks = raw.split(/(?=<html\b)/i).filter(b => b.trim());
  for (const block of blocks) {
    const styleMatch = block.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
    if (styleMatch && styleMatch[1]) {
      styles.push(styleMatch[1].trim());
    }
    const bodyMatch = block.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch && bodyMatch[1]) {
      pageBodies.push(bodyMatch[1].trim());
    }
  }

  let body = pageBodies.join('\n<div class="page-break"></div>\n');

  for (const [name, dataUri] of pngMap) {
    body = body.split(`src="${name}"`).join(`src="${dataUri}"`);
  }

  // Light-touch placeholder hints: wrap a <p> whose text matches a catalog
  // label with an HTML comment suggesting the placeholder. Admin can paste
  // the placeholder into the value cell manually — we don't mutate visible
  // text so the pixel-perfect layout stays intact.
  let textItemsCount = 0;
  body = body.replace(/<p([^>]*)>([\s\S]*?)<\/p>/g, (_m, attrs, inner) => {
    textItemsCount += 1;
    const placeholder = matchLabel(inner, customLabels);
    if (placeholder) {
      return `<!-- label → ${placeholder} --><p${attrs}>${inner}</p>`;
    }
    return `<p${attrs}>${inner}</p>`;
  });

  const uniqueStyles = Array.from(new Set(styles)).join('\n');

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>{{client.name}} - {{product.name}} Report</title>
<style>
body { background: #fff; margin: 0; padding: 0; }
.page-break { page-break-before: always; }
${uniqueStyles}
</style>
</head>
<body>
<!--
Local PDF extractor output (pdftohtml -c). Layout matches the source PDF
pixel-for-pixel. Page backgrounds (borders, lines, any non-text graphics)
are inlined as PNG data URIs. Placeholder hints are left as HTML comments
above matched label <p> tags; replace the adjacent value <p> text with the
suggested {{...}} placeholder to bind dynamic data.
-->
${body}
</body>
</html>
`;

  return { html, textItemsCount };
}

export async function extractPdfLocally(
  pdfBuffer: Buffer,
  context: LocalExtractionContext
): Promise<LocalExtractionResult> {
  const startedAt = Date.now();
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pdfout-'));
  try {
    const pdfPath = path.join(workDir, 'input.pdf');
    await fs.writeFile(pdfPath, pdfBuffer);
    const outPrefix = path.join(workDir, 'page');

    logger.info('Local PDF extraction starting (poppler)', {
      clientName: context.clientName,
      productName: context.productName,
      dataEntryFieldCount: context.dataEntryFields.length,
      pdfBytes: pdfBuffer.length,
    });

    await runPdftohtml(pdfPath, outPrefix);

    const files = await fs.readdir(workDir);
    const htmlFile = files.find(f => f.endsWith('.html'));
    if (!htmlFile) {
      throw new Error('pdftohtml produced no HTML file');
    }
    const rawHtml = await fs.readFile(path.join(workDir, htmlFile), 'utf8');

    const pngFiles = files.filter(f => f.endsWith('.png')).sort();
    const pngMap = new Map<string, string>();
    for (const png of pngFiles) {
      const buf = await fs.readFile(path.join(workDir, png));
      pngMap.set(png, `data:image/png;base64,${buf.toString('base64')}`);
    }

    const customLabels = new Map<string, string>();
    for (const f of context.dataEntryFields) {
      customLabels.set(normalizeLabel(f.fieldLabel), `{{data.${f.fieldKey}}}`);
    }

    const { html, textItemsCount } = mergeAndInline(rawHtml, pngMap, customLabels);

    const elapsedMs = Date.now() - startedAt;
    const pagesCount = pngFiles.length;

    logger.info('Local PDF extraction completed (poppler)', {
      elapsedMs,
      pagesCount,
      textItemsCount,
      htmlBytes: Buffer.byteLength(html, 'utf8'),
    });

    return { html, elapsedMs, textItemsCount, pagesCount };
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
}
