export const AUTH_LOGOUT_EVENT = 'auth:logout';

export const triggerLogout = (message?: string) => {
  window.dispatchEvent(new CustomEvent(AUTH_LOGOUT_EVENT, { detail: { message } }));
};
