import { useSyncExternalStore } from 'react';

/**
 * Tiny module-level cache for the admin's chosen logo + stamp files used
 * when generating a report PDF. Scope: current browser tab / session only.
 * Intentionally not persisted — File objects don't serialize and these are
 * branding assets the admin is actively choosing each session, not saved
 * config.
 *
 * Two consumers read this via useReportBranding():
 *   - GenerateReportModal, which pre-fills the file pickers from the cache
 *     so admins generating multiple reports in a row don't re-pick each time
 *   - DownloadReportButton, which reads the current selections and submits
 *     them alongside the caseId
 */

interface BrandingState {
  logo: File | null;
  stamp: File | null;
}

const state: BrandingState = { logo: null, stamp: null };

type Listener = () => void;
const listeners = new Set<Listener>();

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function snapshot(): BrandingState {
  return state;
}

export const reportBrandingStore = {
  setLogo(file: File | null): void {
    state.logo = file;
    emit();
  },
  setStamp(file: File | null): void {
    state.stamp = file;
    emit();
  },
  clear(): void {
    state.logo = null;
    state.stamp = null;
    emit();
  },
  getLogo(): File | null {
    return state.logo;
  },
  getStamp(): File | null {
    return state.stamp;
  },
};

export function useReportBranding(): BrandingState {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
