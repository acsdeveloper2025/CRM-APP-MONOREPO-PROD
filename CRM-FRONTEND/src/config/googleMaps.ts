// Single source of truth for the Google Maps API key on the web
// client.
//
// M8 (fresh medium audit): the helper `getGoogleMapsApiKey()` was
// duplicated verbatim in GoogleMarkerMap.tsx and FormLocationViewer
// .tsx. Every additional component that needed the key either
// imported from one of those (arbitrary) locations or copy-pasted
// the helper again. Consolidating here means:
//
//   1. One grep target when the key is rotated.
//   2. One place to add a redirect-through-backend shim later.
//   3. A single point to add the "key missing" warning so every
//      consumer behaves the same way on a misconfigured build.
//
// Note on exposure: Vite inlines VITE_* environment variables into
// the production bundle. Any visitor to the site can extract the
// key. The only defense is an HTTP-Referrer restriction configured
// in the Google Cloud console — verify it lists crm.allcheckservices.com
// and any other approved hosts before assuming this is safe.
//
// TODO(M8): proxy Maps tile + geocoding traffic through a backend
// endpoint that signs a short-lived session token, so the key
// never lands in the browser bundle. That is the permanent fix;
// this module only centralizes the current state.

/**
 * Return the Google Maps API key from the Vite build-time env.
 * Returns an empty string if the env var is missing so callers can
 * branch on `!apiKey` to render a fallback UI instead of a broken
 * map with a console error.
 */
export const getGoogleMapsApiKey = (): string =>
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() || '';

/**
 * Return the Map ID used to enable AdvancedMarkerElement.
 *
 * AdvancedMarkerElement (the replacement for the deprecated
 * google.maps.Marker) requires the map to be associated with a Map ID
 * — even an unstyled one. Without it, the marker library throws a
 * runtime error and the map renders empty.
 *
 * Prefer setting `VITE_GOOGLE_MAPS_MAP_ID` to a Map ID configured in
 * Google Cloud Console (Maps Platform → Map Styles). For dev/local
 * builds with no env var, fall back to Google's well-known
 * `DEMO_MAP_ID` — works out of the box but logs a console hint that
 * prod should provision its own ID.
 */
export const getGoogleMapsMapId = (): string =>
  import.meta.env.VITE_GOOGLE_MAPS_MAP_ID?.trim() || 'DEMO_MAP_ID';
