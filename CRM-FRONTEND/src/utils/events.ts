export const AUTH_LOGOUT_EVENT = 'auth:logout';

export const triggerLogout = () => {
  window.dispatchEvent(new Event(AUTH_LOGOUT_EVENT));
};
