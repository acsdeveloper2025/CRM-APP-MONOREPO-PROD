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
import {
  Camera,
  MapPin,
  Download,
  Eye,
  Image as ImageIcon,
  ExternalLink,
  Clock,
  Home,
} from 'lucide-react';
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
        className={`${className || ''} bg-white/10 flex flex-col items-center justify-center text-[8px] text-white/70 text-center p-1`}
      >
        <MapPin className="h-4 w-4 mb-0.5" />
        <span>Map unavailable</span>
      </div>
    );
  }
  if (!blobUrl) {
    return <div className={`${className || ''} bg-white/5 animate-pulse`} />;
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

// Small presentational component so the hook can live inside each
// image card and key off the attachment's id.
const AddressLine: React.FC<{
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
      : 'Location unknown');
  return (
    <p className="text-sm font-medium" data-address-line="true">
      {loading && !address ? 'Resolving address…' : display}
    </p>
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
}

const AsyncImage: React.FC<AsyncImageProps> = ({
  imageUrl,
  imageId,
  thumbnailUrl,
  alt,
  className,
  onClick,
}) => {
  const { url: displayUrl, loading: imageLoading } = useImageUrl(imageUrl, imageId);
  const { url: thumbUrl, loading: thumbLoading } = useThumbnailUrl(thumbnailUrl || '', imageId);

  const finalUrl = thumbnailUrl ? thumbUrl : displayUrl;
  const isLoading = thumbnailUrl ? thumbLoading : imageLoading;

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
        <img src={finalUrl} alt={alt} loading="lazy" decoding="async" className={className} />
      </button>
    );
  }

  return <img src={finalUrl} alt={alt} loading="lazy" decoding="async" className={className} />;
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
              className="relative bg-slate-900 rounded-lg overflow-hidden mx-auto"
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
                <div className="absolute bottom-0 left-0 right-0 px-4 py-3 bg-black/75 text-white">
                  <div className="flex gap-3 items-stretch">
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="text-base font-bold leading-tight uppercase">
                        <CityStateCountryLine attachmentId={image.id} />
                      </p>
                      <p className="text-xs leading-snug text-white/90" data-address-line="true">
                        <AddressFullLine
                          attachmentId={image.id}
                          latitude={location?.latitude}
                          longitude={location?.longitude}
                          fallback={location?.address || submissionAddress || null}
                        />
                      </p>
                      {location && (
                        <p className="text-xs font-mono">
                          Lat {location.latitude.toFixed(7)} / Long {location.longitude.toFixed(7)}
                        </p>
                      )}
                      <p className="text-xs">
                        {location?.timestamp
                          ? format(new Date(location.timestamp), 'EEEE d MMMM yyyy, HH:mm:ss')
                          : format(new Date(image.uploadedAt), 'EEEE d MMMM yyyy, HH:mm:ss')}
                      </p>
                    </div>
                    {location &&
                      typeof location.latitude === 'number' &&
                      typeof location.longitude === 'number' && (
                        <div className="shrink-0 flex items-center">
                          <StaticMapImage
                            latitude={location.latitude}
                            longitude={location.longitude}
                            size="140x140"
                            zoom={16}
                            className="w-[140px] h-[140px] object-cover rounded border border-white/30"
                          />
                        </div>
                      )}
                  </div>
                </div>
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
        return 'bg-slate-100 text-slate-900 dark:bg-slate-800/60 dark:text-slate-100';
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
          <div className="text-center py-8 text-gray-600">
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
          <div className="text-center py-8 text-gray-600">
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
                <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <Camera className="h-4 w-4" />
                  Verification Photos ({verificationPhotos.length})
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {verificationPhotos.map((image, index) => {
                    const rawGeo = image.geoLocation;
                    const location =
                      rawGeo && typeof rawGeo === 'object' && typeof rawGeo.latitude === 'number'
                        ? rawGeo
                        : null;
                    return (
                      <div key={image.id} className="group relative">
                        {/* Snapshot target = image + overlaid metadata strip
                            ONLY. Action buttons live OUTSIDE this div so the
                            html2canvas snapshot stays clean. */}
                        <div
                          data-download-card={image.id}
                          className="relative aspect-[3/4] bg-slate-100 dark:bg-slate-800/60 rounded-lg overflow-hidden"
                        >
                          <AsyncImage
                            imageUrl={image.url}
                            imageId={image.id}
                            thumbnailUrl={image.thumbnailUrl}
                            alt={image.originalName}
                            className="absolute inset-0 w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() =>
                              handleImageClick(image.url, image.originalName, image.id, image)
                            }
                          />

                          {/* Photo type badge top-right */}
                          <div className="absolute top-2 right-2">
                            <Badge className={getPhotoTypeColor(image.photoType)}>
                              {image.photoType}
                            </Badge>
                          </div>

                          {/* 2026-05-05 (bug 62): metadata strip OVERLAYS the
                              photo (matches user-provided sample). Position
                              absolute at the bottom, semi-transparent black bg
                              so the photo behind shows through. Snapshot
                              captures the whole stack as a single layered
                              PNG.
                              2026-05-05 (bug 63): tightened sizes for the
                              3-col grid (each card ~280px wide). Text-[10px]
                              with line-clamp-2 on address keeps strip <40%
                              of card height. Map dropped to 88x88 to leave
                              room for the address text. Sample-match remains
                              visually but everything fits without word-wrap
                              chaos. */}
                          <div className="absolute bottom-0 left-0 right-0 px-2.5 py-2 bg-black/75 text-white">
                            <div className="flex gap-2 items-stretch">
                              <div className="flex-1 min-w-0 space-y-0.5">
                                <p className="text-[13px] font-bold leading-tight uppercase">
                                  <CityStateCountryLine attachmentId={image.id} />
                                </p>
                                <p
                                  className="text-[10px] leading-snug text-white/90 line-clamp-2"
                                  data-address-line="true"
                                >
                                  <AddressFullLine
                                    attachmentId={image.id}
                                    latitude={location?.latitude}
                                    longitude={location?.longitude}
                                    fallback={location?.address || submissionAddress || null}
                                  />
                                </p>
                                {location && (
                                  <p className="text-[10px] font-mono leading-tight">
                                    Lat {location.latitude.toFixed(6)} / Long{' '}
                                    {location.longitude.toFixed(6)}
                                  </p>
                                )}
                                <p className="text-[10px] leading-tight">
                                  {location?.timestamp
                                    ? format(
                                        new Date(location.timestamp),
                                        'EEE d MMM yyyy, HH:mm:ss'
                                      )
                                    : format(
                                        new Date(image.uploadedAt),
                                        'EEE d MMM yyyy, HH:mm:ss'
                                      )}
                                </p>
                              </div>
                              {location &&
                                typeof location.latitude === 'number' &&
                                typeof location.longitude === 'number' && (
                                  <div className="shrink-0 flex items-center">
                                    <StaticMapImage
                                      latitude={location.latitude}
                                      longitude={location.longitude}
                                      size="88x88"
                                      zoom={16}
                                      className="w-[88px] h-[88px] object-cover rounded border border-white/30"
                                    />
                                  </div>
                                )}
                            </div>
                          </div>
                        </div>

                        {/* Action buttons — outside snapshot target, normal flow */}
                        <div className="flex gap-2 pt-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            className="flex-1 h-8 text-xs"
                            onClick={() => handleDownloadWithMetadata(image, index + 1)}
                          >
                            <Download className="h-3 w-3 mr-1" />
                            Download
                          </Button>
                          {location && (
                            <Button
                              size="sm"
                              variant="secondary"
                              className="flex-1 h-8 text-xs"
                              onClick={() =>
                                openInGoogleMaps(location.latitude, location.longitude)
                              }
                            >
                              <ExternalLink className="h-3 w-3 mr-1" />
                              Maps
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Selfie Photos */}
            {selfiePhotos.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <Camera className="h-4 w-4" />
                  Selfie Photos ({selfiePhotos.length})
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {selfiePhotos.map((image, index) => {
                    const rawGeo = image.geoLocation;
                    const location =
                      rawGeo && typeof rawGeo === 'object' && typeof rawGeo.latitude === 'number'
                        ? rawGeo
                        : null;
                    return (
                      <div key={image.id} className="group relative" data-download-card={image.id}>
                        {/* Attachment Card Format */}
                        <Card className="border border-border hover:border-border transition-colors">
                          <CardContent className="p-0">
                            {/* Image with overlay */}
                            <div className="relative aspect-square bg-slate-100 dark:bg-slate-800/60 rounded-t-lg overflow-hidden">
                              <AsyncImage
                                imageUrl={image.url}
                                imageId={image.id}
                                thumbnailUrl={image.thumbnailUrl}
                                alt={image.originalName}
                                className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                onClick={() =>
                                  handleImageClick(image.url, image.originalName, image.id, image)
                                }
                              />

                              {/* Photo type badge overlay */}
                              <div className="absolute top-2 right-2">
                                <Badge className={getPhotoTypeColor(image.photoType)}>
                                  {image.photoType}
                                </Badge>
                              </div>
                            </div>

                            {/* Metadata Section */}
                            <div className="p-3 bg-slate-900 text-white space-y-3">
                              {/* Capture Time */}
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-slate-400" />
                                <div>
                                  <p className="text-xs text-slate-400">Capture Time</p>
                                  <p className="text-sm font-medium">
                                    {location?.timestamp
                                      ? format(new Date(location.timestamp), 'dd/MM/yyyy, HH:mm:ss')
                                      : format(new Date(image.uploadedAt), 'dd/MM/yyyy, HH:mm:ss')}
                                  </p>
                                </div>
                              </div>

                              {/* Location */}
                              {location && (
                                <div className="flex items-center gap-2">
                                  <MapPin className="h-4 w-4 text-slate-400" />
                                  <div>
                                    <p className="text-xs text-slate-400">Location</p>
                                    <p className="text-sm font-medium font-mono">
                                      {location.latitude.toFixed(6)},{' '}
                                      {location.longitude.toFixed(6)}
                                    </p>
                                    {location.accuracy && (
                                      <p className="text-xs text-slate-400">
                                        Accuracy: ±{location.accuracy}m
                                      </p>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Address — resolved via backend Google proxy on demand */}
                              <div className="flex items-center gap-2">
                                <Home className="h-4 w-4 text-slate-400" />
                                <div>
                                  <p className="text-xs text-slate-400">Address</p>
                                  <AddressLine
                                    attachmentId={image.id}
                                    latitude={location?.latitude}
                                    longitude={location?.longitude}
                                    fallback={location?.address || submissionAddress || null}
                                  />
                                </div>
                              </div>

                              {/* Action Buttons — excluded from the downloaded snapshot */}
                              <div className="flex gap-2 pt-2" data-download-exclude="true">
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="flex-1 h-8 text-xs bg-slate-700 hover:bg-slate-600 text-white border-slate-600"
                                  onClick={() =>
                                    handleDownloadWithMetadata(
                                      image,
                                      verificationPhotos.length + index + 1
                                    )
                                  }
                                >
                                  <Download className="h-3 w-3 mr-1" />
                                  Download
                                </Button>
                                {location && (
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    className="flex-1 h-8 text-xs bg-slate-700 hover:bg-slate-600 text-white border-slate-600"
                                    onClick={() =>
                                      openInGoogleMaps(location.latitude, location.longitude)
                                    }
                                  >
                                    <ExternalLink className="h-3 w-3 mr-1" />
                                    Maps
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    );
                  })}
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
