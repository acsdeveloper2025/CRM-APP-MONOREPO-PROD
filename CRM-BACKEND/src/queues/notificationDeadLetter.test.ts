import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import os from 'os';

// Each test uses a fresh tmp directory so concurrent test runs and repeated
// suite invocations don't fight over the DLQ file.
let tmpDir: string;

const mockConfig = vi.hoisted(() => ({
  uploadPath: '',
}));

vi.mock('@/config', () => ({ config: mockConfig }));
vi.mock('@/utils/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import type { NotificationJobData } from './notificationQueue';

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'notif-dlq-test-'));
  mockConfig.uploadPath = tmpDir;
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
  vi.resetModules();
});

// Minimal stand-in payload — the DLQ only round-trips the value through
// JSON, so the exact union member doesn't matter for these tests.
const sampleData = { notification: { id: 'n-1', userId: 'user-1' } } as unknown as NotificationJobData;
const JOB_NAME = 'process-case-assignment-notification';

describe('writeNotificationDeadLetter', () => {
  it('appends a single JSON line per job (with jobName + data + timestamp)', async () => {
    vi.resetModules();
    const mod = await import('./notificationDeadLetter');

    await mod.writeNotificationDeadLetter(JOB_NAME, sampleData);
    await mod.writeNotificationDeadLetter('process-task-revocation-notification', sampleData);

    const content = await fs.readFile(path.join(tmpDir, 'notification-dlq.jsonl'), 'utf8');
    const lines = content.trim().split('\n');
    expect(lines).toHaveLength(2);
    const first = JSON.parse(lines[0]);
    expect(first.jobName).toBe(JOB_NAME);
    expect(first.data.notification.id).toBe('n-1');
    expect(typeof first.enqueueFailedAt).toBe('string');
    const second = JSON.parse(lines[1]);
    expect(second.jobName).toBe('process-task-revocation-notification');
  });

  it('creates the parent directory if it does not exist yet', async () => {
    const nested = path.join(tmpDir, 'nested', 'deep');
    mockConfig.uploadPath = nested;
    vi.resetModules();
    const mod = await import('./notificationDeadLetter');

    await mod.writeNotificationDeadLetter(JOB_NAME, sampleData);

    expect(fsSync.existsSync(path.join(nested, 'notification-dlq.jsonl'))).toBe(true);
  });
});

describe('recoverNotificationDeadLetter', () => {
  it('reports filePresent=false when no DLQ file exists', async () => {
    vi.resetModules();
    const mod = await import('./notificationDeadLetter');

    const result = await mod.recoverNotificationDeadLetter(async () => {});
    expect(result).toEqual({
      filePresent: false,
      totalLines: 0,
      reEnqueued: 0,
      failed: 0,
      remainingPath: null,
    });
  });

  it('re-enqueues every well-formed line with its job name and deletes the consumed file', async () => {
    vi.resetModules();
    const mod = await import('./notificationDeadLetter');

    await mod.writeNotificationDeadLetter('job-a', sampleData);
    await mod.writeNotificationDeadLetter('job-b', sampleData);
    await mod.writeNotificationDeadLetter('job-c', sampleData);

    const enqueued: string[] = [];
    const result = await mod.recoverNotificationDeadLetter(async jobName => {
      enqueued.push(jobName);
    });

    expect(result.totalLines).toBe(3);
    expect(result.reEnqueued).toBe(3);
    expect(result.failed).toBe(0);
    expect(result.remainingPath).toBeNull();
    expect(enqueued).toEqual(['job-a', 'job-b', 'job-c']);
    // Original DLQ file is gone
    expect(fsSync.existsSync(path.join(tmpDir, 'notification-dlq.jsonl'))).toBe(false);
    // No leftover .replay or .failed
    const remaining = await fs.readdir(tmpDir);
    expect(remaining).toEqual([]);
  });

  it('routes lines whose re-enqueue throws to a .failed file', async () => {
    vi.resetModules();
    const mod = await import('./notificationDeadLetter');

    await mod.writeNotificationDeadLetter('ok-1', sampleData);
    await mod.writeNotificationDeadLetter('will-fail', sampleData);
    await mod.writeNotificationDeadLetter('ok-2', sampleData);

    const result = await mod.recoverNotificationDeadLetter(async jobName => {
      if (jobName === 'will-fail') {
        throw new Error('redis still down');
      }
    });

    expect(result.totalLines).toBe(3);
    expect(result.reEnqueued).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.remainingPath).not.toBeNull();
    const failedContent = await fs.readFile(result.remainingPath as string, 'utf8');
    expect(failedContent).toContain('"jobName":"will-fail"');
    expect(failedContent).not.toContain('"jobName":"ok-2"');
  });

  it('routes malformed JSON lines to the .failed file without aborting recovery', async () => {
    vi.resetModules();
    const mod = await import('./notificationDeadLetter');

    await mod.writeNotificationDeadLetter('before-junk', sampleData);
    const dlqPath = path.join(tmpDir, 'notification-dlq.jsonl');
    await fs.appendFile(dlqPath, '{this is not json\n');
    await mod.writeNotificationDeadLetter('after-junk', sampleData);

    const enqueued: string[] = [];
    const result = await mod.recoverNotificationDeadLetter(async jobName => {
      enqueued.push(jobName);
    });

    expect(result.totalLines).toBe(3);
    expect(result.reEnqueued).toBe(2);
    expect(result.failed).toBe(1);
    expect(enqueued).toEqual(['before-junk', 'after-junk']);
  });
});
