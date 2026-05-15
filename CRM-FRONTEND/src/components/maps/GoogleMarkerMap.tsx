import { useEffect, useMemo, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import { getGoogleMapsApiKey, getGoogleMapsMapId } from '@/config/googleMaps';

const GOOGLE_MAPS_SCRIPT_ID = 'crm-google-maps-script';
const MARKERCLUSTERER_SCRIPT_ID = 'crm-markerclusterer-script';

// 2026-05-14: migrated from legacy google.maps.Marker (deprecated by
// Google Feb 2024) + js-marker-clusterer to AdvancedMarkerElement +
// @googlemaps/markerclusterer. The new clusterer library natively
// supports AdvancedMarkerElement; the old js-marker-clusterer does not.
const loadMarkerClustererScript = async (): Promise<void> => {
  if ((window as unknown as Record<string, unknown>).markerClusterer) {
    return;
  }
  const existing = document.getElementById(MARKERCLUSTERER_SCRIPT_ID);
  if (existing) {
    return;
  }
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.id = MARKERCLUSTERER_SCRIPT_ID;
    script.async = true;
    script.src = 'https://unpkg.com/@googlemaps/markerclusterer/dist/index.min.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load MarkerClusterer'));
    document.head.appendChild(script);
  });
};

type GoogleMapsWindow = Window & {
  google?: {
    maps: {
      Map: new (element: HTMLElement, options: Record<string, unknown>) => GoogleMapInstance;
      InfoWindow: new (options?: Record<string, unknown>) => GoogleInfoWindowInstance;
      LatLngBounds: new () => GoogleLatLngBoundsInstance;
      marker: {
        AdvancedMarkerElement: new (options: Record<string, unknown>) => AdvancedMarkerInstance;
        PinElement: new (options: Record<string, unknown>) => PinElementInstance;
      };
      event: {
        clearInstanceListeners: (instance: unknown) => void;
      };
    };
  };
  __crmGoogleMapsPromise?: Promise<void>;
};

type GoogleMapInstance = {
  fitBounds: (bounds: GoogleLatLngBoundsInstance) => void;
  setCenter: (latLng: { lat: number; lng: number }) => void;
  setZoom: (zoom: number) => void;
};

type PinElementInstance = {
  element: HTMLElement;
};

// AdvancedMarkerElement uses property setters, not methods, for
// position/map/title — DOM-element style mutation.
type AdvancedMarkerInstance = {
  position: { lat: number; lng: number } | null;
  map: GoogleMapInstance | null;
  title: string;
  content: HTMLElement | null;
  addListener: (eventName: string, handler: () => void) => void;
};

type GoogleInfoWindowInstance = {
  close: () => void;
  setContent: (content: string) => void;
  open: (options: { anchor: AdvancedMarkerInstance; map: GoogleMapInstance }) => void;
};

type GoogleLatLngBoundsInstance = {
  extend: (latLng: { lat: number; lng: number }) => void;
};

type MarkerStore = Map<string, AdvancedMarkerInstance>;

export type GoogleMarkerMapItem = {
  id: string;
  title: string;
  lat: number;
  lng: number;
  color: string;
  infoHtml: string;
};

type GoogleMarkerMapProps = {
  items: GoogleMarkerMapItem[];
  defaultCenter?: { lat: number; lng: number };
  defaultZoom?: number;
  heightClassName?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  markerSummary?: string;
};

