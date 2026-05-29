import { describe, it, expect } from 'vitest';
import {
  AUTH_LOGOUT_EVENT,
  ACTIVE_SCOPE_INVALID_EVENT,
  triggerLogout,
  triggerActiveScopeInvalid,
} from './events';

const captureDetail = (eventName: string, fire: () => void): unknown => {
  let detail: unknown;
  const handler = (e: Event) => {
    detail = (e as CustomEvent).detail;
  };
  window.addEventListener(eventName, handler);
  try {
    fire();
  } finally {
    window.removeEventListener(eventName, handler);
  }
  return detail;
};

describe('event constants', () => {
  it('use the documented event names', () => {
    expect(AUTH_LOGOUT_EVENT).toBe('auth:logout');
    expect(ACTIVE_SCOPE_INVALID_EVENT).toBe('acs:active-scope-invalid');
  });
});

describe('triggerLogout', () => {
  it('dispatches the logout event carrying the message', () => {
    const detail = captureDetail(AUTH_LOGOUT_EVENT, () => triggerLogout('bye')) as {
      message?: string;
    };
    expect(detail).toEqual({ message: 'bye' });
  });

  it('dispatches with undefined message when none is given', () => {
    const detail = captureDetail(AUTH_LOGOUT_EVENT, () => triggerLogout()) as { message?: string };
    expect(detail.message).toBeUndefined();
  });
});

describe('triggerActiveScopeInvalid', () => {
  it('dispatches the scope-invalid event with the code', () => {
    const detail = captureDetail(ACTIVE_SCOPE_INVALID_EVENT, () =>
      triggerActiveScopeInvalid({ code: 'INVALID_ACTIVE_SCOPE_CLIENT' })
    );
    expect(detail).toEqual({ code: 'INVALID_ACTIVE_SCOPE_CLIENT' });
  });
});
