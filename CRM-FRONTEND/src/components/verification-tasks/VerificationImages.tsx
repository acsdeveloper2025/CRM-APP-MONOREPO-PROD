import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LoadingSpinner } from '@/components/ui/loading';
import {
  useVerificationImages,
  useVerificationImagesBySubmission,
} from '@/hooks/useVerificationImages';
import { verificationImagesService, type VerificationImage } from '@/services/verificationImages';
import { Camera, MapPin, Download, Eye, Image as ImageIcon, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
// 2026-05-05 (bug 60): swapped from `html2canvas` (v1.4.1) to
// `html2canvas-pro` — the original lib chokes on Tailwind v4's
// `oklch()` color tokens with `Error: Attempting to parse an
// unsupported color function "oklch"`. The pro fork is API-compatible
// + adds support for oklch / oklab / lab / color-mix and other
// modern CSS color funcs. No call-site changes needed.
import html2canvas from 'html2canvas-pro';
import { logger } from '@/utils/logger';
import { apiService, authenticatedFetch } from '@/services/api';

// -----------------------------------------------------------------------
// Attachment-anchored address lookup (revised 2026-04-21, integrity fix)
//
// For verification evidence we MUST show the same address every time —
// Google's geocoding data can change (roads rename, buildings re-tag),
// but the address recorded on a verified attachment must stay frozen.
//
// The backend endpoint GET /api/attachments/:id/address implements a
// write-through cache: first view does the Google lookup and persists
// `reverse_geocoded_address` on the attachment row; every subsequent
// call returns the stored string and never touches Google again. This
// module-level Map is a session-scoped optimisation on top of that so
// rendering a page of 20 photos doesn't hammer the backend either.
// -----------------------------------------------------------------------

type AddressCacheEntry = { address: string | null; pending?: Promise<string | null> };
const attachmentAddressCache = new Map<number, AddressCacheEntry>();

async function fetchAttachmentAddress(rawAttachmentId: number | string): Promise<string | null> {
  // Bug 58 follow-up (2026-05-05): coerce string IDs to number so cache
  // keys are consistent (Map<number, _> would otherwise hold separate
  // entries for "31" vs 31). The handleDownloadWithMetadata caller
  // passes image.id which arrives as a string from the pg bigint
  // serialization on verification_attachments.id.
  const attachmentId =
    typeof rawAttachmentId === 'number' ? rawAttachmentId : Number(rawAttachmentId);
  if (!Number.isFinite(attachmentId)) {
    return null;
  }
  const existing = attachmentAddressCache.get(attachmentId);
  if (existing?.address !== undefined) {
    return existing.address;
  }
  if (existing?.pending) {
    return existing.pending;
  }

  const promise = apiService
    .get<{ address?: string; cached?: boolean }>(`/attachments/${attachmentId}/address`)
    .then((response) => {
      // Bug 54 (2026-05-05): apiService.get unwraps to ApiResponse<T> =
      // { success, data: T, ... }. The actual address payload lives at
      // response.data.address, NOT response.address. The earlier read of
      // `data?.address` returned undefined every time → cache locked at
      // null → all photos rendered "lat, lng" fallback in case-detail.
      const inner = response?.data as { address?: string } | undefined;
      const address = typeof inner?.address === 'string' ? inner.address : null;
      attachmentAddressCache.set(attachmentId, { address });
      return address;
    })
    .catch((err) => {
      logger.warn('Attachment address fetch failed', err);
      // Negative-cache so we don't retry on every render; cache clears
      // on a full reload which gives admins an easy "refresh" path for
      // the rare upstream-unavailable case.
      attachmentAddressCache.set(attachmentId, { address: null });
      return null;
    });

  attachmentAddressCache.set(attachmentId, {
    address: undefined as unknown as string | null,
    pending: promise,
  });
  return promise;
}

function useAttachmentAddress(attachmentId: number | string | null | undefined): {
  address: string | null;
  loading: boolean;
} {
  const [address, setAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    // Bug 58 (2026-05-05): pg library serializes bigint columns
    // (verification_attachments.id) as STRINGS, not numbers — the
    // backend response.photos[].id arrives as e.g. "31" not 31. The
    // earlier `typeof !== 'number'` short-circuited every render →
    // AddressLine hit the lat/lng fallback for every photo and the
    // backend reverse-geocode never even got called. Coerce to number
    // and validate; accept both string and number from the API.
    const numericId =
      typeof attachmentId === 'number'
        ? attachmentId
        : typeof attachmentId === 'string' && /^\d+$/.test(attachmentId)
          ? Number(attachmentId)
          : NaN;

    if (!Number.isFinite(numericId)) {
      setAddress(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    fetchAttachmentAddress(numericId).then((resolved) => {
      if (!cancelled) {
        setAddress(resolved);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [attachmentId]);

  return { address, loading };
}

// 2026-05-05 (bug 61): derive a "City, State, Country" header from a
// Google formatted_address. Splits on commas, strips pure-digit chunks
// (PIN/ZIP codes), and returns the last 3 non-numeric tokens. Returns
// the full input back if parsing fails — never null. Examples:
//   "Cross Road, ..., Mumbai, Konkan Division, Maharashtra, 400604, India"
//     → "Konkan Division, Maharashtra, India"
//   "..., Madanpura, Mumbai, Maharashtra 400008, India"
//     → "Mumbai, Maharashtra 400008, India"
const deriveCityStateCountry = (address: string | null | undefined): string => {
  if (!address) {
    return '';
  }
  // Skip Indian admin-region tokens that aren't useful in a 3-line
  // header (Google often inserts "Konkan Division", "Mumbai District",
  // etc. between the city and state). Keeps the result close to the
  // sample image format "City, State, Country".
  const SKIP_TOKENS = /\b(division|district|tehsil|taluk|taluka)\b/i;
  const parts = address
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && !/^\d+$/.test(p) && !SKIP_TOKENS.test(p));
  if (parts.length <= 3) {
    return parts.join(', ');
  }
  return parts.slice(-3).join(', ');
};

// 2026-05-05 (bug 61 follow-up): Static map can't be rendered with a
// plain <img src="/api/geocode/static-map?..."> because the FE bearer
// token lives in memory (Phase E5 hardening) and the browser only
// auto-sends cookies — the request goes out without Authorization → 401.
// Fetch via authenticatedFetch (which injects bearer), turn the response
// into a blob URL, render that. Cache per (lat,lng,size) so repeated
// renders + html2canvas snapshots reuse the same blob.
const staticMapBlobCache = new Map<string, string>();

const StaticMapImage: React.FC<{
  latitude: number;
  longitude: number;
  size?: string;
  zoom?: number;
  className?: string;
}> = ({ latitude, longitude, size = '130x130', zoom = 16, className }) => {
  const [blobUrl, setBlobUrl] = useState<string>('');
  const [failed, setFailed] = useState<boolean>(false);
  const cacheKey = `${latitude},${longitude},${size},${zoom}`;
  useEffect(() => {
    let cancelled = false;
    const cached = staticMapBlobCache.get(cacheKey);
    if (cached) {
      setBlobUrl(cached);
      return;
    }
    const fetchMap = async () => {
      try {
        const url = `/geocode/static-map?latitude=${latitude}&longitude=${longitude}&size=${encodeURIComponent(
          size
        )}&zoom=${zoom}`;
        const response = await authenticatedFetch(url);
        if (!response.ok) {
          throw new Error(`map ${response.status}`);
        }
        const blob = await response.blob();
        const url2 = window.URL.createObjectURL(blob);
        staticMapBlobCache.set(cacheKey, url2);
        if (!cancelled) {
          setBlobUrl(url2);
        }
      } catch (e) {
        logger.warn('Static map fetch failed', e);
        if (!cancelled) {
          setFailed(true);
        }
      }
    };
    void fetchMap();
    return () => {
      cancelled = true;
    };
  }, [cacheKey, latitude, longitude, size, zoom]);
  if (failed) {
    // Backend's Google Static Maps API returns 403 until "Maps Static
    // API" is enabled on the project. Show a small inline pin icon +
    // coordinates as a graceful placeholder so the rest of the strip
    // still snapshots cleanly.
    return (
      <div
        className={`${className || ''} bg-muted flex flex-col items-center justify-center text-[8px] text-muted-foreground text-center p-1`}
      >
        <MapPin className="h-4 w-4 mb-0.5" />
        <span>Map unavailable</span>
      </div>
    );
  }
  if (!blobUrl) {
    return <div className={`${className || ''} bg-card/5 animate-pulse`} />;
  }
  return (
    <img
      src={blobUrl}
      alt="Location map"
      crossOrigin="anonymous"
      loading="lazy"
      decoding="async"
      className={className}
    />
  );
};

// City/State/Country header component (used in the redesigned download
// composite). Reads the same fetch-cached attachment address and pulls
// out the last 3 non-numeric segments — matches the sample image shown
// in the user's screenshot. Falls back gracefully to "Location" while
// the address is still resolving.
const CityStateCountryLine: React.FC<{
  attachmentId: number | string | null | undefined;
}> = ({ attachmentId }) => {
  const { address, loading } = useAttachmentAddress(attachmentId);
  if (loading && !address) {
    return <span>Resolving location…</span>;
  }
  const headline = deriveCityStateCountry(address);
  return <span>{headline || 'Location'}</span>;
};

// Full address line — single span so the parent <p> with
// data-address-line gets overwritten cleanly by handleDownloadWithMetadata's
// pre-snapshot DOM injection.
const AddressFullLine: React.FC<{
  attachmentId: number | string | null | undefined;
  latitude: number | null | undefined;
  longitude: number | null | undefined;
  fallback?: string | null;
}> = ({ attachmentId, latitude, longitude, fallback }) => {
  const { address, loading } = useAttachmentAddress(attachmentId);
  const display =
    address ||
    fallback ||
    (typeof latitude === 'number' && typeof longitude === 'number'
      ? `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
      : 'Address unavailable');
  return <span>{loading && !address ? 'Resolving address…' : display}</span>;
};

// Convert a signed decimal degree to DMS string. Mirrors the mobile
// watermark layout (WatermarkPreviewScreen.formatDMS) so the on-photo
// baked watermark and the web overlay use the same notation.
const formatDMS = (decimal: number, isLat: boolean): string => {
  const abs = Math.abs(decimal);
  const deg = Math.floor(abs);
  const minFloat = (abs - deg) * 60;
  const min = Math.floor(minFloat);
  const sec = ((minFloat - min) * 60).toFixed(1);
  const dir = isLat ? (decimal >= 0 ? 'N' : 'S') : decimal >= 0 ? 'E' : 'W';
  return `${deg}°${min}'${sec}"${dir}`;
};

const formatCompass = (heading: number | null | undefined): string | null => {
  if (heading == null || !Number.isFinite(heading)) {
    return null;
  }
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const idx = Math.round(heading / 45) % 8;
  return `${dirs[idx]} ${Math.round(heading)}°`;
};

// Unified metadata overlay used by both verification grid card, selfie
// grid card, and the dialog popup. Layered on top of the photo at the
// bottom; html2canvas snapshots include this strip so the downloaded
// PNG matches what's on screen.
interface OverlayLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  speed?: number;
  heading?: number;
  timestamp?: string;
  address?: string;
}

const MetadataOverlay: React.FC<{
  attachmentId: number | string;
  location: OverlayLocation | null;
  uploadedAt: string;
  submissionAddress?: string | null;
  compact?: boolean;
  mapSize?: '88x88' | '110x110' | '140x140';
}> = ({
  attachmentId,
  location,
  uploadedAt,
  submissionAddress,
  compact = true,
  mapSize = '88x88',
}) => {
  const headerCls = compact ? 'text-[13px]' : 'text-base';
  const bodyCls = compact ? 'text-[10px]' : 'text-xs';
  const monoCls = compact ? 'text-[10px]' : 'text-xs';
  const mapBox =
    mapSize === '140x140'
      ? 'w-[140px] h-[140px]'
      : mapSize === '110x110'
        ? 'w-[110px] h-[110px]'
        : 'w-[88px] h-[88px]';
  const compass = formatCompass(location?.heading);
  const tsSource = location?.timestamp || uploadedAt;
  return (
    // 2026-05-31: metadata renders as a panel BELOW the photo (normal flow),
    // not an absolute overlay on top of it. This guarantees the photo is never
    // obscured and the metadata is never clipped — on any aspect ratio. The
    // black background + layout are unchanged so the downloaded composite
    // (html2canvas of the whole card) still reads as photo-over-metadata.
    <div className="px-2.5 py-2 bg-black text-white">
      <div className="flex gap-2 items-stretch">
        <div className="flex-1 min-w-0 space-y-0.5">
          <p className={`${headerCls} font-bold leading-tight uppercase`}>
            <CityStateCountryLine attachmentId={attachmentId} />
          </p>
          <p
            className={`${bodyCls} leading-snug text-white/90 line-clamp-2`}
            data-address-line="true"
          >
            <AddressFullLine
              attachmentId={attachmentId}
              latitude={location?.latitude}
              longitude={location?.longitude}
              fallback={location?.address || submissionAddress || null}
            />
          </p>
          {location && (
            <>
              <p className={`${monoCls} font-mono leading-tight`}>
                {formatDMS(location.latitude, true)}&nbsp;&nbsp;
                {formatDMS(location.longitude, false)}
              </p>
              <p className={`${monoCls} font-mono leading-tight`}>
                Lat {location.latitude.toFixed(6)} / Long {location.longitude.toFixed(6)}
              </p>
              <p className={`${monoCls} font-mono leading-tight flex flex-wrap gap-x-2 gap-y-0`}>
                {location.accuracy != null && <span>±{Math.round(location.accuracy)}m</span>}
                {location.altitude != null && <span>⛰ {Math.round(location.altitude)}m</span>}
                {location.speed != null && location.speed > 0 && (
                  <span>↻ {location.speed.toFixed(1)} m/s</span>
                )}
                {compass && <span>↑ {compass}</span>}
              </p>
            </>
          )}
          <p className={`${bodyCls} leading-tight`}>
            {tsSource ? format(new Date(tsSource), 'EEE d MMM yyyy, HH:mm:ss') : '—'}
          </p>
          <p
            className="text-[9px] leading-tight tracking-wider uppercase text-white/65"
            data-download-exclude="false"
          >
            CRM Verification · Geo-Tagged Evidence
          </p>
        </div>
        {location &&
          typeof location.latitude === 'number' &&
          typeof location.longitude === 'number' && (
            <div
              className="shrink-0 flex items-center cursor-pointer hover:opacity-90 transition-opacity"
              role="button"
              tabIndex={0}
              title="Open in Google Maps"
              onClick={(e) => {
                e.stopPropagation();
                window.open(
                  `https://www.google.com/maps?q=${location.latitude},${location.longitude}`,
                  '_blank',
                  'noopener,noreferrer'
                );
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  window.open(
                    `https://www.google.com/maps?q=${location.latitude},${location.longitude}`,
                    '_blank',
                    'noopener,noreferrer'
                  );
                }
              }}
            >
              <StaticMapImage
                latitude={location.latitude}
                longitude={location.longitude}
                size={mapSize}
                zoom={16}
                className={`${mapBox} object-cover rounded border border-white/30`}
              />
            </div>
          )}
      </div>
    </div>
  );
};

// Custom hook to handle async image URL loading
const useImageUrl = (imageUrl: string, imageId?: number) => {
  const [url, setUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadImageUrl = async () => {
      try {
        setLoading(true);
        const displayUrl = await verificationImagesService.getImageDisplayUrl(imageUrl, imageId);
        setUrl(displayUrl);
      } catch (error) {
        logger.error('Error loading image URL:', error);
        setUrl(''); // Fallback to empty string
      } finally {
        setLoading(false);
      }
    };

    loadImageUrl();
  }, [imageUrl, imageId]);

  return { url, loading };
};

// Custom hook to handle async thumbnail URL loading
const useThumbnailUrl = (thumbnailUrl: string, imageId?: number) => {
  const [url, setUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadThumbnailUrl = async () => {
      try {
        setLoading(true);
        const displayUrl = await verificationImagesService.getThumbnailDisplayUrl(
          thumbnailUrl,
          imageId
        );
        setUrl(displayUrl);
      } catch (error) {
        logger.error('Error loading thumbnail URL:', error);
        setUrl(''); // Fallback to empty string
      } finally {
        setLoading(false);
      }
    };

    loadThumbnailUrl();
  }, [thumbnailUrl, imageId]);

  return { url, loading };
};

// Component to handle async image loading with fallback
interface AsyncImageProps {
  imageUrl: string;
  imageId?: number;
  thumbnailUrl?: string;
  alt: string;
  className?: string;
  onClick?: () => void;
  // 2026-05-31: report the image's intrinsic aspect ratio (w/h) once it
  // loads, so the parent card can size itself to match. Without this the
  // card forces a portrait aspect and landscape photos get letterboxed
  // (and the bottom metadata overlay floats over the black bar).
  onAspectRatio?: (ratio: number) => void;
}

const AsyncImage: React.FC<AsyncImageProps> = ({
  imageUrl,
  imageId,
  thumbnailUrl,
  alt,
  className,
  onClick,
  onAspectRatio,
}) => {
  const { url: displayUrl, loading: imageLoading } = useImageUrl(imageUrl, imageId);
  const { url: thumbUrl, loading: thumbLoading } = useThumbnailUrl(thumbnailUrl || '', imageId);

  const finalUrl = thumbnailUrl ? thumbUrl : displayUrl;
  const isLoading = thumbnailUrl ? thumbLoading : imageLoading;

  const handleLoad = onAspectRatio
    ? (e: React.SyntheticEvent<HTMLImageElement>) => {
        const { naturalWidth, naturalHeight } = e.currentTarget;
        if (naturalWidth > 0 && naturalHeight > 0) {
          onAspectRatio(naturalWidth / naturalHeight);
        }
      }
    : undefined;

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center ${className || 'w-full h-full'}`}>
        <LoadingSpinner size="sm" />
      </div>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={alt}
        className={`p-0 border-0 bg-transparent cursor-pointer ${className || ''}`}
      >
        <img
          src={finalUrl}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={handleLoad}
          className={className}
        />
      </button>
    );
  }

  return (
    <img
      src={finalUrl}
      alt={alt}
      loading="lazy"
      decoding="async"
      onLoad={handleLoad}
      className={className}
    />
  );
};

interface VerificationImagesProps {
  caseId: string;
  submissionId?: string;
  title?: string;
  showStats?: boolean;
  submissionAddress?: string;
  customerName?: string;
}

interface ImageViewerProps {
  // 2026-05-05 (bug 65): popup must mirror the card composite layout —
  // photo + overlaid metadata strip with City header, address, lat/long,
  // datetime, and map thumbnail. Pass the whole image so geoLocation is
  // available for the strip.
  image?: VerificationImage | null;
  submissionAddress?: string | null;
  imageUrl: string;
  imageId?: number;
  imageName: string;
  isOpen: boolean;
  onClose: () => void;
}

const ImageViewer: React.FC<ImageViewerProps> = ({
  image,
  submissionAddress,
  imageUrl,
  imageId,
  imageName,
  isOpen,
  onClose,
}) => {
  const { url: displayUrl, loading } = useImageUrl(imageUrl, imageId);
  const rawGeo = image?.geoLocation;
  const location =
    rawGeo && typeof rawGeo === 'object' && typeof rawGeo.latitude === 'number' ? rawGeo : null;

  const handlePopupDownload = async () => {
    if (!image) {
      return;
    }
    try {
      const resolvedAddress = await fetchAttachmentAddress(image.id);
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
      const cardEl = document.querySelector<HTMLElement>(
        `[data-popup-download-card="${image.id}"]`
      );
      if (!cardEl) {
        throw new Error('Unable to locate popup card for download');
      }
      if (resolvedAddress) {
        const addressNode = cardEl.querySelector<HTMLElement>('[data-address-line="true"]');
        if (addressNode) {
          addressNode.textContent = resolvedAddress;
        }
      }
      const snapshot = await html2canvas(cardEl, {
        useCORS: true,
        backgroundColor: '#0f172a',
        scale: 2,
        logging: false,
      });
      snapshot.toBlob((blob) => {
        if (!blob) {
          return;
        }
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `verification-${image.id}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 'image/png');
    } catch (err) {
      logger.error('Popup composite download failed:', err);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            {imageName}
          </DialogTitle>
        </DialogHeader>
        {/* 2026-05-05 (bug 65): same composite layout as the grid card.
            Photo + overlaid black/75 metadata strip with header, address,
            lat/long, weekday-date, map. Download button uses the same
            html2canvas snapshot path so the PNG matches what's on screen. */}
        {loading ? (
          <div className="flex items-center justify-center w-full h-96">
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          <>
            <div
              data-popup-download-card={image?.id}
              className="bg-card rounded-lg overflow-hidden mx-auto"
              style={{ maxWidth: '100%' }}
            >
              <img
                src={displayUrl}
                alt={imageName}
                loading="lazy"
                decoding="async"
                className="block w-full max-h-[70vh] object-contain"
              />
              {image && (
                <MetadataOverlay
                  attachmentId={image.id}
                  location={location}
                  uploadedAt={image.uploadedAt}
                  submissionAddress={submissionAddress}
                  compact={false}
                  mapSize="140x140"
                />
              )}
            </div>
            {image && (
              <div className="flex justify-end gap-2 mt-3">
                <Button variant="secondary" size="sm" onClick={onClose}>
                  Close
                </Button>
                <Button size="sm" onClick={handlePopupDownload}>
                  <Download className="h-4 w-4 mr-1" />
                  Download
                </Button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

// 2026-05-31: one evidence/selfie grid card. Sizes itself to the photo's
// REAL aspect ratio once it loads (via AsyncImage.onAspectRatio) instead of
// forcing a portrait `aspect-[3/4]` / square box — that box cropped/letter-
// boxed landscape photos and left the bottom metadata overlay floating over
// the black bar. The card now matches the image, so the overlay anchors to
// the true image edge and the html2canvas download captures the full frame.
const PhotoCard: React.FC<{
  image: VerificationImage;
  downloadIndex: number;
  fallbackAspectClass: string;
  submissionAddress?: string | null;
  photoTypeColor: string;
  onImageClick: (image: VerificationImage) => void;
  onDownload: (image: VerificationImage, index: number) => void;
  onOpenMaps: (lat: number, lng: number) => void;
}> = ({
  image,
  downloadIndex,
  fallbackAspectClass,
  submissionAddress,
  photoTypeColor,
  onImageClick,
  onDownload,
  onOpenMaps,
}) => {
  const [aspect, setAspect] = useState<number | null>(null);
  const rawGeo = image.geoLocation;
  const location =
    rawGeo && typeof rawGeo === 'object' && typeof rawGeo.latitude === 'number' ? rawGeo : null;

  return (
    <div className="group relative">
      {/* Snapshot target = image + overlaid metadata strip ONLY. Action
          buttons live OUTSIDE this div so the html2canvas snapshot stays
          clean. */}
      <div data-download-card={image.id} className="bg-muted/60 rounded-lg overflow-hidden">
        {/* Photo — full frame, never cropped or covered. The image box keeps
            the photo's true aspect ratio so portrait and landscape both
            render complete. */}
        <div
          className={`relative ${aspect ? '' : fallbackAspectClass}`}
          style={aspect ? { aspectRatio: String(aspect) } : undefined}
        >
          <AsyncImage
            imageUrl={image.url}
            imageId={image.id}
            thumbnailUrl={image.thumbnailUrl}
            alt={image.originalName}
            onAspectRatio={setAspect}
            className="absolute inset-0 w-full h-full object-contain cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => onImageClick(image)}
          />
          {/* Photo type badge top-right */}
          <div className="absolute top-2 right-2">
            <Badge className={photoTypeColor}>{image.photoType}</Badge>
          </div>
        </div>

        {/* Metadata panel — below the photo, in normal flow. */}
        <MetadataOverlay
          attachmentId={image.id}
          location={location}
          uploadedAt={image.uploadedAt}
          submissionAddress={submissionAddress}
          compact
          mapSize="88x88"
        />
      </div>

      {/* Action buttons — outside snapshot target, normal flow */}
      <div className="flex gap-2 pt-2">
        <Button
          size="sm"
          variant="secondary"
          className="flex-1 h-8 text-xs"
          onClick={() => onDownload(image, downloadIndex)}
        >
          <Download className="h-3 w-3 mr-1" />
          Download
        </Button>
        {location && (
          <Button
            size="sm"
            variant="secondary"
            className="flex-1 h-8 text-xs"
            onClick={() => onOpenMaps(location.latitude, location.longitude)}
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            Maps
          </Button>
        )}
      </div>
    </div>
  );
};

const VerificationImages: React.FC<VerificationImagesProps> = ({
  caseId,
  submissionId,
  title = 'Verification Images',
  showStats = true,
  submissionAddress,
  // customerName - unused parameter
}) => {
  const [selectedImage, setSelectedImage] = useState<{
    url: string;
    name: string;
    imageId?: number;
    image?: VerificationImage;
  } | null>(null);

  const openInGoogleMaps = (lat: number, lng: number) => {
    window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
  };

  // Use appropriate hook based on whether submissionId is provided
  // Call both hooks unconditionally to follow Rules of Hooks
  const submissionData = useVerificationImagesBySubmission(caseId, submissionId || '');
  const caseData = useVerificationImages(caseId);

  // Select the appropriate data based on whether submissionId is provided
  const { data, isLoading, error } = submissionId ? submissionData : caseData;

  const images = data?.data || [];

  const handleImageClick = (
    imageUrl: string,
    imageName: string,
    imageId?: number,
    image?: VerificationImage
  ) => {
    setSelectedImage({ url: imageUrl, name: imageName, imageId, image });
  };

  const handleDownload = async (imageId: number, imageName: string) => {
    try {
      const blob = await verificationImagesService.downloadVerificationImage(imageId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = imageName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      logger.error('Failed to download image:', error);
    }
  };

  const handleDownloadWithMetadata = async (image: VerificationImage, imageIndex: number) => {
    try {
      // 2026-04-21: the downloaded PNG must match the card the admin
      // is looking at on screen exactly — photo (with baked-in mobile
      // watermark) + metadata strip (capture time, location, accuracy,
      // resolved address). Easiest way to keep them byte-for-byte
      // identical is to snapshot the already-rendered card DOM with
      // html2canvas.
      //
      // Make sure the address line has resolved before we snapshot,
      // otherwise the downloaded image would show "Resolving address…"
      // instead of the real text.
      // Resolve the attachment's frozen address before snapshotting so
      // the card shows the real text, not "Resolving address…". The
      // backend stores the address on the attachment row, so this is a
      // no-op after the first view of this image.
      const resolvedAddress = await fetchAttachmentAddress(image.id);
      // Yield one frame so React re-renders the AddressLine with the
      // freshly cached value before we snapshot.
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

      const cardEl = document.querySelector<HTMLElement>(`[data-download-card="${image.id}"]`);
      if (!cardEl) {
        throw new Error('Unable to locate image card for download');
      }

      // 2026-05-05 race-fix: even after `await fetchAttachmentAddress(...)`
      // the AddressLine component's local useState(...) callback may not
      // have committed yet — the cache is global but the component's
      // `setAddress(...)` runs on its own React tick. If we snapshot
      // before that tick, the saved PNG shows stale "Resolving address…"
      // or the lat/lng fallback. Surgically overwrite the address row's
      // text node in the DOM right before html2canvas runs so the
      // snapshot is guaranteed to carry the resolved address. The
      // component will re-render correctly on the next React commit;
      // the visual flash (if any) is unobservable since html2canvas
      // freezes the layout immediately.
      if (resolvedAddress) {
        const addressNode = cardEl.querySelector<HTMLElement>('[data-address-line="true"]');
        if (addressNode) {
          addressNode.textContent = resolvedAddress;
        }
      }

      const snapshot = await html2canvas(cardEl, {
        useCORS: true,
        backgroundColor: '#0f172a',
        scale: 2,
        logging: false,
        // Skip the action buttons (Download + Maps) so the PNG is just
        // photo + metadata — the buttons are interactive-only.
        ignoreElements: (el) =>
          el instanceof HTMLElement && el.getAttribute('data-download-exclude') === 'true',
      });

      snapshot.toBlob((compositeBlob) => {
        if (!compositeBlob) {
          logger.error('html2canvas produced no blob');
          return;
        }
        const url = URL.createObjectURL(compositeBlob);
        const link = document.createElement('a');
        link.href = url;
        // 2026-05-05: avoid the full UUID in download filename when the
        // route param is the case UUID (case-detail can be opened by
        // either integer case_id OR uuid id). Use the first 8 chars of
        // the UUID as a friendly slug; integer case_ids pass through.
        const friendlyId = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(String(caseId))
          ? String(caseId).slice(0, 8)
          : String(caseId);
        const filename = `case-${friendlyId}-${imageIndex}.png`;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 'image/png');
    } catch (error) {
      // 2026-05-05 hard-stop diagnostic: SILENT fallback was hiding the
      // real cause from the user. Surface to console.error (cannot be
      // filtered by tag) AND a window.alert so the failure is visible
      // even if DevTools is closed. Then still fall back to .jpg so the
      // user has something to work with.
      const err = error as Error;

      console.error(
        '[ACS] Composite download failed — falling back to raw .jpg',
        err?.message,
        err
      );
      // 2026-05-06: replaced window.alert with toast — alert blocks the event loop and
      // ESLint no-alert flagged it. Toast surfaces the same diagnostic non-blocking.
      toast.error(
        `Composite download failed: ${err?.name || 'Error'}: ${err?.message || 'unknown'}. Falling back to raw .jpg without address overlay.`
      );
      // Fallback to regular download with case ID format
      const fallbackFriendlyId = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(String(caseId))
        ? String(caseId).slice(0, 8)
        : String(caseId);
      const filename = `case-${fallbackFriendlyId}-${imageIndex}.jpg`;
      handleDownload(image.id, filename);
    }
  };

  const getPhotoTypeColor = (photoType: string) => {
    switch (photoType) {
      case 'verification':
        return 'bg-green-100 text-green-800';
      case 'selfie':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-muted text-foreground dark:bg-card/60 dark:text-muted-foreground';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <ImageIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Failed to load verification images</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (images.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <ImageIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No verification images found</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Group images by type for better organization
  const verificationPhotos = images.filter((img) => img.photoType === 'verification');
  const selfiePhotos = images.filter((img) => img.photoType === 'selfie');

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              {title}
            </div>
            {showStats && (
              <div className="flex gap-2">
                <Badge variant="outline">
                  {images.length} image{images.length !== 1 ? 's' : ''}
                </Badge>
                {verificationPhotos.length > 0 && (
                  <Badge className="bg-green-100 text-green-800">
                    {verificationPhotos.length} verification
                  </Badge>
                )}
                {selfiePhotos.length > 0 && (
                  <Badge className="bg-green-100 text-green-800">
                    {selfiePhotos.length} selfie
                  </Badge>
                )}
              </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Verification Photos */}
            {verificationPhotos.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                  <Camera className="h-4 w-4" />
                  Verification Photos ({verificationPhotos.length})
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {verificationPhotos.map((image, index) => (
                    <PhotoCard
                      key={image.id}
                      image={image}
                      downloadIndex={index + 1}
                      fallbackAspectClass="aspect-[3/4]"
                      submissionAddress={submissionAddress}
                      photoTypeColor={getPhotoTypeColor(image.photoType)}
                      onImageClick={(img) =>
                        handleImageClick(img.url, img.originalName, img.id, img)
                      }
                      onDownload={handleDownloadWithMetadata}
                      onOpenMaps={openInGoogleMaps}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Selfie Photos */}
            {selfiePhotos.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                  <Camera className="h-4 w-4" />
                  Selfie Photos ({selfiePhotos.length})
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {selfiePhotos.map((image, index) => (
                    <PhotoCard
                      key={image.id}
                      image={image}
                      downloadIndex={verificationPhotos.length + index + 1}
                      fallbackAspectClass="aspect-square"
                      submissionAddress={submissionAddress}
                      photoTypeColor={getPhotoTypeColor(image.photoType)}
                      onImageClick={(img) =>
                        handleImageClick(img.url, img.originalName, img.id, img)
                      }
                      onDownload={handleDownloadWithMetadata}
                      onOpenMaps={openInGoogleMaps}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Image Viewer Modal */}
      {selectedImage && (
        <ImageViewer
          image={selectedImage.image}
          submissionAddress={submissionAddress}
          imageUrl={selectedImage.url}
          imageId={selectedImage.imageId}
          imageName={selectedImage.name}
          isOpen={!!selectedImage}
          onClose={() => setSelectedImage(null)}
        />
      )}
    </>
  );
};

export default VerificationImages;
