import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useCaseAttachments } from '@/hooks/useCases';
import {
  Upload,
  FileText,
  Image,
  Download,
  Eye,
  Trash2,
  Plus,
  Paperclip
} from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

interface CaseAttachmentsSectionProps {
  caseId: string;
}

interface Attachment {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  uploadedBy?: string;
  description?: string;
  category?: string;
}

const ALLOWED_FILE_TYPES = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg', 
  'image/png': '.png',
  'image/gif': '.gif'
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const attachments = attachmentsResponse?.data || [];

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
    if (!files) return;

    const fileArray = Array.from(files);
    const validFiles: File[] = [];
    const errors: string[] = [];

    if (attachments.length + fileArray.length > MAX_FILES) {
      toast.error(`Maximum ${MAX_FILES} files allowed per case`);
      return;
    }

    fileArray.forEach(file => {
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
      setSelectedFiles(prev => [...prev, ...validFiles]);
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
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Smart API URL selection
  const getApiBaseUrl = () => {
    const hostname = window.location.hostname;
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
    const isLocalNetwork = hostname.startsWith('10.') || hostname.startsWith('192.168.') || hostname.startsWith('172.');
    const staticIP = import.meta.env.VITE_STATIC_IP || '103.14.234.36';
    const isStaticIP = hostname === staticIP;
    const isDomain = hostname === 'crm.allcheckservices.com' || hostname === 'www.crm.allcheckservices.com';

    // Priority order for API URL selection:
    // 1. Check if we're on localhost (development)
    if (isLocalhost) {
      return 'http://localhost:3000/api';
    }

    // 2. Check if we're on the local network IP (hairpin NAT workaround)
    if (isLocalNetwork) {
      return `http://${staticIP}:3000/api`;
    }

    // 3. Check if we're on the domain name (production access)
    if (isDomain) {
      return 'https://crm.allcheckservices.com/api';
    }

    // 4. Check if we're on the static IP (external access)
    if (isStaticIP) {
      return `http://${staticIP}:3000/api`;
    }

    // 5. Fallback to environment variable or localhost
    return import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';
  };

  const uploadFiles = async () => {
    if (selectedFiles.length === 0) return;

    setUploading(true);
    try {
      const formData = new FormData();
      selectedFiles.forEach(file => {
        formData.append('files', file);
      });
      formData.append('caseId', caseId);
      formData.append('category', 'DOCUMENT');

      const apiBaseUrl = getApiBaseUrl();
      const response = await fetch(`${apiBaseUrl}/attachments/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      toast.success(`${selectedFiles.length} file(s) uploaded successfully`);
      setSelectedFiles([]);
      refetch();
    } catch (error) {
      toast.error('Failed to upload files');
    } finally {
      setUploading(false);
    }
  };

  const deleteAttachment = async (attachmentId: string) => {
    try {
      const apiBaseUrl = getApiBaseUrl();
      const response = await fetch(`${apiBaseUrl}/attachments/${attachmentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Delete failed');
      }

      toast.success('Attachment deleted successfully');
      refetch();
    } catch (error) {
      toast.error('Failed to delete attachment');
    }
  };

  const downloadAttachment = async (attachment: Attachment) => {
    try {
      const apiBaseUrl = getApiBaseUrl();
      const response = await fetch(`${apiBaseUrl}/attachments/${attachment.id}/download`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
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
    } catch (error) {
      toast.error('Failed to download attachment');
    }
  };

  const previewAttachmentHandler = (attachment: Attachment) => {
    setPreviewAttachment(attachment);
    setShowPreview(true);
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) {
      return <Image className="h-4 w-4" />;
    }
    return <FileText className="h-4 w-4" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <Paperclip className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">Attachments</span>
        <Badge variant="secondary">{attachments.length}</Badge>
      </div>

      {/* Upload Area */}
      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-6 text-center transition-colors",
          dragOver ? "border-blue-500 bg-blue-50" : "border-border",
          "hover:border-border"
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground mb-2">
          Drag and drop files here, or{' '}
          <button
            type="button"
            className="text-blue-600 hover:text-blue-700 underline"
            onClick={() => fileInputRef.current?.click()}
          >
            browse
          </button>
        </p>
        <p className="text-xs text-muted-foreground">
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
            <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
              <div className="flex items-center space-x-2">
                {getFileIcon(file.type)}
                <span className="text-sm">{file.name}</span>
                <span className="text-xs text-muted-foreground">({formatFileSize(file.size)})</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeSelectedFile(index)}
              >
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
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-sm text-muted-foreground mt-2">Loading attachments...</p>
        </div>
      ) : attachments.length > 0 ? (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Uploaded Files:</h4>
          {attachments.map((attachment) => (
            <div key={attachment.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center space-x-3">
                {getFileIcon(attachment.mimeType)}
                <div>
                  <p className="text-sm font-medium">{attachment.originalName}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(attachment.size)} • {new Date(attachment.uploadedAt).toLocaleDateString()}
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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => downloadAttachment(attachment)}
                >
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
        <div className="text-center py-4 text-muted-foreground">
          <Paperclip className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm">No attachments uploaded yet</p>
        </div>
      )}

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{previewAttachment?.originalName}</DialogTitle>
          </DialogHeader>
          {previewAttachment && (
            <div className="flex justify-center">
              {previewAttachment.mimeType.startsWith('image/') ? (
                <img
                  src={`${getApiBaseUrl()}/attachments/${previewAttachment.id}/serve?token=${localStorage.getItem('accessToken')}`}
                  alt={previewAttachment.originalName}
                  className="max-w-full max-h-[60vh] object-contain"
                  onError={(e) => {
                    // Fallback if serve endpoint fails
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <div className="text-center py-8">
                  <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">Preview not available for this file type</p>
                  <Button
                    onClick={() => downloadAttachment(previewAttachment)}
                    className="mt-4"
                  >
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
