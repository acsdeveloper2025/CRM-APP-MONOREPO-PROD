import React from 'react';
import { CapturedImage } from '../types';
import ImageCapture from './ImageCapture';

interface SelfieCaptureProps {
  images: CapturedImage[];
  onImagesChange: (images: CapturedImage[]) => void;
  isReadOnly?: boolean;
  required?: boolean;
  title?: string;
  compact?: boolean;
}

const SelfieCapture: React.FC<SelfieCaptureProps> = ({
  images,
  onImagesChange,
  isReadOnly = false,
  required = true,
  title,
  compact = false
}) => {
  // If compact mode, don't wrap in additional container
  if (compact) {
    return (
      <ImageCapture
        images={images}
        onImagesChange={onImagesChange}
        isReadOnly={isReadOnly}
        minImages={required ? 1 : 0}
        cameraDirection="front"
        componentType="selfie"
        title={title}
        required={required}
        compact={compact}
      />
    );
  }

  return (
    <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
      <ImageCapture
        images={images}
        onImagesChange={onImagesChange}
        isReadOnly={isReadOnly}
        minImages={required ? 1 : 0}
        cameraDirection="front"
        componentType="selfie"
        title={title}
        required={required}
        compact={compact}
      />

      {required && images.length === 0 && (
        <div className="mt-2 text-sm text-red-400">
          ⚠️ Selfie photo is required for verification
        </div>
      )}

      {images.length > 0 && (
        <div className="mt-2 text-sm text-green-400">
          ✅ Selfie photo captured successfully
        </div>
      )}
    </div>
  );
};

export default SelfieCapture;