const loadGoogleMapsScript = async (): Promise<void> => {
  const mapsWindow = window as GoogleMapsWindow;

  if (mapsWindow.google?.maps) {
    return;
  }

  if (mapsWindow.__crmGoogleMapsPromise) {
    return mapsWindow.__crmGoogleMapsPromise;
  }

  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) {
    throw new Error('Google Maps API key not configured');
  }

  mapsWindow.__crmGoogleMapsPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.getElementById(
      GOOGLE_MAPS_SCRIPT_ID
    ) as HTMLScriptElement | null;

    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(), { once: true });
      existingScript.addEventListener(
        'error',
        () => reject(new Error('Failed to load Google Maps')),
        {
          once: true,
        }
      );
      return;
    }

    const script = document.createElement('script');
    script.id = GOOGLE_MAPS_SCRIPT_ID;
    script.async = true;
    script.defer = true;
    // loading=async is Google's documented best-practice loader pattern.
    // libraries=marker is required so the `google.maps.marker` namespace
    // (AdvancedMarkerElement, PinElement) is available — without it the
    // map renders empty and console errors on every marker construction.
    // See https://goo.gle/js-api-loading and
    // https://developers.google.com/maps/documentation/javascript/advanced-markers/migration
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&loading=async&libraries=marker`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Maps'));
    document.head.appendChild(script);
  });

  return mapsWindow.__crmGoogleMapsPromise;
};

// AdvancedMarkerElement uses HTML content via PinElement instead of
// the old SymbolPath.CIRCLE icon descriptor. PinElement renders a
// Material-style pin with a colored circular glyph; `scale: 0.8`
// matches the previous 8px circle visual weight.
const createMarkerContent = (
  mapsApi: NonNullable<GoogleMapsWindow['google']>['maps'],
  color: string
): HTMLElement =>
  new mapsApi.marker.PinElement({
    background: color,
    borderColor: '#ffffff',
    glyphColor: '#ffffff',
    scale: 0.8,
  }).element;

export function GoogleMarkerMap({
  items,
  defaultCenter = { lat: 20.5937, lng: 78.9629 },
  defaultZoom = 5,
  heightClassName = 'h-[520px]',
  emptyTitle = 'No mappable records',
  emptyDescription = 'No valid coordinates available for the current filters.',
  markerSummary,
}: GoogleMarkerMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GoogleMapInstance | null>(null);
  const infoWindowRef = useRef<GoogleInfoWindowInstance | null>(null);
  const markersRef = useRef<MarkerStore>(new Map());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clustererRef = useRef<any>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  const normalizedItems = useMemo(
    () => items.filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng)),
    [items]
  );

  useEffect(() => {
    let disposed = false;

    const initializeMap = async () => {
      if (!mapContainerRef.current || mapRef.current) {
        return;
      }

      try {
        await Promise.all([loadGoogleMapsScript(), loadMarkerClustererScript()]);
        if (disposed || !mapContainerRef.current) {
          return;
        }

        const mapsApi = (window as GoogleMapsWindow).google?.maps;
        if (!mapsApi) {
          throw new Error('Google Maps unavailable');
        }

        mapRef.current = new mapsApi.Map(mapContainerRef.current, {
          center: defaultCenter,
          zoom: defaultZoom,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          // AdvancedMarkerElement requires a Map ID (vector or styled).
          // DEMO_MAP_ID is a Google-provided default; prod should set
          // VITE_GOOGLE_MAPS_MAP_ID to a Cloud Console Map Style.
          mapId: getGoogleMapsMapId(),
        });
        infoWindowRef.current = new mapsApi.InfoWindow();
      } catch (error) {
        if (!disposed) {
          setMapError(error instanceof Error ? error.message : 'Unable to load Google Maps');
        }
      }
    };

    void initializeMap();

    return () => {
      disposed = true;
    };
  }, [defaultCenter, defaultZoom]);

  useEffect(() => {
    const mapsApi = (window as GoogleMapsWindow).google?.maps;
    const map = mapRef.current;
    if (!mapsApi || !map) {
      return;
    }

    const activeIds = new Set<string>();
    const infoWindow = infoWindowRef.current;
    // @googlemaps/markerclusterer exposes itself as a UMD global on
    // `window.markerClusterer` (lowercase). Its `MarkerClusterer` ctor
    // accepts an options object with `markers` and `map`.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const clustererLib = (window as Record<string, any>).markerClusterer;
    const useClusterer = normalizedItems.length > 50 && clustererLib;

    // Clear existing clusterer before rebuilding markers
    if (clustererRef.current) {
      clustererRef.current.clearMarkers();
      clustererRef.current = null;
    }

    normalizedItems.forEach((item) => {
      activeIds.add(item.id);
      const position = { lat: item.lat, lng: item.lng };
      const existingMarker = markersRef.current.get(item.id);

      if (existingMarker) {
        // AdvancedMarkerElement: property assignment, not setX() methods.
        existingMarker.position = position;
        existingMarker.content = createMarkerContent(mapsApi, item.color);
        existingMarker.title = item.title;
        mapsApi.event.clearInstanceListeners(existingMarker);
        existingMarker.addListener('click', () => {
          if (!infoWindowRef.current || !mapRef.current) {
            return;
          }
          infoWindowRef.current.setContent(item.infoHtml);
          infoWindowRef.current.open({ anchor: existingMarker, map: mapRef.current });
        });
        // When clustering, detach from map — clusterer manages placement.
        existingMarker.map = useClusterer ? null : map;
        return;
      }

      // Create marker WITHOUT map when clustering (clusterer will manage placement)
      const marker = new mapsApi.marker.AdvancedMarkerElement({
        map: useClusterer ? null : map,
        position,
        title: item.title,
        content: createMarkerContent(mapsApi, item.color),
      });

      marker.addListener('click', () => {
        if (!infoWindow || !mapRef.current) {
          return;
        }
        infoWindow.setContent(item.infoHtml);
        infoWindow.open({ anchor: marker, map: mapRef.current });
      });

      markersRef.current.set(item.id, marker);
    });

    // Remove stale markers
    markersRef.current.forEach((marker, itemId) => {
      if (!activeIds.has(itemId)) {
        marker.map = null;
        markersRef.current.delete(itemId);
      }
    });

    // Initialize clusterer with all active markers. The new library's
    // MarkerClusterer ctor signature: ({ map, markers, ...options }).
    if (useClusterer) {
      const allMarkers = Array.from(markersRef.current.values());
      clustererRef.current = new clustererLib.MarkerClusterer({
        map,
        markers: allMarkers,
      });
    }

    if (normalizedItems.length === 0) {
      map.setCenter(defaultCenter);
      map.setZoom(defaultZoom);
      infoWindow?.close();
      return;
    }

    const bounds = new mapsApi.LatLngBounds();
    normalizedItems.forEach((item) => {
      bounds.extend({ lat: item.lat, lng: item.lng });
    });
    map.fitBounds(bounds);
  }, [defaultCenter, defaultZoom, normalizedItems]);

  if (!getGoogleMapsApiKey()) {
    return (
      <div className="flex min-h-[520px] items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50">
        <div className="text-center">
          <MapPin className="mx-auto mb-3 h-8 w-8 text-gray-500" />
          <p className="text-sm font-medium text-gray-700">Map preview unavailable</p>
          <p className="text-xs text-gray-500">Google Maps API key not configured</p>
        </div>
      </div>
    );
  }

  if (mapError) {
    return (
      <div className="flex min-h-[520px] items-center justify-center rounded-lg border border-dashed border-red-200 bg-red-50">
        <div className="text-center">
          <MapPin className="mx-auto mb-3 h-8 w-8 text-red-500" />
          <p className="text-sm font-medium text-red-700">Failed to load map</p>
          <p className="text-xs text-red-600">{mapError}</p>
        </div>
      </div>
    );
  }

  if (normalizedItems.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex min-h-[520px] items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50">
          <div className="text-center">
            <MapPin className="mx-auto mb-3 h-8 w-8 text-gray-500" />
            <p className="text-sm font-medium text-gray-700">{emptyTitle}</p>
            <p className="text-xs text-gray-500">{emptyDescription}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-gray-200">
        <div ref={mapContainerRef} className={`${heightClassName} w-full rounded-lg`} />
      </div>
      {markerSummary ? <p className="text-xs text-gray-500">{markerSummary}</p> : null}
    </div>
  );
}
