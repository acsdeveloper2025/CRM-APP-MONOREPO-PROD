import React, { useState, useEffect } from 'react';
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
import html2canvas from 'html2canvas';
import { logger } from '@/utils/logger';
import { apiService } from '@/services/api';

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

async function fetchAttachmentAddress(attachmentId: number): Promise<string | null> {
  const existing = attachmentAddressCache.get(attachmentId);
  if (existing?.address !== undefined) {
    return existing.address;
  }
  if (existing?.pending) {
    return existing.pending;
  }

  const promise = apiService
    .get<{ address?: string; cached?: boolean }>(`/attachments/${attachmentId}/address`)
    .then((data) => {
      const address = typeof data?.address === 'string' ? data.address : null;
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

function useAttachmentAddress(attachmentId: number | null | undefined): {
  address: string | null;
  loading: boolean;
} {
  const [address, setAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (typeof attachmentId !== 'number' || !Number.isFinite(attachmentId)) {
      setAddress(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    fetchAttachmentAddress(attachmentId).then((resolved) => {
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

// Small presentational component so the hook can live inside each
// image card and key off the attachment's id.
const AddressLine: React.FC<{
  attachmentId: number | null | undefined;
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
    <p className="text-sm font-medium">{loading && !address ? 'Resolving address…' : display}</p>
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
  imageUrl: string;
  imageId?: number;
  imageName: string;
  isOpen: boolean;
  onClose: () => void;
}

const ImageViewer: React.FC<ImageViewerProps> = ({
  imageUrl,
  imageId,
  imageName,
  isOpen,
  onClose,
}) => {
  const { url: displayUrl, loading } = useImageUrl(imageUrl, imageId);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            {imageName}
          </DialogTitle>
        </DialogHeader>
        <div className="flex justify-center">
          {loading ? (
            <div className="flex items-center justify-center w-full h-96">
              <LoadingSpinner size="lg" />
            </div>
          ) : (
            <img
              src={displayUrl}
              alt={imageName}
              loading="lazy"
              decoding="async"
              className="max-w-full max-h-[70vh] object-contain rounded-lg"
            />
          )}
        </div>
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

  const handleImageClick = (imageUrl: string, imageName: string, imageId?: number) => {
    setSelectedImage({ url: imageUrl, name: imageName, imageId });
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
      await fetchAttachmentAddress(image.id);
      // Yield one frame so React re-renders the AddressLine with the
      // freshly cached value before we snapshot.
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

      const cardEl = document.querySelector<HTMLElement>(`[data-download-card="${image.id}"]`);
      if (!cardEl) {
        throw new Error('Unable to locate image card for download');
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
        const filename = `case-${caseId}-${imageIndex}.png`;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 'image/png');
    } catch (error) {
      logger.error('Failed to download image with metadata:', error);
      // Fallback to regular download with case ID format
      const filename = `case-${caseId}-${imageIndex}.jpg`;
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
                                  handleImageClick(image.url, image.originalName, image.id)
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
                                  onClick={() => handleDownloadWithMetadata(image, index + 1)}
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
                                  handleImageClick(image.url, image.originalName, image.id)
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
