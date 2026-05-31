/**
 * Happy-path characterization of POST /api/invoices — invoice creation
 * (createInvoiceFromDb). Exercises GST resolution (gstResolver — supplier
 * state from env + client gstin_state_code=27) + FY invoice numbering +
 * the invoice/invoice_items inserts. Uses client=1 (has gstin_state_code)
 * with manual line items. Deletes the created invoice afterward.
 *
 * Run: npm run test:integration
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '@/app';
import { authHeaderForRole } from '@/test-support/auth';
import { connectRedis, disconnectRedis } from '@/config/redis';
import { disconnectDatabase, query } from '@/config/db';

let createdInvoiceId: string | null = null;

describe('POST /api/invoices (happy path)', () => {
  let adminAuth: string;

  beforeAll(async () => {
    await connectRedis().catch(() => undefined);
    adminAuth = await authHeaderForRole('SUPER_ADMIN');
  });

  afterAll(async () => {
    if (createdInvoiceId) {
      await query('DELETE FROM invoice_items WHERE invoice_id = $1', [createdInvoiceId]).catch(() => undefined);
      await query('DELETE FROM invoices WHERE id = $1', [createdInvoiceId]).catch(() => undefined);
    }
    await disconnectRedis().catch(() => undefined);
    await disconnectDatabase();
  });

  it('creates an invoice with GST + a fiscal-year number from manual line items', async () => {
    const before = await query<{ count: string }>('SELECT COUNT(*)::text AS count FROM invoices WHERE client_id = 1');

    const res = await request(app)
      .post('/api/invoices')
      .set('Authorization', adminAuth)
      .send({
        clientId: 1,
        productId: 1,
        dueDate: '2026-12-31',
        items: [{ description: 'Residence Verification', quantity: 1, unitPrice: 110 }],
      });

    expect([200, 201]).toContain(res.status);
    expect(res.body?.success).toBe(true);

    // A new invoice row exists for client 1.
    const after = await query<{ id: string; invoice_number: string | null; total_amount: string | null }>(
      'SELECT id, invoice_number, total_amount FROM invoices WHERE client_id = 1 ORDER BY created_at DESC LIMIT 1'
    );
    const afterCount = await query<{ count: string }>('SELECT COUNT(*)::text AS count FROM invoices WHERE client_id = 1');
    expect(Number(afterCount.rows[0].count)).toBe(Number(before.rows[0].count) + 1);

    createdInvoiceId = after.rows[0].id;
    expect(after.rows[0].invoice_number).toBeTruthy(); // FY numbering assigned
  });
});
