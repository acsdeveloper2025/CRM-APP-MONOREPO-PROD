import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Upload, 
  FileText, 
  Image, 
  Download, 
  Eye, 
  Trash2, 
  Plus,
  AlertCircle,
  Paperclip
} from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

export interface CaseFormAttachment {
  id: string;
  file: File;
  name: string;
  size: number;
  type: 'pdf' | 'image';
  mimeType: string;
  preview?: string;
}

interface CaseFormAttachmentsSectionProps {
  attachments: CaseFormAttachment[];
  onAttachmentsChange: (attachments: CaseFormAttachment[]) => void;
  maxFiles?: number;
  maxFileSize?: number;
}

const MAX_FILES = 10;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

export const CaseFormAttachmentsSection: React.FC<CaseFormAttachmentsSectionProps> = ({
  attachments,
  onAttachmentsChange,
  maxFiles = MAX_FILES,
  maxFileSize = MAX_FILE_SIZE
}) => {
  const [dragOver, setDragOver] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewAttachment, setPreviewAttachment] = useState<CaseFormAttachment | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return `${file.name}: Only PDF, image files (JPG, PNG, GIF), and Word documents (DOC, DOCX) are allowed`;
    }
    if (file.size > maxFileSize) {
      return `${file.name}: File size must be less than ${Math.round(maxFileSize / 1024 / 1024)}MB`;
    }
    return null;
  };

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;

    const fileArray = Array.from(files);
    const errors: string[] = [];
    const validFiles: File[] = [];

    // Check total file count
    if (attachments.length + fileArray.length > maxFiles) {
      toast.error(`Maximum ${maxFiles} files allowed`);
      return;
    }

    // Validate each file
    fileArray.forEach(file => {
      const error = validateFile(file);
      if (error) {
        errors.push(error);
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

  const addFiles = async () => {
    if (selectedFiles.length === 0) return;

    const newAttachments: CaseFormAttachment[] = [];

    for (const file of selectedFiles) {
      const getFileType = (mimeType: string): 'pdf' | 'image' => {
        if (mimeType.startsWith('image/')) return 'image';
        return 'pdf'; // Treat PDF and Word documents as 'pdf' type for UI purposes
      };

      const attachment: CaseFormAttachment = {
        id: `temp-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        file,
        name: file.name,
        size: file.size,
        type: getFileType(file.type),
        mimeType: file.type,
      };

      // Generate preview for images
      if (file.type.startsWith('image/')) {
        try {
          const preview = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
          attachment.preview = preview;
        } catch (error) {
          console.error('Failed to generate preview:', error);
        }
      }

      newAttachments.push(attachment);
    }

    onAttachmentsChange([...attachments, ...newAttachments]);
    setSelectedFiles([]);
    toast.success(`${newAttachments.length} file(s) added`);
  };

  const removeAttachment = (id: string) => {
    const updatedAttachments = attachments.filter(att => att.id !== id);
    onAttachmentsChange(updatedAttachments);
    toast.success('File removed');
  };

  const removeSelectedFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const previewAttachmentHandler = (attachment: CaseFormAttachment) => {
    if (attachment.type === 'image' && attachment.preview) {
      setPreviewAttachment(attachment);
      setShowPreview(true);
    } else {
      toast('Preview not available for this file type');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (type: string) => {
    if (type === 'image') {
      return <Image className="h-4 w-4 text-blue-500" />;
    }
    return <FileText className="h-4 w-4 text-red-500" />;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Paperclip className="h-5 w-5" />
          <span>Attachments</span>
          <Badge variant="secondary">{attachments.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* File Upload Area */}
        <div
          className={cn(
            "border-2 border-dashed rounded-lg p-6 text-center transition-colors",
            dragOver ? "border-blue-500 bg-blue-50" : "border-border",
            attachments.length >= maxFiles ? "opacity-50 pointer-events-none" : "hover:border-border"
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
              disabled={attachments.length >= maxFiles}
            >
              browse
            </button>
          </p>
          <p className="text-xs text-muted-foreground">
            PDF, image files (JPG, PNG, GIF), and Word documents (DOC, DOCX) only. Max {Math.round(maxFileSize / 1024 / 1024)}MB per file, {maxFiles} files total.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.gif,.doc,.docx"
            onChange={(e) => handleFileSelect(e.target.files)}
            className="hidden"
            disabled={attachments.length >= maxFiles}
          />
        </div>

        {/* Selected Files (pending upload) */}
        {selectedFiles.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm">Selected Files</h4>
              <div className="space-x-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={addFiles}
                  className="h-8"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Files
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedFiles([])}
                  className="h-8"
                >
                  Clear
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              {selectedFiles.map((file, index) => (
                <div key={index} className="flex items-center space-x-3 p-3 border rounded-lg bg-blue-50">
                  {getFileIcon(file.type.startsWith('image/') ? 'image' : 'pdf')}
                  <div className="flex-1">
                    <div className="font-medium text-sm">{file.name}</div>
                    <div className="text-xs text-muted-foreground">{formatFileSize(file.size)}</div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeSelectedFile(index)}
                    className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Attached Files */}
        {attachments.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Attached Files</h4>
            <div className="space-y-2">
              {attachments.map((attachment) => (
                <div key={attachment.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                  {getFileIcon(attachment.type)}
                  <div className="flex-1">
                    <div className="font-medium text-sm">{attachment.name}</div>
                    <div className="text-xs text-muted-foreground">{formatFileSize(attachment.size)}</div>
                  </div>
                  <div className="flex space-x-1">
                    {attachment.type === 'image' && attachment.preview && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => previewAttachmentHandler(attachment)}
                        className="h-8 w-8 p-0"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeAttachment(attachment.id)}
                      className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Preview Dialog */}
        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>{previewAttachment?.name}</DialogTitle>
            </DialogHeader>
            {previewAttachment?.preview && (
              <div className="flex justify-center">
                <img
                  src={previewAttachment.preview}
                  alt={previewAttachment.name}
                  className="max-w-full max-h-[70vh] object-contain"
                />
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};
