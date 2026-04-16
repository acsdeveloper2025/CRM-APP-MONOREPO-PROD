import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCaseAttachments } from '@/hooks/useCases';
import type { Attachment } from '@/services/attachments';
import { authenticatedFetch } from '@/services/api';
import { Upload, FileText, Image, Download, Eye, Trash2, Paperclip } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';

interface CaseAttachmentsSectionProps {
  caseId: string;
}

const ALLOWED_FILE_TYPES = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 10;

export const CaseAttachmentsSection: React.FC<CaseAttachmentsSectionProps> = ({ caseId }) => {
  const { data: attachmentsResponse, isLoading, refetch } = useCaseAttachments(caseId);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const attachments = (attachmentsResponse?.data || []) as Attachment[];

  const getAttachmentSize = (attachment: Attachment): number => {
    return Number(attachment.fileSize ?? attachment.size ?? 0);
  };

  const getAttachmentDate = (attachment: Attachment): string | null => {
    return attachment.createdAt || attachment.uploadedAt || null;
  };

  // Clean up object URL when dialog closes or component unmounts
  React.useEffect(() => {
    if (!showPreview && previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  }, [showPreview, previewUrl]);

  const validateFile = (file: File): string | null => {
    if (!Object.keys(ALLOWED_FILE_TYPES).includes(file.type)) {
      return `File type ${file.type} is not supported. Only PDF and image files are allowed.`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File size must be less than ${MAX_FILE_SIZE / (1024 * 1024)}MB`;
    }
    return null;
  };

  const handleFileSelect = (files: FileList | null) => {
    if (!files) {
      return;
    }

    const fileArray = Array.from(files);
    const validFiles: File[] = [];
    const errors: string[] = [];

    if (attachments.length + fileArray.length > MAX_FILES) {
      toast.error(`Maximum ${MAX_FILES} files allowed per case`);
      return;
    }

    fileArray.forEach((file) => {
      const error = validateFile(file);
      if (error) {
        errors.push(`${file.name}: ${error}`);
      } else {
        validFiles.push(file);
      }
    });

    if (errors.length > 0) {
      toast.error(errors.join('\n'));
    }

    if (validFiles.length > 0) {
      setSelectedFiles((prev) => [...prev, ...validFiles]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const removeSelectedFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async () => {
    if (selectedFiles.length === 0) {
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      selectedFiles.forEach((file) => {
        formData.append('files', file);
      });
      formData.append('caseId', caseId);
      formData.append('category', 'DOCUMENT');

      const response = await authenticatedFetch('/attachments/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      toast.success(`${selectedFiles.length} file(s) uploaded successfully`);
      setSelectedFiles([]);
      refetch();
    } catch (_error) {
      toast.error('Failed to upload files');
    } finally {
      setUploading(false);
    }
  };

  const deleteAttachment = async (attachmentId: string) => {
    try {
      const response = await authenticatedFetch(`/attachments/${attachmentId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Delete failed');
      }

      toast.success('Attachment deleted successfully');
      refetch();
    } catch (_error) {
      toast.error('Failed to delete attachment');
    }
  };

  const downloadAttachment = async (attachment: Attachment) => {
    try {
      const response = await authenticatedFetch(`/attachments/${attachment.id}/download`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = attachment.originalName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (_error) {
      toast.error('Failed to download attachment');
    }
  };

  const previewAttachmentHandler = async (attachment: Attachment) => {
    setPreviewAttachment(attachment);
    setShowPreview(true);

    if (attachment.mimeType.startsWith('image/')) {
      try {
        const response = await authenticatedFetch(`/attachments/${attachment.id}/serve`);
        if (response.ok) {
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          setPreviewUrl(url);
        } else {
          toast.error('Failed to load image preview');
        }
      } catch (error) {
        logger.error('Error loading preview:', error);
        toast.error('Failed to load image preview');
      }
    }
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) {
      return <Image className="h-4 w-4" />;
    }
    return <FileText className="h-4 w-4" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) {
      return '0 Bytes';
    }
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <Paperclip className="h-4 w-4 text-gray-600" />
        <span className="font-medium">Attachments</span>
        <Badge variant="secondary">{attachments.length}</Badge>
      </div>

      {/* Upload Area */}
      <div
        className={cn(
          'border-2 border-dashed rounded-lg p-6 text-center transition-colors',
          dragOver ? 'border-green-500 bg-green-50' : 'border-border',
          'hover:border-border'
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <Upload className="h-8 w-8 text-gray-600 mx-auto mb-2" />
        <p className="text-sm text-gray-600 mb-2">
          Drag and drop files here, or{' '}
          <button
            type="button"
            className="text-green-600 hover:text-green-700 underline"
            onClick={() => fileInputRef.current?.click()}
          >
            browse
          </button>
        </p>
        <p className="text-xs text-gray-600">
          PDF and image files only. Max 10MB per file, {MAX_FILES} files total.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.gif"
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
        />
      </div>

      {/* Selected Files for Upload */}
      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Files to Upload:</h4>
          {selectedFiles.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-2 bg-slate-100 dark:bg-slate-800/60 rounded"
            >
              <div className="flex items-center space-x-2">
                {getFileIcon(file.type)}
                <span className="text-sm">{file.name}</span>
                <span className="text-xs text-gray-600">({formatFileSize(file.size)})</span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => removeSelectedFile(index)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button onClick={uploadFiles} disabled={uploading} className="w-full">
            {uploading ? 'Uploading...' : `Upload ${selectedFiles.length} file(s)`}
          </Button>
        </div>
      )}

      {/* Existing Attachments */}
      {isLoading ? (
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600 mx-auto" />
          <p className="text-sm text-gray-600 mt-2">Loading attachments...</p>
        </div>
      ) : attachments.length > 0 ? (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Uploaded Files:</h4>
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex items-center justify-between p-3 border rounded-lg"
            >
              <div className="flex items-center space-x-3">
                {getFileIcon(attachment.mimeType)}
                <div>
                  <p className="text-sm font-medium">{attachment.originalName}</p>
                  <p className="text-xs text-gray-600">
                    {formatFileSize(getAttachmentSize(attachment))} •{' '}
                    {(() => {
                      const rawDate = getAttachmentDate(attachment);
                      if (!rawDate) {
                        return 'Unknown Date';
                      }
                      const parsed = new Date(rawDate);
                      return Number.isNaN(parsed.getTime())
                        ? 'Unknown Date'
                        : parsed.toLocaleDateString();
                    })()}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => previewAttachmentHandler(attachment)}
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => downloadAttachment(attachment)}>
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteAttachment(attachment.id)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-4 text-gray-600">
          <Paperclip className="h-8 w-8 mx-auto mb-2 text-gray-600" />
          <p className="text-sm">No attachments uploaded yet</p>
        </div>
      )}

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{previewAttachment?.originalName}</DialogTitle>
            <DialogDescription className="sr-only">
              Preview of the selected case attachment.
            </DialogDescription>
          </DialogHeader>
          {previewAttachment && (
            <div className="flex justify-center">
              {previewAttachment.mimeType.startsWith('image/') ? (
                previewUrl ? (
                  <img
                    src={previewUrl}
                    alt={previewAttachment.originalName}
                    loading="lazy"
                    decoding="async"
                    className="max-w-full max-h-[60vh] object-contain"
                  />
                ) : (
                  <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
                  </div>
                )
              ) : (
                <div className="text-center py-8">
                  <FileText className="h-16 w-16 mx-auto mb-4 text-gray-600" />
                  <p className="text-gray-600">Preview not available for this file type</p>
                  <Button onClick={() => downloadAttachment(previewAttachment)} className="mt-4">
                    <Download className="h-4 w-4 mr-2" />
                    Download to View
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
