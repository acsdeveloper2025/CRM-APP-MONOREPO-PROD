import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/ui/components/dialog';
import { Badge } from '@/ui/components/badge';
import { Button } from '@/ui/components/button';
import { Card, CardContent } from '@/ui/components/card';
import { MapPin, Download, Eye, Camera, User } from 'lucide-react';
import { FormPhoto } from '@/types/form';
import { formatDistanceToNow } from 'date-fns';
import { Box } from '@/ui/primitives/Box';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';

interface FormPhotosGalleryProps {
  photos: FormPhoto[];
}

interface PhotoViewerProps {
  photo: FormPhoto;
  isOpen: boolean;
  onClose: () => void;
}

const PhotoViewer: React.FC<PhotoViewerProps> = ({ photo, isOpen, onClose }) => {
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) {return '0 Bytes';}
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent style={{ width: 'min(92vw, 64rem)', maxHeight: '90vh', overflow: 'auto' }}>
        <DialogHeader>
          <DialogTitle>
            <Stack direction="horizontal" gap={2} align="center" wrap="wrap">
              <Camera size={20} />
              <span>{photo.type === 'selfie' ? 'Verification Selfie' : 'Verification Photo'}</span>
              <Badge variant={photo.type === 'selfie' ? 'secondary' : 'default'}>{photo.type}</Badge>
            </Stack>
          </DialogTitle>
        </DialogHeader>

        <Stack gap={4}>
          <Box style={{ display: 'flex', justifyContent: 'center' }}>
            <img
              src={photo.url}
              alt={`${photo.type} photo`}
              style={{ maxWidth: '100%', maxHeight: '24rem', objectFit: 'contain', borderRadius: 'var(--ui-radius-lg)', border: '1px solid var(--ui-border)' }}
            />
          </Box>

          <Box style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <Card>
              <CardContent style={{ padding: '1rem' }}>
                <Stack gap={3}>
                  <Text as="h4" variant="label">
                    <Stack direction="horizontal" gap={2} align="center">
                      <MapPin size={16} />
                      <span>Location Details</span>
                    </Stack>
                  </Text>
                  <Stack gap={2}>
                    <Text variant="body-sm"><strong>Coordinates:</strong> {photo.geoLocation.latitude.toFixed(6)}, {photo.geoLocation.longitude.toFixed(6)}</Text>
                    <Text variant="body-sm"><strong>Accuracy:</strong> ±{photo.geoLocation.accuracy}m</Text>
                    {photo.geoLocation.address ? <Text variant="body-sm"><strong>Address:</strong> {photo.geoLocation.address}</Text> : null}
                    <Text variant="body-sm"><strong>Captured:</strong> {formatDistanceToNow(new Date(photo.geoLocation.timestamp), { addSuffix: true })}</Text>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>

            <Card>
              <CardContent style={{ padding: '1rem' }}>
                <Stack gap={3}>
                  <Text as="h4" variant="label">
                    <Stack direction="horizontal" gap={2} align="center">
                      <Camera size={16} />
                      <span>Photo Details</span>
                    </Stack>
                  </Text>
                  <Stack gap={2}>
                    <Text variant="body-sm"><strong>File Size:</strong> {formatFileSize(photo.metadata.fileSize)}</Text>
                    <Text variant="body-sm"><strong>Dimensions:</strong> {photo.metadata.dimensions.width} × {photo.metadata.dimensions.height}</Text>
                    <Text variant="body-sm"><strong>Captured At:</strong> {formatDistanceToNow(new Date(photo.metadata.capturedAt), { addSuffix: true })}</Text>
                    {photo.metadata.deviceInfo ? <Text variant="body-sm"><strong>Device:</strong> {photo.metadata.deviceInfo}</Text> : null}
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          </Box>

          <Stack direction="horizontal" justify="flex-end" gap={2}>
            <Button variant="outline" onClick={() => window.open(photo.url, '_blank')} icon={<Download size={16} />}>
              Download
            </Button>
          </Stack>
        </Stack>
      </DialogContent>
    </Dialog>
  );
};

export const FormPhotosGallery: React.FC<FormPhotosGalleryProps> = ({ photos }) => {
  const [selectedPhoto, setSelectedPhoto] = useState<FormPhoto | null>(null);
  const verificationPhotos = photos.filter((photo) => photo.type === 'verification');
  const selfiePhotos = photos.filter((photo) => photo.type === 'selfie');

  const renderPhotoGrid = (items: FormPhoto[], label: string, icon: React.ReactNode, selfie = false) => (
    <Stack gap={3}>
      <Text as="h4" variant="label">
        <Stack direction="horizontal" gap={2} align="center">
          {icon}
          <span>{label}</span>
        </Stack>
      </Text>
      <Box style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
        {items.map((photo) => (
          <Box
            key={photo.id}
            style={{ position: 'relative', cursor: 'pointer' }}
            onClick={() => setSelectedPhoto(photo)}
          >
            <img
              src={photo.thumbnailUrl || photo.url}
              alt={selfie ? 'Verification selfie' : 'Verification photo'}
              style={{ width: '100%', height: '8rem', objectFit: 'cover', borderRadius: 'var(--ui-radius-lg)', border: '1px solid var(--ui-border)' }}
            />
            <Box style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Eye size={20} style={{ color: '#fff' }} />
            </Box>
            {selfie ? (
              <Box style={{ position: 'absolute', top: '0.5rem', right: '0.5rem' }}>
                <Badge>Selfie</Badge>
              </Box>
            ) : (
              <Box style={{ position: 'absolute', left: '0.5rem', right: '0.5rem', bottom: '0.5rem' }}>
                <Box style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: '#fff', background: 'rgba(0,0,0,0.55)', borderRadius: '0.5rem', padding: '0.25rem 0.5rem' }}>
                  <MapPin size={12} />
                  <span>±{photo.geoLocation.accuracy}m</span>
                </Box>
              </Box>
            )}
          </Box>
        ))}
      </Box>
    </Stack>
  );

  return (
    <Stack gap={6}>
      {verificationPhotos.length > 0 ? renderPhotoGrid(verificationPhotos, `Verification Photos (${verificationPhotos.length})`, <Camera size={16} />) : null}
      {selfiePhotos.length > 0 ? renderPhotoGrid(selfiePhotos, `Verification Selfies (${selfiePhotos.length})`, <User size={16} />, true) : null}
      {selectedPhoto ? <PhotoViewer photo={selectedPhoto} isOpen={!!selectedPhoto} onClose={() => setSelectedPhoto(null)} /> : null}
    </Stack>
  );
};
