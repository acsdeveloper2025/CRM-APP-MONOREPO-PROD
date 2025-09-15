import React, { useState, useEffect } from 'react';
import { Attachment } from '../types';
import { attachmentService } from '../services/attachmentService';
import Modal from './Modal';
import Spinner from './Spinner';
import { SecurityWrapper } from './SecurityWrapper';

interface AttachmentViewerProps {
  attachment: Attachment;
  isVisible: boolean;
  onClose: () => void;
}

const AttachmentViewer: React.FC<AttachmentViewerProps> = ({ attachment, isVisible, onClose }) => {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfLoaded, setPdfLoaded] = useState(false);
  const [imageScale, setImageScale] = useState(1);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (isVisible && attachment) {
      loadAttachmentContent();
    }
    // Reset state when modal closes
    if (!isVisible) {
      setContent(null);
      setError(null);
      setImageScale(1);
      setImagePosition({ x: 0, y: 0 });
      setPdfError(null);
      setPdfLoaded(false);
    }
  }, [isVisible, attachment]);

  const loadAttachmentContent = async () => {
    setLoading(true);
    setError(null);
    setContent(null);
    setPdfError(null);
    setPdfLoaded(false);

    try {
      console.log(`🔄 Loading attachment: ${attachment.name} (${attachment.type})`);
      const attachmentContent = await attachmentService.getAttachmentContent(attachment);

      // Log content type for debugging
      if (attachmentContent.startsWith('data:')) {
        console.log(`✅ Data URL loaded for ${attachment.name}:`, attachmentContent.substring(0, 50) + '...');
      } else {
        console.log(`✅ File path loaded for ${attachment.name}:`, attachmentContent);
      }

      setContent(attachmentContent);
    } catch (err) {
      console.error(`❌ Failed to load attachment ${attachment.name}:`, err);
      setError(err instanceof Error ? err.message : 'Failed to load attachment');
    } finally {
      setLoading(false);
    }
  };

  const handleImageZoom = (delta: number) => {
    setImageScale(prev => Math.max(0.5, Math.min(3, prev + delta)));
  };

  const handleImageReset = () => {
    setImageScale(1);
    setImagePosition({ x: 0, y: 0 });
  };



  const handlePdfLoad = () => {
    console.log('✅ PDF loaded successfully');
    setPdfLoaded(true);
    setPdfError(null);
  };

  const handlePdfError = (e: any) => {
    console.error('❌ PDF loading error:', e);
    setPdfError('Failed to load PDF content');
  };

  const renderPdfViewer = () => {

    return (
      <div className="w-full">
        <div className="bg-gray-800 rounded-lg p-4" style={{ minHeight: '600px' }}>
          <div className="w-full bg-white rounded-lg overflow-hidden" style={{ minHeight: '600px' }}>
            {/* PDF Viewer with enhanced error handling */}
            <div className="relative w-full" style={{ height: '600px' }}>
              {pdfError ? (
                // Error fallback
                <div className="flex flex-col items-center justify-center h-full bg-gray-50">
                  <div className="text-red-500 text-6xl mb-4">📄</div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">PDF Loading Error</h3>
                  <p className="text-gray-600 text-center mb-4">{pdfError}</p>
                  <button
                    onClick={() => {
                      setPdfError(null);
                      setPdfLoaded(false);
                      loadAttachmentContent();
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Retry Loading
                  </button>
                </div>
              ) : (
                <>
                  {/* Try iframe first, fallback to object tag */}
                  <iframe
                    src={content!}
                    className="w-full h-full border-0"
                    title={`${attachment.name}`}
                    style={{ width: '100%', height: '100%' }}
                    sandbox="allow-same-origin allow-scripts"
                    onLoad={handlePdfLoad}
                    onError={handlePdfError}
                    // Disable context menu and selection to prevent copying
                    onContextMenu={(e) => e.preventDefault()}
                  />

                  {/* Alternative PDF viewer using object tag (hidden by default) */}
                  <object
                    data={content!}
                    type="application/pdf"
                    className="w-full h-full absolute top-0 left-0 hidden"
                    style={{ width: '100%', height: '100%' }}
                    onLoad={() => console.log('Object PDF loaded')}
                  >
                    <p className="p-4 text-center text-gray-600">
                      Your browser doesn't support PDF viewing.
                      <br />
                      <span className="text-sm">Please use a modern browser with PDF support.</span>
                    </p>
                  </object>

                  {/* Loading overlay */}
                  {loading && !pdfLoaded && (
                    <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                        <p className="text-gray-600 text-sm">Loading PDF...</p>
                      </div>
                    </div>
                  )}

                  {/* PDF loaded indicator */}
                  {pdfLoaded && (
                    <div className="absolute top-2 right-2 bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                      ✓ PDF Loaded
                    </div>
                  )}
                </>
              )}
            </div>

            {/* PDF Controls */}
            <div className="bg-gray-100 px-4 py-2 border-t flex justify-between items-center">
              <span className="text-sm text-gray-600">
                📄 {attachment.name} • {attachmentService.formatFileSize(attachment.size)}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">PDF Document</span>
                {content?.startsWith('data:') && (
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                    Embedded
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderImageViewer = () => (
    <div className="w-full">
      <div className="bg-gray-800 rounded-lg p-4">
        {/* Image Controls */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleImageZoom(0.25)}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors"
              disabled={imageScale >= 3}
            >
              Zoom In
            </button>
            <button
              onClick={() => handleImageZoom(-0.25)}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors"
              disabled={imageScale <= 0.5}
            >
              Zoom Out
            </button>
            <button
              onClick={handleImageReset}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors"
            >
              Reset
            </button>
          </div>
          <span className="text-gray-400 text-sm">
            {Math.round(imageScale * 100)}%
          </span>
        </div>

        {/* Image Container */}
        <div 
          className="relative overflow-hidden rounded-lg bg-gray-900"
          style={{ minHeight: '400px', maxHeight: '70vh' }}
        >
          <img
            src={content!}
            alt={`${attachment.name}`}
            className="max-w-full max-h-full object-contain mx-auto"
            style={{
              transform: `scale(${imageScale}) translate(${imagePosition.x}px, ${imagePosition.y}px)`,
              transition: 'transform 0.2s ease',
              userSelect: 'none',
              pointerEvents: 'none' // Disable right-click and drag
            }}
            onError={() => setError('Failed to load image')}
            onContextMenu={(e) => e.preventDefault()}
            draggable={false}
          />
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center py-12">
          <Spinner size="large" />
          <p className="text-gray-400 mt-4">Loading {attachment.name}...</p>
          <p className="text-gray-500 text-sm mt-2">
            {attachmentService.formatFileSize(attachment.size)}
          </p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="text-red-400 text-6xl mb-4">❌</div>
          <p className="text-red-400 text-center mb-4">{error}</p>
          <button
            onClick={loadAttachmentContent}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors"
          >
            Try Again
          </button>
        </div>
      );
    }

    if (!content) {
      return (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="text-gray-400 text-6xl mb-4">📎</div>
          <p className="text-gray-400">No content available</p>
        </div>
      );
    }

    if (attachmentService.isPdfAttachment(attachment)) {
      return renderPdfViewer();
    }

    if (attachmentService.isImageAttachment(attachment)) {
      return renderImageViewer();
    }

    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="text-gray-400 text-6xl mb-4">📄</div>
        <p className="text-gray-400">Unsupported file type</p>
      </div>
    );
  };

  return (
    <Modal
      isVisible={isVisible}
      onClose={onClose}
      title={
        <div className="flex items-center gap-3">
          <span className="text-2xl">{attachmentService.getFileTypeIcon(attachment)}</span>
          <div>
            <h3 className="text-lg font-semibold text-white">{attachment.name}</h3>
            <div className="flex items-center gap-4 text-sm text-gray-400">
              <span>{attachmentService.formatFileSize(attachment.size)}</span>
              <span>{attachment.type.toUpperCase()}</span>
              <span>Attachment</span>
            </div>
          </div>
        </div>
      }
      size="extra-large"
    >
      <SecurityWrapper
        enableScreenshotPrevention={true}
        enableWatermark={true}
        watermarkText={`CaseFlow Mobile - ${attachment.name} - Confidential`}
        onSecurityViolation={(type) => {
          console.warn(`🚨 Security violation detected: ${type}`);
          // Could show a warning or log the incident
        }}
      >
        {renderContent()}
      </SecurityWrapper>
    </Modal>
  );
};

export default AttachmentViewer;
