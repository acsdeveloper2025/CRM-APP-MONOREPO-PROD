import React, { useState, useEffect } from 'react';
import { Attachment } from '../types';
import { attachmentService } from '../services/attachmentService';
import Modal from './Modal';
import AttachmentViewer from './AttachmentViewer';
import Spinner from './Spinner';

interface AttachmentsModalProps {
  caseId: string;
  isVisible: boolean;
  onClose: () => void;
}

const AttachmentsModal: React.FC<AttachmentsModalProps> = ({ caseId, isVisible, onClose }) => {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAttachment, setSelectedAttachment] = useState<Attachment | null>(null);
  const [viewerVisible, setViewerVisible] = useState(false);

  useEffect(() => {
    if (isVisible && caseId) {
      fetchAttachments();
    }
    // Reset state when modal closes
    if (!isVisible) {
      setAttachments([]);
      setError(null);
      setSelectedAttachment(null);
      setViewerVisible(false);
    }
  }, [isVisible, caseId]);

  const fetchAttachments = async () => {
    setLoading(true);
    setError(null);

    try {
      const caseAttachments = await attachmentService.getCaseAttachments(caseId);
      setAttachments(caseAttachments);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load attachments');
    } finally {
      setLoading(false);
    }
  };

  const handleAttachmentClick = (attachment: Attachment) => {
    setSelectedAttachment(attachment);
    setViewerVisible(true);
  };

  const handleViewerClose = () => {
    setViewerVisible(false);
    setSelectedAttachment(null);
  };

  const renderAttachmentItem = (attachment: Attachment) => (
    <div
      key={attachment.id}
      onClick={() => handleAttachmentClick(attachment)}
      className="flex items-center gap-4 p-4 bg-gray-800 rounded-lg hover:bg-gray-700 cursor-pointer transition-colors group"
    >
      {/* File Icon */}
      <div className="flex-shrink-0">
        <div className="w-12 h-12 bg-gray-700 rounded-lg flex items-center justify-center text-2xl group-hover:bg-gray-600 transition-colors">
          {attachmentService.getFileTypeIcon(attachment)}
        </div>
      </div>

      {/* File Info */}
      <div className="flex-1 min-w-0">
        <h4 className="text-white font-medium truncate group-hover:text-blue-300 transition-colors">
          {attachment.name}
        </h4>
        <div className="flex items-center gap-4 mt-1 text-sm text-gray-400">
          <span className="uppercase font-medium">{attachment.type}</span>
          <span>{attachmentService.formatFileSize(attachment.size)}</span>
          <span>
            {new Date(attachment.uploadedAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            })}
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Uploaded by {attachment.uploadedBy}
        </p>
        {attachment.description && (
          <p className="text-xs text-gray-400 mt-1 truncate">
            {attachment.description}
          </p>
        )}
      </div>

      {/* View Indicator */}
      <div className="flex-shrink-0">
        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center group-hover:bg-blue-500 transition-colors">
          <span className="text-white text-xs">👁️</span>
        </div>
      </div>
    </div>
  );



  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center py-12">
          <Spinner size="large" />
          <p className="text-gray-400 mt-4">Loading attachments...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="text-red-400 text-6xl mb-4">❌</div>
          <p className="text-red-400 text-center mb-4">{error}</p>
          <button
            onClick={fetchAttachments}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors"
          >
            Try Again
          </button>
        </div>
      );
    }

    if (attachments.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="text-gray-400 text-6xl mb-4">📎</div>
          <h3 className="text-white text-lg font-medium mb-2">No Attachments</h3>
          <p className="text-gray-400 text-center">
            This case doesn't have any attachments yet.
          </p>
        </div>
      );
    }

    return (
      <div>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {attachments.map(renderAttachmentItem)}
        </div>
      </div>
    );
  };



  return (
    <>
      <Modal
        isVisible={isVisible}
        onClose={onClose}
        title={
          <div className="flex items-center gap-2">
            <span className="text-2xl">📎</span>
            <div>
              <h3 className="text-lg font-semibold text-white">Case Attachments</h3>
              <p className="text-sm text-gray-400">
                {loading ? 'Loading...' : `${attachments.length} attachment${attachments.length !== 1 ? 's' : ''}`}
              </p>
            </div>
          </div>
        }
        size="large"
      >
        {renderContent()}
      </Modal>

      {/* Attachment Viewer */}
      {selectedAttachment && (
        <AttachmentViewer
          attachment={selectedAttachment}
          isVisible={viewerVisible}
          onClose={handleViewerClose}
        />
      )}
    </>
  );
};

export default AttachmentsModal;
