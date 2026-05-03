// 2026-05-03 KILL-SWITCH SERVICE WORKER
//
// The previous CRM service worker (crm-web-v1) was caching JS bundles,
// causing users to run stale code even after deploys. We don't currently
// need offline support on the web app — mobile handles that. This script
// unregisters the SW and clears all caches the moment it's loaded by any
// browser that still has the old SW registered.
//
// Once every active client has run this kill switch, the SW will be gone
// and this file can be deleted from /public.

self.addEventListener('install', () => {
  // Take over immediately — don't wait for old SW to release control.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Delete every cache this SW (or any prior version) created.
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));

      // Take control of all open tabs immediately so the next navigation
      // bypasses the old SW for sure.
      await self.clients.claim();

      // Unregister this SW so future requests go straight to the network.
      await self.registration.unregister();

      // Force-reload every controlled client so they pick up the fresh
      // (unintercepted) network responses on the very next request.
      const clientsList = await self.clients.matchAll({ type: 'window' });
      for (const client of clientsList) {
        client.navigate(client.url);
      }
    })()
  );
});

// Pass-through fetch — never serve from cache. (Belt-and-suspenders;
// the activate handler should have unregistered us before any fetch
// fires, but if a fetch sneaks through during the unregister window,
// fall straight to the network.)
self.addEventListener('fetch', () => {
  // No-op — let the browser handle it as if no SW existed.
});
