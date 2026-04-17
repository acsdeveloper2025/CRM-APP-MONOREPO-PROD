import Handlebars from 'handlebars';
import puppeteer, { type Browser, type PDFOptions } from 'puppeteer';
import { logger } from '../utils/logger';

// ---------------------------------------------------------------------------
// Concurrency + timeout configuration (scale hardening)
// ---------------------------------------------------------------------------

// Max concurrent Puppeteer pages open at once. Each page is a Chromium
// renderer process (~200-300 MB RSS) — allowing unbounded concurrency
// under burst load blows past the Node process's RAM budget in seconds.
// 6 is a good default for a PDF server with ~4 GB RAM. Override via
// REPORT_PDF_MAX_CONCURRENCY env var.
const MAX_CONCURRENT_PDF_RENDERS = Math.max(
  1,
  Number.parseInt(process.env.REPORT_PDF_MAX_CONCURRENCY ?? '', 10) || 6
);

// Hard ceilings on individual phases. page.setContent() can block on
// resource loading; page.pdf() can block on layout. Without timeouts a
// single runaway template hangs the renderer and counts against the
// concurrency cap forever.
const SET_CONTENT_TIMEOUT_MS = 30_000;
const PDF_TIMEOUT_MS = 60_000;

/**
 * Report Template Renderer
 *
 * Compiles Handlebars HTML templates with a data context and renders them
 * to a PDF buffer via Puppeteer. This is the low-level primitive used by the
 * report generation flow.
 *
 * Higher-level code (controllers / services) is responsible for:
 *   - Loading the template string from the DB (report_templates.html_content)
 *   - Building the rich context object (case + applicants + entries + tasks + attachments)
 *   - Passing both to renderToPdfBuffer() and streaming the result to the caller
 *
 * Follows the same singleton + launch-args pattern as PDFExportService for
 * consistency. Browser instance is lazy and reusable across renders.
 */

export type ReportPageSize = 'A4' | 'LETTER' | 'LEGAL';
export type ReportPageOrientation = 'portrait' | 'landscape';

export interface RenderToPdfOptions {
  pageSize?: ReportPageSize;
  pageOrientation?: ReportPageOrientation;
  marginTop?: string;
  marginRight?: string;
  marginBottom?: string;
  marginLeft?: string;
}

export interface RenderResult {
  buffer: Buffer;
  fileSizeBytes: number;
  generationMs: number;
}

export interface ValidateResult {
  valid: boolean;
  error?: string;
}

class ReportTemplateRenderer {
  private browser: Browser | null = null;
  private helpersRegistered = false;

  // Semaphore state: count of in-flight renders + waiter queue.
  // Concurrency cap is strictly enforced; excess requests queue in
  // FIFO order and are released as earlier renders complete.
  private activeRenders = 0;
  private readonly waitQueue: Array<() => void> = [];

  private async acquireSlot(): Promise<void> {
    if (this.activeRenders < MAX_CONCURRENT_PDF_RENDERS) {
      this.activeRenders += 1;
      return;
    }
    await new Promise<void>(resolve => {
      this.waitQueue.push(resolve);
    });
    this.activeRenders += 1;
  }

  private releaseSlot(): void {
    this.activeRenders -= 1;
    const next = this.waitQueue.shift();
    if (next) {
      next();
    }
  }

  /**
   * Observability hook - returns a snapshot of current semaphore state.
   * Useful for a /health/detailed probe.
   */
  public getConcurrencyStats(): {
    activeRenders: number;
    queueDepth: number;
    maxConcurrent: number;
  } {
    return {
      activeRenders: this.activeRenders,
      queueDepth: this.waitQueue.length,
      maxConcurrent: MAX_CONCURRENT_PDF_RENDERS,
    };
  }

  private stringify(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      typeof value === 'bigint'
    ) {
      return String(value);
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    // Deliberately do not stringify objects/arrays here - helpers should
    // narrow to the primitives they expect before calling through.
    return '';
  }

  public registerHelpersOnce(): void {
    if (this.helpersRegistered) {
      return;
    }

    const stringify = this.stringify.bind(this);

    // {{formatDate value "DD-MM-YYYY"}} - defensive formatter accepting Date | string | null
    Handlebars.registerHelper('formatDate', (value: unknown, format: unknown): string => {
      if (value === null || value === undefined || value === '') {
        return '';
      }
      const date = value instanceof Date ? value : new Date(stringify(value));
      if (Number.isNaN(date.getTime())) {
        return '';
      }
      const pattern = typeof format === 'string' ? format : 'DD-MM-YYYY';
      const dd = String(date.getDate()).padStart(2, '0');
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const yyyy = String(date.getFullYear());
      const hh = String(date.getHours()).padStart(2, '0');
      const mi = String(date.getMinutes()).padStart(2, '0');
      const ss = String(date.getSeconds()).padStart(2, '0');
      return pattern
        .replace(/YYYY/g, yyyy)
        .replace(/MM/g, mm)
        .replace(/DD/g, dd)
        .replace(/HH/g, hh)
        .replace(/mm/g, mi)
        .replace(/ss/g, ss);
    });

    // {{default value "N/A"}}
    Handlebars.registerHelper('default', (value: unknown, fallback: unknown): unknown => {
      if (value === null || value === undefined || value === '') {
        return fallback;
      }
      return value;
    });

    // {{uppercase value}}
    Handlebars.registerHelper('uppercase', (value: unknown): string => {
      return stringify(value).toUpperCase();
    });

    // {{count array}}
    Handlebars.registerHelper('count', (value: unknown): number => {
      if (Array.isArray(value)) {
        return value.length;
      }
      return 0;
    });

    // {{countWhere array "key" "value"}}
    Handlebars.registerHelper(
      'countWhere',
      (array: unknown, key: unknown, expected: unknown): number => {
        if (!Array.isArray(array) || typeof key !== 'string') {
          return 0;
        }
        return array.filter((item: unknown) => {
          if (item === null || typeof item !== 'object') {
            return false;
          }
          const record = item as Record<string, unknown>;
          return record[key] === expected;
        }).length;
      }
    );

    // {{formatNumber value}} - groups thousands, no currency symbol
    Handlebars.registerHelper('formatNumber', (value: unknown): string => {
      if (value === null || value === undefined || value === '') {
        return '';
      }
      const num = Number(value);
      if (Number.isNaN(num)) {
        return stringify(value);
      }
      return num.toLocaleString('en-IN');
    });

    // {{#eq a b}}...{{else}}...{{/eq}} - strict equality block helper
    Handlebars.registerHelper(
      'eq',
      function (this: unknown, a: unknown, b: unknown, options: Handlebars.HelperOptions): string {
        return a === b ? options.fn(this) : options.inverse(this);
      }
    );

    this.helpersRegistered = true;
  }

