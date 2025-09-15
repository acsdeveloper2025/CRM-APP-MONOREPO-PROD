import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MapPin, Clock, Download, Eye, Camera, User } from 'lucide-react';
import { FormPhoto } from '@/types/form';
import { formatDistanceToNow } from 'date-fns';

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
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Camera className="h-5 w-5" />
            <span>{photo.type === 'selfie' ? 'Verification Selfie' : 'Verification Photo'}</span>
            <Badge variant={photo.type === 'selfie' ? 'secondary' : 'default'}>
              {photo.type}
            </Badge>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Photo */}
          <div className="flex justify-center">
            <img
              src={photo.url}
              alt={`${photo.type} photo`}
              className="max-w-full max-h-96 object-contain rounded-lg border"
            />
          </div>
          
          {/* Photo Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Location Information */}
            <Card>
              <CardContent className="p-4">
                <h4 className="font-medium flex items-center space-x-2 mb-3">
                  <MapPin className="h-4 w-4" />
                  <span>Location Details</span>
                </h4>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium">Coordinates:</span> {photo.geoLocation.latitude.toFixed(6)}, {photo.geoLocation.longitude.toFixed(6)}
                  </div>
                  <div>
                    <span className="font-medium">Accuracy:</span> ±{photo.geoLocation.accuracy}m
                  </div>
                  {photo.geoLocation.address && (
                    <div>
                      <span className="font-medium">Address:</span> {photo.geoLocation.address}
                    </div>
                  )}
                  <div>
                    <span className="font-medium">Captured:</span> {formatDistanceToNow(new Date(photo.geoLocation.timestamp), { addSuffix: true })}
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Photo Metadata */}
            <Card>
              <CardContent className="p-4">
                <h4 className="font-medium flex items-center space-x-2 mb-3">
                  <Camera className="h-4 w-4" />
                  <span>Photo Details</span>
                </h4>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium">File Size:</span> {formatFileSize(photo.metadata.fileSize)}
                  </div>
                  <div>
                    <span className="font-medium">Dimensions:</span> {photo.metadata.dimensions.width} × {photo.metadata.dimensions.height}
                  </div>
                  <div>
                    <span className="font-medium">Captured At:</span> {formatDistanceToNow(new Date(photo.metadata.capturedAt), { addSuffix: true })}
                  </div>
                  {photo.metadata.deviceInfo && (
                    <div>
                      <span className="font-medium">Device:</span> {photo.metadata.deviceInfo}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Actions */}
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => window.open(photo.url, '_blank')}>
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export const FormPhotosGallery: React.FC<FormPhotosGalleryProps> = ({ photos }) => {
  const [selectedPhoto, setSelectedPhoto] = useState<FormPhoto | null>(null);

  const verificationPhotos = photos.filter(photo => photo.type === 'verification');
  const selfiePhotos = photos.filter(photo => photo.type === 'selfie');

  return (
    <div className="space-y-6">
      {/* Verification Photos */}
      {verificationPhotos.length > 0 && (
        <div>
          <h4 className="font-medium mb-3 flex items-center space-x-2">
            <Camera className="h-4 w-4" />
            <span>Verification Photos ({verificationPhotos.length})</span>
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {verificationPhotos.map((photo) => (
              <div
                key={photo.id}
                className="relative group cursor-pointer"
                onClick={() => setSelectedPhoto(photo)}
              >
                <img
                  src={photo.thumbnailUrl || photo.url}
                  alt="Verification photo"
                  className="w-full h-32 object-cover rounded-lg border transition-transform group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-opacity rounded-lg flex items-center justify-center">
                  <Eye className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="absolute bottom-2 left-2 right-2">
                  <div className="flex items-center space-x-1 text-xs text-white bg-black bg-opacity-50 rounded px-2 py-1">
                    <MapPin className="h-3 w-3" />
                    <span>±{photo.geoLocation.accuracy}m</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Selfie Photos */}
      {selfiePhotos.length > 0 && (
        <div>
          <h4 className="font-medium mb-3 flex items-center space-x-2">
            <User className="h-4 w-4" />
            <span>Verification Selfies ({selfiePhotos.length})</span>
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {selfiePhotos.map((photo) => (
              <div
                key={photo.id}
                className="relative group cursor-pointer"
                onClick={() => setSelectedPhoto(photo)}
              >
                <img
                  src={photo.thumbnailUrl || photo.url}
                  alt="Verification selfie"
                  className="w-full h-32 object-cover rounded-lg border transition-transform group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-opacity rounded-lg flex items-center justify-center">
                  <Eye className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <Badge className="absolute top-2 right-2 text-xs">
                  Selfie
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Photo Viewer Modal */}
      {selectedPhoto && (
        <PhotoViewer
          photo={selectedPhoto}
          isOpen={!!selectedPhoto}
          onClose={() => setSelectedPhoto(null)}
        />
      )}
    </div>
  );
};
