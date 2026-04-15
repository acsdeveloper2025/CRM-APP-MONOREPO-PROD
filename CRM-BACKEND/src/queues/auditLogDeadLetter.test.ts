import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import os from 'os';

// Each test uses a fresh tmp directory so concurrent test runs and
// repeated suite invocations don't fight over the DLQ file.
let tmpDir: string;

const mockConfig = vi.hoisted(() => ({
  uploadPath: '',
}));

vi.mock('@/config', () => ({ config: mockConfig }));
vi.mock('@/config/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { writeAuditDeadLetter, recoverAuditDeadLetter } from './auditLogDeadLetter';
import type { AuditLogData } from '@/utils/auditLogger';

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'audit-dlq-test-'));
  mockConfig.uploadPath = tmpDir;
  // Force the DLQ module to recompute its path each time. The module
  // caches the path on first call, so we invalidate by re-importing
  // after every test via vi.resetModules in afterEach.
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
  vi.resetModules();
});

const sampleEvent: AuditLogData = {
  action: 'TEST_ACTION',
  entityType: 'TEST_ENTITY',
  entityId: 'abc-123',
  userId: 'user-1',
  details: { foo: 'bar' },
  ipAddress: '1.2.3.4',
  userAgent: 'vitest',
};

describe('writeAuditDeadLetter', () => {
  it('appends a single JSON line per event', async () => {
    // Re-import so it reads the fresh tmp dir
    vi.resetModules();
    const mod = await import('./auditLogDeadLetter');

    await mod.writeAuditDeadLetter(sampleEvent);
    await mod.writeAuditDeadLetter({ ...sampleEvent, action: 'SECOND' });

    const content = await fs.readFile(path.join(tmpDir, 'audit-dlq.jsonl'), 'utf8');
    const lines = content.trim().split('\n');
    expect(lines).toHaveLength(2);
    const first = JSON.parse(lines[0]);
    expect(first.action).toBe('TEST_ACTION');
    expect(first.entityId).toBe('abc-123');
    expect(typeof first.enqueueFailedAt).toBe('string');
    const second = JSON.parse(lines[1]);
    expect(second.action).toBe('SECOND');
  });

  it('creates the parent directory if it does not exist yet', async () => {
    const nested = path.join(tmpDir, 'nested', 'deep');
    mockConfig.uploadPath = nested;
    vi.resetModules();
    const mod = await import('./auditLogDeadLetter');

    await mod.writeAuditDeadLetter(sampleEvent);

    expect(fsSync.existsSync(path.join(nested, 'audit-dlq.jsonl'))).toBe(true);
  });
});

describe('recoverAuditDeadLetter', () => {
  it('reports filePresent=false when no DLQ file exists', async () => {
    vi.resetModules();
    const mod = await import('./auditLogDeadLetter');

    const result = await mod.recoverAuditDeadLetter(async () => {});
    expect(result).toEqual({
      filePresent: false,
      totalLines: 0,
      reEnqueued: 0,
      failed: 0,
      remainingPath: null,
    });
  });

  it('re-enqueues every well-formed line and deletes the consumed file', async () => {
    vi.resetModules();
    const mod = await import('./auditLogDeadLetter');

    await mod.writeAuditDeadLetter(sampleEvent);
    await mod.writeAuditDeadLetter({ ...sampleEvent, action: 'A2' });
    await mod.writeAuditDeadLetter({ ...sampleEvent, action: 'A3' });

    const enqueued: AuditLogData[] = [];
    const result = await mod.recoverAuditDeadLetter(async data => {
      enqueued.push(data);
    });

    expect(result.totalLines).toBe(3);
    expect(result.reEnqueued).toBe(3);
    expect(result.failed).toBe(0);
    expect(result.remainingPath).toBeNull();
    expect(enqueued.map(e => e.action)).toEqual(['TEST_ACTION', 'A2', 'A3']);
    // The recovered entries must be plain AuditLogData with no
    // recovery-only `enqueueFailedAt` field leaking through.
    for (const entry of enqueued) {
      expect((entry as Record<string, unknown>).enqueueFailedAt).toBeUndefined();
    }
    // Original DLQ file is gone
    expect(fsSync.existsSync(path.join(tmpDir, 'audit-dlq.jsonl'))).toBe(false);
    // No leftover .replay or .failed
    const remaining = await fs.readdir(tmpDir);
    expect(remaining).toEqual([]);
  });

  it('routes lines whose re-enqueue throws to a .failed file', async () => {
    vi.resetModules();
    const mod = await import('./auditLogDeadLetter');

    await mod.writeAuditDeadLetter(sampleEvent);
    await mod.writeAuditDeadLetter({ ...sampleEvent, action: 'WILL_FAIL' });
    await mod.writeAuditDeadLetter({ ...sampleEvent, action: 'OK' });

    const result = await mod.recoverAuditDeadLetter(async data => {
      if (data.action === 'WILL_FAIL') {
        throw new Error('downstream still down');
      }
    });

    expect(result.totalLines).toBe(3);
    expect(result.reEnqueued).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.remainingPath).not.toBeNull();
    const failedContent = await fs.readFile(result.remainingPath!, 'utf8');
    expect(failedContent).toContain('"action":"WILL_FAIL"');
    expect(failedContent).not.toContain('"action":"OK"');
  });

  it('routes malformed JSON lines to the .failed file without aborting recovery', async () => {
    vi.resetModules();
    const mod = await import('./auditLogDeadLetter');

    await mod.writeAuditDeadLetter(sampleEvent);
    // Append a junk line directly
    const dlqPath = path.join(tmpDir, 'audit-dlq.jsonl');
    await fs.appendFile(dlqPath, '{this is not json\n');
    await mod.writeAuditDeadLetter({ ...sampleEvent, action: 'AFTER_JUNK' });

    const enqueued: AuditLogData[] = [];
    const result = await mod.recoverAuditDeadLetter(async data => {
      enqueued.push(data);
    });

    expect(result.totalLines).toBe(3);
    expect(result.reEnqueued).toBe(2);
    expect(result.failed).toBe(1);
    expect(enqueued.map(e => e.action)).toEqual(['TEST_ACTION', 'AFTER_JUNK']);
  });
});