  public compile(templateSource: string): HandlebarsTemplateDelegate<unknown> {
    this.registerHelpersOnce();
    // noEscape is OFF so user-provided string values are HTML-escaped by default.
    // Template authors can opt into raw output per-field with {{{rawField}}}.
    return Handlebars.compile(templateSource, { strict: false });
  }

  public validate(templateSource: string): ValidateResult {
    try {
      this.registerHelpersOnce();
      Handlebars.precompile(templateSource, { strict: false });
      return { valid: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown compilation error';
      return { valid: false, error: message };
    }
  }

  private async ensureBrowser(): Promise<Browser> {
    if (!this.browser || !this.browser.connected) {
      if (this.browser && !this.browser.connected) {
        // Browser disconnected (crash / OOM kill). Log loudly and relaunch.
        logger.warn('ReportTemplateRenderer: browser disconnected, relaunching');
        try {
          await this.browser.close();
        } catch {
          // Already dead - swallow.
        }
        this.browser = null;
      }
      this.browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
      // If Chromium dies, null the reference so the next call relaunches.
      this.browser.on('disconnected', () => {
        logger.warn('ReportTemplateRenderer: browser "disconnected" event');
        this.browser = null;
      });
    }
    return this.browser;
  }

  /**
   * Wrap an awaitable with a timeout guard. If the promise does not settle
   * within `ms`, rejects with a clear error. Critically, this does NOT
   * cancel the underlying operation — Puppeteer does not expose a cancel
   * token for page.pdf / page.setContent — but the rejection lets the
   * caller proceed and, in our `finally` block, close the page which
   * tears down the stuck renderer process.
   */
  private timeoutGuard<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout>;
    const timeoutPromise = new Promise<T>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`${label} timed out after ${ms}ms`));
      }, ms);
    });
    return Promise.race([promise.finally(() => clearTimeout(timer)), timeoutPromise]);
  }

  public async renderToPdfBuffer(
    templateSource: string,
    context: Record<string, unknown>,
    options: RenderToPdfOptions = {}
  ): Promise<RenderResult> {
    const startedAt = Date.now();

    // Acquire a concurrency slot before doing any heavy work. Compile and
    // template expansion are cheap enough to do inside the critical section;
    // the real cost is browser newPage + render.
    await this.acquireSlot();
    let page: Awaited<ReturnType<Browser['newPage']>> | null = null;
    try {
      const template = this.compile(templateSource);
      const html = template(context);

      const browser = await this.ensureBrowser();
      page = await browser.newPage();

      // 'load' waits for all resources (images, fonts) to finish. 'networkidle0'
      // is stricter but can hang indefinitely on a quiet page with background
      // connections. For self-contained HTML (data URIs embedded) 'load' is
      // both faster and more reliable. Timeout belt-and-braces via guard too.
      await this.timeoutGuard(
        page.setContent(html, { waitUntil: 'load', timeout: SET_CONTENT_TIMEOUT_MS }),
        SET_CONTENT_TIMEOUT_MS + 2000,
        'page.setContent'
      );

      const pdfOptions: PDFOptions = {
        format: options.pageSize ?? 'A4',
        landscape: options.pageOrientation === 'landscape',
        margin: {
          top: options.marginTop ?? '15mm',
          right: options.marginRight ?? '10mm',
          bottom: options.marginBottom ?? '15mm',
          left: options.marginLeft ?? '10mm',
        },
        printBackground: true,
        preferCSSPageSize: false,
        timeout: PDF_TIMEOUT_MS,
      };

      const raw = await this.timeoutGuard(page.pdf(pdfOptions), PDF_TIMEOUT_MS, 'page.pdf');
      const buffer = Buffer.from(raw);

      return {
        buffer,
        fileSizeBytes: buffer.length,
        generationMs: Date.now() - startedAt,
      };
    } finally {
      // Close the page even if render threw (timeout, crash, bad template);
      // page.close() tears down the Chromium renderer process that was
      // associated with this page, freeing memory.
      if (page) {
        try {
          await page.close();
        } catch (closeErr) {
          logger.warn('ReportTemplateRenderer: page close failed', { closeErr });
        }
      }
      // Always release the semaphore slot, whether render succeeded, threw,
      // or timed out. Without this, one stuck render leaks a slot forever.
      this.releaseSlot();
    }
  }

  public async close(): Promise<void> {
    if (this.browser) {
      try {
        await this.browser.close();
      } catch (err) {
        logger.warn('ReportTemplateRenderer browser close failed', { err });
      }
      this.browser = null;
    }
  }
}

export const reportTemplateRenderer = new ReportTemplateRenderer();
