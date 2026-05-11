/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Throwaway one-shot validator for gstResolver. Run via:
 *   PGPASSWORD=acs_password npx ts-node --transpile-only scripts/validate-gst-resolver.ts
 *
 * Exercises all 4 scenarios per ops decision (A1+B1+C2). Rolls back any
 * synthetic data. NOT a regression test — delete after the audit closes.
 */
import { Pool } from 'pg';
import { resolveInvoiceGst, GstConfigError } from '../src/services/gstResolver';
import { wrapClient } from '../src/config/database';

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    'postgresql://acs_user:acs_password@localhost:5432/acs_db',
});

const run = async () => {
  // Production controllers run resolveInvoiceGst against a wrapClient'd
  // PoolClient (camelize transform). Mirror that here.
  const rawClient = await pool.connect();
  const client = wrapClient(rawClient);
  let testsRun = 0;
  let testsPass = 0;

  const assert = (
    label: string,
    actual: unknown,
    expected: unknown,
    matcher: 'eq' | 'shape' = 'eq'
  ) => {
    testsRun++;
    let ok = false;
    if (matcher === 'eq') {
      ok = JSON.stringify(actual) === JSON.stringify(expected);
    }
    if (ok) {
      testsPass++;
      console.log(`  ✓ ${label}`);
    } else {
      console.log(
        `  ✗ ${label}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`
      );
    }
  };

  try {
    await client.query('BEGIN');

    // Seed: synthetic clients for each scenario inside the tx.
    const seed = await client.query<{ id: number }>(
      `INSERT INTO clients (code, name, gstin, gstin_state_code, billing_state_id)
       VALUES
         ('TEST-A', 'Test Client A (GSTIN intra)', '27ABCDE1234F1Z5', '27', NULL),
         ('TEST-B', 'Test Client B (GSTIN inter)', '29ABCDE1234F1Z5', '29', NULL),
         ('TEST-C', 'Test Client C (no GSTIN, state intra)', NULL, NULL, 1),
         ('TEST-D', 'Test Client D (no GSTIN, no state)', NULL, NULL, NULL)
       RETURNING id`
    );
    const [aId, bId, cId, dId] = seed.rows.map(r => r.id);

    // === Scenario A: client with gstin_state_code='27', supplier='27' → INTRA_STATE
    console.log('Scenario A: INTRA_STATE via clients.gstin_state_code (supplier=27, recipient=27)');
    const a = await resolveInvoiceGst(client, { clientId: aId, subtotalAmount: 1000 });
    assert('  supplyType=INTRA_STATE', a.supplyType, 'INTRA_STATE');
    assert('  placeOfSupply=27', a.placeOfSupply, '27');
    assert('  cgstRate=9', a.cgstRate, 9);
    assert('  sgstRate=9', a.sgstRate, 9);
    assert('  igstRate=0', a.igstRate, 0);
    assert('  cgstAmount=90', a.cgstAmount, 90);
    assert('  sgstAmount=90', a.sgstAmount, 90);
    assert('  igstAmount=0', a.igstAmount, 0);
    assert('  taxAmount=180', a.taxAmount, 180);
    assert('  totalAmount=1180', a.totalAmount, 1180);

    // === Scenario B: client with gstin_state_code='29' (Karnataka), supplier='27' → INTER_STATE
    console.log('Scenario B: INTER_STATE via clients.gstin_state_code (supplier=27, recipient=29)');
    const b = await resolveInvoiceGst(client, { clientId: bId, subtotalAmount: 1000 });
    assert('  supplyType=INTER_STATE', b.supplyType, 'INTER_STATE');
    assert('  placeOfSupply=29', b.placeOfSupply, '29');
    assert('  cgstRate=0', b.cgstRate, 0);
    assert('  sgstRate=0', b.sgstRate, 0);
    assert('  igstRate=18', b.igstRate, 18);
    assert('  cgstAmount=0', b.cgstAmount, 0);
    assert('  sgstAmount=0', b.sgstAmount, 0);
    assert('  igstAmount=180', b.igstAmount, 180);
    assert('  taxAmount=180', b.taxAmount, 180);
    assert('  totalAmount=1180', b.totalAmount, 1180);

    // === Scenario C: client with NO gstin but billing_state_id=1 (Maharashtra, gst_state_code='27')
    console.log(
      'Scenario C: INTRA_STATE via billing_state fallback (supplier=27, recipient=27 via FK)'
    );
    const c = await resolveInvoiceGst(client, { clientId: cId, subtotalAmount: 5000 });
    assert('  supplyType=INTRA_STATE', c.supplyType, 'INTRA_STATE');
    assert('  placeOfSupply=27', c.placeOfSupply, '27');
    assert('  cgstAmount=450', c.cgstAmount, 450);
    assert('  sgstAmount=450', c.sgstAmount, 450);
    assert('  taxAmount=900', c.taxAmount, 900);
    assert('  totalAmount=5900', c.totalAmount, 5900);

    // === Scenario D: client with NO gstin AND NO billing_state_id → throws
    console.log('Scenario D: FAIL LOUD when neither gstin nor billing_state set');
    let dThrew = false;
    let dCode: string | null = null;
    try {
      await resolveInvoiceGst(client, { clientId: dId, subtotalAmount: 1000 });
    } catch (e) {
      dThrew = true;
      if (e instanceof GstConfigError) dCode = e.code;
    }
    assert('  threw GstConfigError', dThrew, true);
    assert('  code=RECIPIENT_GST_STATE_MISSING', dCode, 'RECIPIENT_GST_STATE_MISSING');

    // === Scenario E: arithmetic edge — subtotal with one cent of asymmetry (intra 18% / 2)
    console.log('Scenario E: arithmetic edge — subtotal=33.33 (odd cent, intra)');
    const e = await resolveInvoiceGst(client, { clientId: aId, subtotalAmount: 33.33 });
    // 33.33 × 0.09 = 2.9997 → 3.00 each → cgst+sgst = 6.00 → tax=6.00 → total=39.33
    assert('  cgstAmount=3', e.cgstAmount, 3);
    assert('  sgstAmount=3', e.sgstAmount, 3);
    assert('  taxAmount=6', e.taxAmount, 6);
    assert('  totalAmount=39.33', e.totalAmount, 39.33);

    // === Scenario F: subtotal=0 (edge — defensive non-throw)
    console.log('Scenario F: subtotal=0 — zero tax breakdown');
    const f = await resolveInvoiceGst(client, { clientId: aId, subtotalAmount: 0 });
    assert('  taxAmount=0', f.taxAmount, 0);
    assert('  totalAmount=0', f.totalAmount, 0);

    // === Scenario G: missing supplier env (skip if env is set — covered by .env probe)
    console.log(`Scenario G: supplier env is "${process.env.SUPPLIER_GST_STATE_CODE ?? ''}"`);

    await client.query('ROLLBACK');
    console.log(`\nResults: ${testsPass}/${testsRun} checks passed.`);
    process.exit(testsPass === testsRun ? 0 : 1);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Fatal error:', err);
    process.exit(2);
  } finally {
    rawClient.release();
    await pool.end();
  }
};

run();
