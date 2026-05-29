/**
 * Characterization of notificationController read surface — GET
 * /api/notifications (user-scoped list: data[] + pagination + unreadCount),
 * /preferences (own prefs), /analytics (settings.manage gated). Safety net
 * ahead of decomposing the 1603-LOC notificationController (§7).
 *
 * Run: npm run test:integration
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '@/app';
import { authHeaderForRole } from '@/test-support/auth';
import { connectRedis, disconnectRedis } from '@/config/redis';
import { disconnectDatabase } from '@/config/db';

describe('notificationController read endpoints', () => {
  let adminAuth: string;

  beforeAll(async () => {
    await connectRedis().catch(() => undefined);
    adminAuth = await authHeaderForRole('SUPER_ADMIN');
  });

  afterAll(async () => {
    await disconnectRedis().catch(() => undefined);
    await disconnectDatabase();
  });

  it('GET /api/notifications returns the user-scoped list with unreadCount', async () => {
    const res = await request(app).get('/api/notifications').set('Authorization', adminAuth);
    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(typeof res.body.pagination.total).toBe('number');
    expect(typeof res.body.unreadCount).toBe('number');
  });

  it('honours the limit query param', async () => {
    const res = await request(app)
      .get('/api/notifications?limit=5')
      .set('Authorization', adminAuth);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeLessThanOrEqual(5);
  });

  it('GET /api/notifications/preferences returns the user prefs', async () => {
    const res = await request(app)
      .get('/api/notifications/preferences')
      .set('Authorization', adminAuth);
    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
  });

  it('enforces settings.manage on /analytics (FIELD_AGENT 403)', async () => {
    const forbidden = await request(app)
      .get('/api/notifications/analytics')
      .set('Authorization', await authHeaderForRole('FIELD_AGENT'));
    expect(forbidden.status).toBe(403);
  });

  it('rejects an unauthenticated request', async () => {
    const res = await request(app).get('/api/notifications');
    expect(res.status).toBe(401);
  });
});
