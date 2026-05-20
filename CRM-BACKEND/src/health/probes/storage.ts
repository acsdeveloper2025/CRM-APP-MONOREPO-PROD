import fs from 'fs/promises';
import path from 'path';
import { config } from '@/config';
import { storage } from '@/services/storage';
import { THRESHOLDS } from '@/health/thresholds';
import { withTimeout } from '@/health/withTimeout';
import type { ServiceHealth } from '@/health/types';

async function probeLocal(): Promise<ServiceHealth> {
  const root = path.resolve(config.uploadPath);
  try {
    await fs.access(root, fs.constants.W_OK);
    const stats = await fs.statfs(root);
    const freePct = Math.round((Number(stats.bfree) / Number(stats.blocks)) * 100);
    const status =
      freePct <= THRESHOLDS.storage.free_pct_unhealthy
        ? 'unhealthy'
        : freePct <= THRESHOLDS.storage.free_pct_degraded
          ? 'degraded'
          : 'healthy';
    return {
      status,
      details: { backend: 'local', free_pct: freePct, upload_path: root },
    };
  } catch (err) {
    return {
      status: 'unhealthy',
      message: err instanceof Error ? err.message : 'local storage probe failed',
      details: { backend: 'local', upload_path: root },
    };
  }
}

async function probeS3(): Promise<ServiceHealth> {
  try {
    await storage.exists(THRESHOLDS.storage.probe_key);
    return { status: 'healthy', details: { backend: 's3' } };
  } catch (err) {
    return {
      status: 'unhealthy',
      message: err instanceof Error ? err.message : 's3 storage probe failed',
      details: { backend: 's3' },
    };
  }
}

export async function probeStorage(): Promise<ServiceHealth> {
  const backend = config.storage.backend;
  try {
    return await withTimeout('storage', THRESHOLDS.storage.probe_timeout_ms, () =>
      backend === 's3' ? probeS3() : probeLocal()
    );
  } catch (err) {
    return {
      status: 'unhealthy',
      message: err instanceof Error ? err.message : 'storage probe failed',
      details: { backend },
    };
  }
}
