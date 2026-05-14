export const AUTH_LOGOUT_EVENT = 'auth:logout';

export const triggerLogout = (message?: string) => {
  window.dispatchEvent(new CustomEvent(AUTH_LOGOUT_EVENT, { detail: { message } }));
};

/**
 * Fired by the axios response interceptor when the backend rejects a
 * request with INVALID_ACTIVE_SCOPE_CLIENT or INVALID_ACTIVE_SCOPE_PRODUCT
 * (project_scope_control_audit_2026_05_14.md P8). The ActiveScopeProvider
 * listens and resets the persisted scope, toasting the user.
 */
export const ACTIVE_SCOPE_INVALID_EVENT = 'acs:active-scope-invalid';

export interface ActiveScopeInvalidDetail {
  code: 'INVALID_ACTIVE_SCOPE_CLIENT' | 'INVALID_ACTIVE_SCOPE_PRODUCT';
}

export const triggerActiveScopeInvalid = (detail: ActiveScopeInvalidDetail) => {
  window.dispatchEvent(new CustomEvent(ACTIVE_SCOPE_INVALID_EVENT, { detail }));
};
