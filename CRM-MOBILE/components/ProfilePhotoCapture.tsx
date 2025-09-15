
import React, { useState, useRef, useEffect, useCallback } from 'react';
import Spinner from './Spinner';
import { CameraIcon } from './Icons';

interface ProfilePhotoCaptureProps {
  onSave: (dataUrl: string) => void;
  onCancel: () => void;
}

const ProfilePhotoCapture: React.FC<ProfilePhotoCaptureProps> = ({ onSave, onCancel }) => {
  const [error, setError] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);
  
  useEffect(() => {
    const startCamera = async () => {
        setError(null);
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
                streamRef.current = stream;
                if (videoRef.current) {
                videoRef.current.srcObject = stream;
                }
            } catch (err) {
                console.error("Error accessing camera:", err);
                setError("Could not access the camera. Please check permissions.");
            }
        } else {
            setError("Camera not supported on this device.");
        }
    }
    
    startCamera();

    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const handleTakePhoto = () => {
    setError(null);
    const video = videoRef.current;
    if (!video) {
        setError("Video element not found.");
        return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) {
        setError("Could not get canvas context.");
        return;
    }
    
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedImage(dataUrl);
    stopCamera();
  };

  if (error) {
    return <p className="text-sm text-red-400 text-center">{error}</p>;
  }

  if (capturedImage) {
    return (
        <div>
            <img src={capturedImage} alt="Captured Profile" className="w-full h-auto rounded-lg"/>
            <div className="flex justify-center gap-4 mt-4">
                <button onClick={() => setCapturedImage(null)} className="px-4 py-2 rounded-md bg-gray-600 hover:bg-gray-500 text-light-text font-semibold">Retake</button>
                <button onClick={() => onSave(capturedImage)} className="px-4 py-2 rounded-md bg-brand-primary hover:bg-brand-secondary text-white font-semibold">Save Photo</button>
            </div>
        </div>
    );
  }

  return (
    <div className="relative">
      <video ref={videoRef} autoPlay playsInline className="w-full h-auto rounded-lg bg-black" />
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent flex justify-center">
        <button
          onClick={handleTakePhoto}
          className="w-16 h-16 rounded-full bg-white/90 hover:bg-white border-4 border-white/30 flex items-center justify-center"
          aria-label="Take Photo"
        >
          <div className="w-12 h-12 rounded-full bg-white ring-2 ring-inset ring-gray-600" />
        </button>
      </div>
    </div>
  );
};

export default ProfilePhotoCapture;