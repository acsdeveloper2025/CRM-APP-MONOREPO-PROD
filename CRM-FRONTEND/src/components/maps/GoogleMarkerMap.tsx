import { useEffect, useMemo, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';

const GOOGLE_MAPS_SCRIPT_ID = 'crm-google-maps-script';
const MARKERCLUSTERER_SCRIPT_ID = 'crm-markerclusterer-script';
const getGoogleMapsApiKey = (): string => import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() || '';

// Marker clustering for 200+ markers at enterprise scale
const loadMarkerClustererScript = async (): Promise<void> => {
  if ((window as Record<string, unknown>).MarkerClusterer) {
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
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/js-marker-clusterer/1.0.0/markerclusterer_compiled.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load MarkerClusterer'));
    document.head.appendChild(script);
  });
};

type GoogleMapsWindow = Window & {
  google?: {
    maps: {
      Map: new (element: HTMLElement, options: Record<string, unknown>) => GoogleMapInstance;
      Marker: new (options: Record<string, unknown>) => GoogleMarkerInstance;
      InfoWindow: new (options?: Record<string, unknown>) => GoogleInfoWindowInstance;
      LatLngBounds: new () => GoogleLatLngBoundsInstance;
      SymbolPath: { CIRCLE: unknown };
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

type GoogleMarkerInstance = {
  setPosition: (latLng: { lat: number; lng: number }) => void;
  setIcon: (icon: Record<string, unknown>) => void;
  setTitle: (title: string) => void;
  setMap: (map: GoogleMapInstance | null) => void;
  addListener: (eventName: string, handler: () => void) => void;
};

type GoogleInfoWindowInstance = {
  close: () => void;
  setContent: (content: string) => void;
  open: (options: { anchor: GoogleMarkerInstance; map: GoogleMapInstance }) => void;
};

type GoogleLatLngBoundsInstance = {
  extend: (latLng: { lat: number; lng: number }) => void;
};

type MarkerStore = Map<string, GoogleMarkerInstance>;

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
    const existingScript = document.getElementById(GOOGLE_MAPS_SCRIPT_ID) as HTMLScriptElement | null;

    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(), { once: true });
      existingScript.addEventListener('error', () => reject(new Error('Failed to load Google Maps')), {
        once: true,
      });
      return;
    }

    const script = document.createElement('script');
    script.id = GOOGLE_MAPS_SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Maps'));
    document.head.appendChild(script);
  });

  return mapsWindow.__crmGoogleMapsPromise;
};

const getMarkerIcon = (
  mapsApi: NonNullable<GoogleMapsWindow['google']>['maps'],
  color: string
) => ({
  path: mapsApi.SymbolPath.CIRCLE,
  fillColor: color,
  fillOpacity: 0.95,
  strokeColor: '#ffffff',
  strokeWeight: 2,
  scale: 8,
});

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const MarkerClusterer = (window as Record<string, any>).MarkerClusterer;
    const useClusterer = normalizedItems.length > 50 && MarkerClusterer;

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
        existingMarker.setPosition(position);
        existingMarker.setIcon(getMarkerIcon(mapsApi, item.color));
        existingMarker.setTitle(item.title);
        mapsApi.event.clearInstanceListeners(existingMarker);
        existingMarker.addListener('click', () => {
          if (!infoWindowRef.current || !mapRef.current) {
            return;
          }
          infoWindowRef.current.setContent(item.infoHtml);
          infoWindowRef.current.open({ anchor: existingMarker, map: mapRef.current });
        });
        // When clustering, remove direct map attachment — clusterer manages it
        if (useClusterer) {
          existingMarker.setMap(null);
        } else {
          existingMarker.setMap(map);
        }
        return;
      }

      // Create marker WITHOUT map when clustering (clusterer will manage placement)
      const marker = new mapsApi.Marker({
        map: useClusterer ? undefined : map,
        position,
        title: item.title,
        icon: getMarkerIcon(mapsApi, item.color),
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
        marker.setMap(null);
        markersRef.current.delete(itemId);
      }
    });

    // Initialize clusterer with all active markers
    if (useClusterer) {
      const allMarkers = Array.from(markersRef.current.values());
      clustererRef.current = new MarkerClusterer(map, allMarkers, {
        maxZoom: 15,
        gridSize: 60,
        minimumClusterSize: 3,
        styles: [
          { textColor: '#fff', url: '', height: 40, width: 40, textSize: 12 },
        ],
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
