/**
 * Step 4: For every task in /tmp/matrix_results.jsonl, fetch its form_submissions row,
 * regenerate the template via TemplateReportService, scan the output for grammar
 * artifacts, and print a per-test verdict.
 */
import { Pool } from 'pg';
import * as fs from 'fs';
import { templateReportService } from '../src/services/TemplateReportService';

const pool = new Pool({
  user: process.env.DB_USER || 'acs_user',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'acs_db',
  password: process.env.DB_PASSWORD || 'acs_password',
  port: Number(process.env.DB_PORT || 5432),
});

// Map verification_type code -> service.verificationType
const TYPE_MAP: Record<string, string> = {
  RV: 'RESIDENCE', RC: 'RESIDENCE_CUM_OFFICE', OV: 'OFFICE', EV: 'BUSINESS',
  BV: 'BUILDER', NV: 'NOC', DV: 'DSA_CONNECTOR', PAV: 'PROPERTY_APF', PIV: 'PROPERTY_INDIVIDUAL',
};

// Map our outcomeKey to the API outcome string the service understands
const OUTCOME_API: Record<string, string> = {
  Positive_Open: 'Positive & Door Open',
  Positive_Closed: 'Positive & Door Locked',
  Shifted_Open: 'Shifted & Door Open',
  Shifted_Closed: 'Shifted & Door Locked',
  Nsp_Open: 'NSP & Door Open',
  Nsp_Closed: 'NSP & Door Locked',
  EntryRestricted: 'Entry Restricted',
  Untraceable: 'Untraceable',
  Positive_Seen: 'Positive (Construction Seen)',
  Positive_Stop: 'Negative (Construction Stop)',
  Positive_Vacant: 'Negative (Plot Vacant)',
};

function detectIssues(text: string): string[] {
  const issues: string[] = [];
  // double-space (post-cleanup these should be gone)
  if (/  +/.test(text)) issues.push('DOUBLE_SPACE');
  // trailing space-period (broken sentence)
  if (/ \./.test(text)) issues.push('SPACE_BEFORE_PERIOD');
  // " is  at " — broken auxiliary verb
  if (/ is  at /.test(text)) issues.push('IS_BLANK_AT');
  // "showed  as" — broken doc sentence
  if (/showed  as/.test(text)) issues.push('SHOWED_BLANK_AS');
  // empty quoted strings
  if (/""/.test(text)) issues.push('EMPTY_QUOTES');
  // "Not provided" rendering mid-sentence often awkward
  const np = (text.match(/Not provided/g) || []).length;
  if (np > 3) issues.push(`NOT_PROVIDED_x${np}`);
  // " ," — comma after blank
  if (/ ,/.test(text)) issues.push('SPACE_BEFORE_COMMA');
  // 'undefined' — placeholder leak
  if (/undefined/.test(text)) issues.push('UNDEFINED_LEAK');
  // 'null' inline
  if (/\bnull\b/.test(text)) issues.push('NULL_INLINE');
  return issues;
}

async function main() {
  const lines = fs.readFileSync('/tmp/matrix_results.jsonl', 'utf8').trim().split('\n');
  let totalIssues = 0;
  const reports: Array<{ code: string; key: string; issues: string[]; firstSnippet: string }> = [];
  for (const line of lines) {
    const r = JSON.parse(line);
    if (!r.success) continue;
    const code = r.code as string;
    const taskId = r.task_id as string;
    const key = r.key as string;

    const fs_row = await pool.query(
      `SELECT submission_data AS form_submission_data FROM form_submissions WHERE verification_task_id=$1 LIMIT 1`,
      [taskId]
    );
    if (fs_row.rowCount === 0) continue;
    const formData = fs_row.rows[0].form_submission_data;

    const verificationType = TYPE_MAP[code];
    const outcome = OUTCOME_API[key] || key;

    const caseRow = await pool.query(
      `SELECT customer_name FROM cases c JOIN verification_tasks vt ON vt.case_id=c.id WHERE vt.id=$1`,
      [taskId]
    );
    const customerName = caseRow.rows[0]?.customer_name || 'CUSTOMER';

    const result = templateReportService.generateTemplateReport({
      verificationType,
      outcome,
      formData,
      caseDetails: {
        caseId: 'G',
        address: 'A-301 Sunshine Apartments, MG Road, Mumbai 400058',
        customerName,
        applicantType: 'APPLICANT',
      } as any,
    });
    if (!result.success) {
      reports.push({ code, key, issues: ['RENDER_FAIL'], firstSnippet: result.error || '' });
      totalIssues++;
      continue;
    }
    const issues = detectIssues(result.report || '');
    if (issues.length > 0) {
      totalIssues++;
      const idx = (result.report || '').search(/  +| \.| is  at |showed  as|""|undefined|\bnull\b/);
      const snippet = idx >= 0 ? (result.report || '').substring(Math.max(0, idx - 40), idx + 60) : '';
      reports.push({ code, key, issues, firstSnippet: snippet });
    } else {
      reports.push({ code, key, issues: [], firstSnippet: '' });
    }
  }

  // Summary
  let pass = 0, fail = 0;
  for (const r of reports) {
    if (r.issues.length === 0) {
      pass++;
      console.log(`  [OK]  ${r.code.padEnd(4)} ${r.key.padEnd(22)}`);
    } else {
      fail++;
      console.log(`  [BAD] ${r.code.padEnd(4)} ${r.key.padEnd(22)} | ${r.issues.join(',')}`);
      console.log(`        snippet: "${r.firstSnippet.replace(/\n/g, '\\n')}"`);
    }
  }
  console.log(`\nGRAMMAR SCAN: ${pass} clean / ${fail} with artifacts (${reports.length} total)`);

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
