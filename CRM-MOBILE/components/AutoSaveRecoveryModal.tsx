import React, { useState } from 'react';
import { AutoSaveData } from '../services/autoSaveService';
import Modal from './Modal';
import { ClockIcon, DocumentTextIcon, PhotoIcon, MapPinIcon, ExclamationTriangleIcon } from './Icons';

interface AutoSaveRecoveryModalProps {
  isVisible: boolean;
  savedData: AutoSaveData | null;
  onRestore: (data: AutoSaveData) => void;
  onDiscard: () => void;
  onCancel: () => void;
}

const AutoSaveRecoveryModal: React.FC<AutoSaveRecoveryModalProps> = ({
  isVisible,
  savedData,
  onRestore,
  onDiscard,
  onCancel
}) => {
  const [isRestoring, setIsRestoring] = useState(false);
  const [isDiscarding, setIsDiscarding] = useState(false);

  if (!savedData) return null;

  const handleRestore = async () => {
    setIsRestoring(true);
    try {
      await onRestore(savedData);
    } finally {
      setIsRestoring(false);
    }
  };

  const handleDiscard = async () => {
    setIsDiscarding(true);
    try {
      await onDiscard();
    } finally {
      setIsDiscarding(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  };

  const getFormProgress = () => {
    const { formData } = savedData;
    if (!formData || typeof formData !== 'object') return 0;

    const fields = Object.values(formData).filter(value => 
      value !== null && value !== undefined && value !== ''
    );
    const totalFields = Object.keys(formData).length;
    
    if (totalFields === 0) return 0;
    return Math.round((fields.length / totalFields) * 100);
  };

  const { date, time } = formatDate(savedData.lastSaved);
  const progress = getFormProgress();

  return (
    <Modal
      isVisible={isVisible}
      onClose={onCancel}
      title="Recover Saved Draft"
      size="large"
    >
      <div className="space-y-6">
        {/* Warning Header */}
        <div className="flex items-start gap-3 p-4 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
          <ExclamationTriangleIcon width={20} height={20} className="text-yellow-400 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-semibold text-yellow-400 mb-1">Draft Found</h4>
            <p className="text-sm text-yellow-200">
              We found a saved draft of this form. Would you like to restore your previous work or start fresh?
            </p>
          </div>
        </div>

        {/* Draft Information */}
        <div className="bg-dark-card/50 rounded-lg p-4 border border-dark-border">
          <h5 className="font-semibold text-light-text mb-4 flex items-center gap-2">
            <DocumentTextIcon width={18} height={18} />
            Draft Information
          </h5>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Basic Info */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <ClockIcon width={14} height={14} className="text-medium-text" />
                <span className="text-medium-text">Last saved:</span>
                <span className="text-light-text font-medium">{date} at {time}</span>
              </div>
              
              <div className="flex items-center gap-2 text-sm">
                <DocumentTextIcon width={14} height={14} className="text-medium-text" />
                <span className="text-medium-text">Form type:</span>
                <span className="text-light-text font-medium capitalize">{savedData.formType}</span>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <span className="text-medium-text">Case ID:</span>
                <span className="text-light-text font-medium font-mono">{savedData.caseId}</span>
              </div>
            </div>

            {/* Progress and Images */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-medium-text">Progress:</span>
                <div className="flex-1 bg-dark-border rounded-full h-2">
                  <div 
                    className="bg-brand-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-light-text font-medium">{progress}%</span>
              </div>

              {savedData.images.length > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <PhotoIcon width={14} height={14} className="text-medium-text" />
                  <span className="text-medium-text">Images:</span>
                  <span className="text-light-text font-medium">{savedData.images.length} captured</span>
                </div>
              )}

              {savedData.images.length > 0 && savedData.images[0].latitude && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPinIcon width={14} height={14} className="text-medium-text" />
                  <span className="text-medium-text">Location:</span>
                  <span className="text-light-text font-medium">GPS tagged</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Image Preview */}
        {savedData.images.length > 0 && (
          <div className="bg-dark-card/50 rounded-lg p-4 border border-dark-border">
            <h5 className="font-semibold text-light-text mb-3 flex items-center gap-2">
              <PhotoIcon width={18} height={18} />
              Captured Images ({savedData.images.length})
            </h5>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {savedData.images.slice(0, 6).map((image, index) => (
                <div key={image.id} className="relative aspect-square">
                  <img
                    src={image.dataUrl}
                    alt={`Captured ${index + 1}`}
                    className="w-full h-full object-cover rounded border border-dark-border"
                  />
                  {index === 5 && savedData.images.length > 6 && (
                    <div className="absolute inset-0 bg-black/70 rounded flex items-center justify-center">
                      <span className="text-white text-xs font-medium">
                        +{savedData.images.length - 6}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-dark-border">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-3 text-sm font-semibold rounded-md bg-gray-600 hover:bg-gray-500 text-white transition-colors"
            disabled={isRestoring || isDiscarding}
          >
            Cancel
          </button>
          
          <button
            onClick={handleDiscard}
            disabled={isRestoring || isDiscarding}
            className="flex-1 px-4 py-3 text-sm font-semibold rounded-md bg-red-600 hover:bg-red-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDiscarding ? 'Discarding...' : 'Start Fresh'}
          </button>
          
          <button
            onClick={handleRestore}
            disabled={isRestoring || isDiscarding}
            className="flex-1 px-4 py-3 text-sm font-semibold rounded-md bg-brand-primary hover:bg-brand-secondary text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isRestoring ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Restoring...
              </>
            ) : (
              <>
                <DocumentTextIcon width={16} height={16} />
                Restore Draft
              </>
            )}
          </button>
        </div>

        {/* Additional Info */}
        <div className="text-xs text-medium-text bg-dark-card/30 rounded p-3">
          <p className="mb-1">
            <strong>Restore Draft:</strong> Continue where you left off with all your previous data and images.
          </p>
          <p>
            <strong>Start Fresh:</strong> Begin a new form and permanently delete the saved draft.
          </p>
        </div>
      </div>
    </Modal>
  );
};

export default AutoSaveRecoveryModal;
