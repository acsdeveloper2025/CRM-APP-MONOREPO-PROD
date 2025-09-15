import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useVerificationImages, useVerificationImagesBySubmission } from '@/hooks/useVerificationImages';
import { verificationImagesService } from '@/services/verificationImages';
import { Camera, MapPin, Calendar, Download, Eye, Image as ImageIcon, ExternalLink, Navigation, Clock, Home } from 'lucide-react';
import { format } from 'date-fns';

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
        console.error('Error loading image URL:', error);
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
        const displayUrl = await verificationImagesService.getThumbnailDisplayUrl(thumbnailUrl, imageId);
        setUrl(displayUrl);
      } catch (error) {
        console.error('Error loading thumbnail URL:', error);
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
  onClick
}) => {
  const { url: displayUrl, loading: imageLoading } = useImageUrl(imageUrl, imageId);
  const { url: thumbUrl, loading: thumbLoading } = useThumbnailUrl(thumbnailUrl || '', imageId);

  const finalUrl = thumbnailUrl ? thumbUrl : displayUrl;
  const isLoading = thumbnailUrl ? thumbLoading : imageLoading;

  if (isLoading) {
    return <Skeleton className={className || "w-full h-full"} />;
  }

  return (
    <img
      src={finalUrl}
      alt={alt}
      className={className}
      onClick={onClick}
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
  imageUrl: string;
  imageId?: number;
  imageName: string;
  isOpen: boolean;
  onClose: () => void;
}

const ImageViewer: React.FC<ImageViewerProps> = ({ imageUrl, imageId, imageName, isOpen, onClose }) => {
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
            <Skeleton className="w-full h-96" />
          ) : (
            <img
              src={displayUrl}
              alt={imageName}
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
  title = "Verification Images",
  showStats = true,
  submissionAddress,
  customerName
}) => {
  const [selectedImage, setSelectedImage] = useState<{ url: string; name: string; imageId?: number } | null>(null);

  // Use appropriate hook based on whether submissionId is provided
  const { data, isLoading, error } = submissionId
    ? useVerificationImagesBySubmission(caseId, submissionId)
    : useVerificationImages(caseId);

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
      console.error('Failed to download image:', error);
    }
  };

  const handleDownloadWithMetadata = async (image: any, imageIndex: number) => {
    try {
      // Download the original image
      const blob = await verificationImagesService.downloadVerificationImage(image.id);

      // Create a canvas to composite the image with metadata
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context not available');

      // Create an image element to load the blob
      const img = new Image();
      const imageUrl = URL.createObjectURL(blob);

      img.onload = () => {
        // Set canvas size - original image height + space for metadata
        const metadataHeight = 200; // Space for metadata at bottom
        canvas.width = Math.max(img.width, 600); // Minimum width for metadata
        canvas.height = img.height + metadataHeight;

        // Fill background with dark theme
        ctx.fillStyle = '#0f172a'; // slate-900
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw the original image
        const imageX = (canvas.width - img.width) / 2; // Center the image
        ctx.drawImage(img, imageX, 0, img.width, img.height);

        // Draw metadata section
        const metadataY = img.height + 20;
        ctx.fillStyle = '#1e293b'; // slate-800
        ctx.fillRect(10, metadataY, canvas.width - 20, metadataHeight - 30);

        // Set text styles
        ctx.fillStyle = '#f8fafc'; // slate-50
        ctx.font = 'bold 16px Arial';

        // Draw metadata title
        ctx.fillText('Verification Photo Metadata', 20, metadataY + 25);

        // Set smaller font for details
        ctx.font = '14px Arial';
        let currentY = metadataY + 50;

        // Draw capture time
        if (image.geoLocation?.timestamp) {
          ctx.fillStyle = '#94a3b8'; // slate-400
          ctx.fillText('🕒 Capture Time:', 20, currentY);
          ctx.fillStyle = '#f8fafc';
          ctx.fillText(format(new Date(image.geoLocation.timestamp), 'MMM dd, yyyy HH:mm:ss'), 150, currentY);
          currentY += 25;
        }

        // Draw location coordinates
        if (image.geoLocation) {
          ctx.fillStyle = '#94a3b8';
          ctx.fillText('📍 Location:', 20, currentY);
          ctx.fillStyle = '#f8fafc';
          ctx.fillText(`${image.geoLocation.latitude.toFixed(6)}, ${image.geoLocation.longitude.toFixed(6)}`, 150, currentY);
          currentY += 25;

          // Draw accuracy
          if (image.geoLocation.accuracy) {
            ctx.fillStyle = '#94a3b8';
            ctx.fillText('🎯 Accuracy:', 20, currentY);
            ctx.fillStyle = '#f8fafc';
            ctx.fillText(`±${image.geoLocation.accuracy}m`, 150, currentY);
            currentY += 25;
          }
        }

        // Draw address if available
        ctx.fillStyle = '#94a3b8';
        ctx.fillText('🏠 Address:', 20, currentY);
        ctx.fillStyle = '#f8fafc';
        const address = image.geoLocation?.address || submissionAddress || '21, Veer Savarkar Rd, Datar Colony, Bhandup East, Mumbai, Maharashtra 400042, India';
        // Wrap long address text
        const maxWidth = canvas.width - 170;
        const words = address.split(' ');
        let line = '';
        let lineY = currentY;

        for (let n = 0; n < words.length; n++) {
          const testLine = line + words[n] + ' ';
          const metrics = ctx.measureText(testLine);
          const testWidth = metrics.width;

          if (testWidth > maxWidth && n > 0) {
            ctx.fillText(line, 150, lineY);
            line = words[n] + ' ';
            lineY += 20;
          } else {
            line = testLine;
          }
        }
        ctx.fillText(line, 150, lineY);

        // Convert canvas to blob and download
        canvas.toBlob((compositeBlob) => {
          if (compositeBlob) {
            const url = URL.createObjectURL(compositeBlob);
            const link = document.createElement('a');
            link.href = url;
            // Create filename with case ID format: "case-{caseId}-{imageIndex}.png"
            const filename = `case-${caseId}-${imageIndex}.png`;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
          }
        }, 'image/png');

        // Clean up
        URL.revokeObjectURL(imageUrl);
      };

      img.src = imageUrl;
    } catch (error) {
      console.error('Failed to download image with metadata:', error);
      // Fallback to regular download with case ID format
      const filename = `case-${caseId}-${imageIndex}.jpg`;
      handleDownload(image.id, filename);
    }
  };

  const formatGeoLocation = (geoLocation: any) => {
    if (!geoLocation) return null;
    return `${geoLocation.latitude.toFixed(6)}, ${geoLocation.longitude.toFixed(6)}`;
  };

  const getAccuracyBadge = (accuracy: number) => {
    if (accuracy <= 5) {
      return { text: 'High Accuracy', className: 'bg-green-100 text-green-800' };
    } else if (accuracy <= 20) {
      return { text: 'Medium Accuracy', className: 'bg-yellow-100 text-yellow-800' };
    } else {
      return { text: 'Low Accuracy', className: 'bg-red-100 text-red-800' };
    }
  };

  const openInGoogleMaps = (lat: number, lng: number) => {
    const url = `https://www.google.com/maps?q=${lat},${lng}`;
    window.open(url, '_blank');
  };

  const openInAppleMaps = (lat: number, lng: number) => {
    const url = `https://maps.apple.com/?q=${lat},${lng}`;
    window.open(url, '_blank');
  };

  const copyCoordinates = (lat: number, lng: number) => {
    const coordinates = `${lat}, ${lng}`;
    navigator.clipboard.writeText(coordinates);
  };

  const getPhotoTypeColor = (photoType: string) => {
    switch (photoType) {
      case 'verification':
        return 'bg-blue-100 text-blue-800';
      case 'selfie':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-muted text-foreground';
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-48 w-full rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
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
  const verificationPhotos = images.filter(img => img.photoType === 'verification');
  const selfiePhotos = images.filter(img => img.photoType === 'selfie');

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
                  <Badge className="bg-blue-100 text-blue-800">
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
                    <div key={image.id} className="group relative">
                      {/* Attachment Card Format */}
                      <Card className="border border-border hover:border-border transition-colors">
                        <CardContent className="p-0">
                          {/* Image with overlay */}
                          <div className="relative aspect-square bg-muted rounded-t-lg overflow-hidden">
                            <AsyncImage
                              imageUrl={image.url}
                              imageId={image.id}
                              thumbnailUrl={image.thumbnailUrl}
                              alt={image.originalName}
                              className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => handleImageClick(image.url, image.originalName, image.id)}
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
                                  {image.geoLocation?.timestamp
                                    ? format(new Date(image.geoLocation.timestamp), 'dd/MM/yyyy, HH:mm:ss')
                                    : format(new Date(image.uploadedAt), 'dd/MM/yyyy, HH:mm:ss')
                                  }
                                </p>
                              </div>
                            </div>

                            {/* Location */}
                            {image.geoLocation && (
                              <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-slate-400" />
                                <div>
                                  <p className="text-xs text-slate-400">Location</p>
                                  <p className="text-sm font-medium font-mono">
                                    {image.geoLocation.latitude.toFixed(6)}, {image.geoLocation.longitude.toFixed(6)}
                                  </p>
                                  {image.geoLocation.accuracy && (
                                    <p className="text-xs text-slate-400">Accuracy: ±{image.geoLocation.accuracy}m</p>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Address */}
                            <div className="flex items-center gap-2">
                              <Home className="h-4 w-4 text-slate-400" />
                              <div>
                                <p className="text-xs text-slate-400">Address</p>
                                <p className="text-sm font-medium">
                                  {image.geoLocation?.address || submissionAddress || '21, Veer Savarkar Rd, Datar Colony, Bhandup East, Mumbai, Maharashtra 400042, India'}
                                </p>
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-2 pt-2">
                              <Button
                                size="sm"
                                variant="secondary"
                                className="flex-1 h-8 text-xs bg-slate-700 hover:bg-slate-600 text-white border-slate-600"
                                onClick={() => handleDownloadWithMetadata(image, index + 1)}
                              >
                                <Download className="h-3 w-3 mr-1" />
                                Download
                              </Button>
                              {image.geoLocation && (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="flex-1 h-8 text-xs bg-slate-700 hover:bg-slate-600 text-white border-slate-600"
                                  onClick={() => openInGoogleMaps(image.geoLocation.latitude, image.geoLocation.longitude)}
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
                    <div key={image.id} className="group relative">
                      {/* Attachment Card Format */}
                      <Card className="border border-border hover:border-border transition-colors">
                        <CardContent className="p-0">
                          {/* Image with overlay */}
                          <div className="relative aspect-square bg-muted rounded-t-lg overflow-hidden">
                            <AsyncImage
                              imageUrl={image.url}
                              imageId={image.id}
                              thumbnailUrl={image.thumbnailUrl}
                              alt={image.originalName}
                              className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => handleImageClick(image.url, image.originalName, image.id)}
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
                                  {image.geoLocation?.timestamp
                                    ? format(new Date(image.geoLocation.timestamp), 'dd/MM/yyyy, HH:mm:ss')
                                    : format(new Date(image.uploadedAt), 'dd/MM/yyyy, HH:mm:ss')
                                  }
                                </p>
                              </div>
                            </div>

                            {/* Location */}
                            {image.geoLocation && (
                              <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-slate-400" />
                                <div>
                                  <p className="text-xs text-slate-400">Location</p>
                                  <p className="text-sm font-medium font-mono">
                                    {image.geoLocation.latitude.toFixed(6)}, {image.geoLocation.longitude.toFixed(6)}
                                  </p>
                                  {image.geoLocation.accuracy && (
                                    <p className="text-xs text-slate-400">Accuracy: ±{image.geoLocation.accuracy}m</p>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Address */}
                            <div className="flex items-center gap-2">
                              <Home className="h-4 w-4 text-slate-400" />
                              <div>
                                <p className="text-xs text-slate-400">Address</p>
                                <p className="text-sm font-medium">
                                  {image.geoLocation?.address || submissionAddress || '21, Veer Savarkar Rd, Datar Colony, Bhandup East, Mumbai, Maharashtra 400042, India'}
                                </p>
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-2 pt-2">
                              <Button
                                size="sm"
                                variant="secondary"
                                className="flex-1 h-8 text-xs bg-slate-700 hover:bg-slate-600 text-white border-slate-600"
                                onClick={() => handleDownloadWithMetadata(image, verificationPhotos.length + index + 1)}
                              >
                                <Download className="h-3 w-3 mr-1" />
                                Download
                              </Button>
                              {image.geoLocation && (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="flex-1 h-8 text-xs bg-slate-700 hover:bg-slate-600 text-white border-slate-600"
                                  onClick={() => openInGoogleMaps(image.geoLocation.latitude, image.geoLocation.longitude)}
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
