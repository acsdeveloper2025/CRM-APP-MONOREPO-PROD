import React, { useState, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Clock, Wifi, WifiOff, RotateCcw } from 'lucide-react';
import progressTrackingService, { SubmissionProgress, SubmissionStep } from '../services/progressTrackingService';
import retryService from '../services/retryService';

interface SubmissionProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  submissionId: string;
  caseId: string;
}

export const SubmissionProgressModal: React.FC<SubmissionProgressModalProps> = ({
  isOpen,
  onClose,
  submissionId,
  caseId
}) => {
  const [progress, setProgress] = useState<SubmissionProgress | null>(null);
  const [retryQueue, setRetryQueue] = useState({ pending: 0, retrying: 0, failed: 0 });

  useEffect(() => {
    if (!isOpen || !submissionId) return;

    // Subscribe to progress updates
    const unsubscribe = progressTrackingService.subscribeToProgress(submissionId, setProgress);

    // Update retry queue status
    const updateRetryStatus = () => {
      setRetryQueue(retryService.getQueueStatus());
    };

    updateRetryStatus();
    const retryInterval = setInterval(updateRetryStatus, 2000);

    return () => {
      unsubscribe();
      clearInterval(retryInterval);
    };
  }, [isOpen, submissionId]);

  if (!isOpen || !progress) return null;

  const getStepIcon = (step: SubmissionStep) => {
    switch (step.status) {
      case 'COMPLETED':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'FAILED':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'IN_PROGRESS':
        return <div className="h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />;
      default:
        return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'text-green-600 bg-green-50';
      case 'FAILED':
        return 'text-red-600 bg-red-50';
      case 'SUBMITTING':
        return 'text-blue-600 bg-blue-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Submission Progress</h3>
            <p className="text-sm text-gray-600">Case #{caseId}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Overall Progress */}
        <div className="p-6 border-b">
          <div className="flex items-center justify-between mb-2">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(progress.status)}`}>
              {progress.status.replace('_', ' ')}
            </span>
            <span className="text-sm font-medium text-gray-900">
              {progress.overallProgress}%
            </span>
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress.overallProgress}%` }}
            />
          </div>

          {/* Time and Data Info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            {progress.estimatedTimeRemaining && progress.estimatedTimeRemaining > 0 && (
              <div>
                <span className="text-gray-600">Time remaining:</span>
                <p className="font-medium">{formatTime(progress.estimatedTimeRemaining)}</p>
              </div>
            )}
            
            {progress.bytesUploaded !== undefined && progress.totalBytes && (
              <div>
                <span className="text-gray-600">Data uploaded:</span>
                <p className="font-medium">
                  {formatBytes(progress.bytesUploaded)} / {formatBytes(progress.totalBytes)}
                </p>
              </div>
            )}
            
            {progress.uploadSpeed && progress.uploadSpeed > 0 && (
              <div>
                <span className="text-gray-600">Upload speed:</span>
                <p className="font-medium">{formatBytes(progress.uploadSpeed)}/s</p>
              </div>
            )}
          </div>
        </div>

        {/* Steps */}
        <div className="p-6">
          <h4 className="text-sm font-medium text-gray-900 mb-4">Progress Steps</h4>
          <div className="space-y-4">
            {progress.steps.map((step, index) => (
              <div key={step.id} className="flex items-start space-x-3">
                <div className="flex-shrink-0 mt-0.5">
                  {getStepIcon(step)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900">{step.name}</p>
                    {step.status === 'IN_PROGRESS' && (
                      <span className="text-xs text-gray-500">{step.progress}%</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600">{step.description}</p>
                  
                  {step.status === 'IN_PROGRESS' && (
                    <div className="mt-2 w-full bg-gray-200 rounded-full h-1">
                      <div
                        className="bg-blue-600 h-1 rounded-full transition-all duration-300"
                        style={{ width: `${step.progress}%` }}
                      />
                    </div>
                  )}
                  
                  {step.error && (
                    <p className="text-xs text-red-600 mt-1">{step.error}</p>
                  )}
                  
                  {step.metadata?.retryAttempt && (
                    <p className="text-xs text-orange-600 mt-1">
                      Retry attempt {step.metadata.retryAttempt} of {step.metadata.maxAttempts}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Retry Queue Status */}
        {(retryQueue.pending > 0 || retryQueue.failed > 0) && (
          <div className="p-6 border-t bg-gray-50">
            <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
              <RotateCcw className="h-4 w-4 mr-2" />
              Retry Queue Status
            </h4>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-lg font-semibold text-orange-600">{retryQueue.pending}</p>
                <p className="text-xs text-gray-600">Pending</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-blue-600">{retryQueue.retrying}</p>
                <p className="text-xs text-gray-600">Retrying</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-red-600">{retryQueue.failed}</p>
                <p className="text-xs text-gray-600">Failed</p>
              </div>
            </div>
          </div>
        )}

        {/* Network Status */}
        <div className="p-4 border-t bg-gray-50">
          <div className="flex items-center justify-center space-x-2 text-sm">
            {navigator.onLine ? (
              <>
                <Wifi className="h-4 w-4 text-green-500" />
                <span className="text-green-600">Online</span>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4 text-red-500" />
                <span className="text-red-600">Offline - Will retry when connection restored</span>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 border-t">
          <div className="flex space-x-3">
            {progress.status === 'COMPLETED' && (
              <button
                onClick={onClose}
                className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition-colors"
              >
                Done
              </button>
            )}
            
            {progress.status === 'FAILED' && (
              <>
                <button
                  onClick={onClose}
                  className="flex-1 bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    // Trigger retry logic here
                    console.log('Retry submission');
                  }}
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
                >
                  Retry
                </button>
              </>
            )}
            
            {(progress.status === 'PREPARING' || progress.status === 'SUBMITTING') && (
              <button
                onClick={onClose}
                className="flex-1 bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700 transition-colors"
              >
                Run in Background
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
