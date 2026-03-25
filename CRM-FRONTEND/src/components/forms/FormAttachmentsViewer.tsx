import React, { useState } from 'react';
import { Camera, FileText, PenTool, Download, Eye, Clock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormAttachment } from '@/types/form';

interface FormAttachmentsViewerProps {
  attachments: FormAttachment[];
  readonly?: boolean;
}

export function FormAttachmentsViewer({ attachments, readonly: _readonly = true }: FormAttachmentsViewerProps) {
  const [selectedAttachment, setSelectedAttachment] = useState<FormAttachment | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const getAttachmentIcon = (category: FormAttachment['category']) => {
    switch (category) {
      case 'PHOTO':
        return <Camera className="h-4 w-4" />;
      case 'DOCUMENT':
        return <FileText className="h-4 w-4" />;
      case 'OTHER':
        return <PenTool className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getAttachmentTypeBadge = (category: FormAttachment['category']) => {
    const typeConfig = {
      PHOTO: { variant: 'default' as const, label: 'Photo' },
      DOCUMENT: { variant: 'secondary' as const, label: 'Document' },
      OTHER: { variant: 'outline' as const, label: 'Other' },
    };
    
    const config = typeConfig[category] || typeConfig.DOCUMENT;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) {return '0 Bytes';}
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))  } ${  sizes[i]}`;
  };

  const isImageFile = (mimeType: string) => {
    return mimeType.startsWith('image/');
  };

  const handlePreview = (attachment: FormAttachment) => {
    setSelectedAttachment(attachment);
    setShowPreview(true);
  };

  const handleDownload = (attachment: FormAttachment) => {
    // Create a temporary link to download the file
    const link = document.createElement('a');
    link.href = attachment.url;
    link.download = attachment.originalName;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const groupedAttachments = attachments.reduce((acc, attachment) => {
    if (!acc[attachment.category]) {
      acc[attachment.category] = [];
    }
    acc[attachment.category].push(attachment);
    return acc;
  }, {} as Record<string, FormAttachment[]>);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Camera className="h-5 w-5" />
            <span>Attachments</span>
            <Badge variant="outline">{attachments.length}</Badge>
          </CardTitle>
          <CardDescription>
            Photos, documents, and signatures captured during verification
          </CardDescription>
        </CardHeader>
        <CardContent>
          {attachments.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto text-gray-600 mb-2" />
              <p className="text-sm text-gray-600">No attachments found</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedAttachments).map(([category, categoryAttachments]) => (
                <div key={category}>
                  <div className="flex items-center space-x-2 mb-3">
                    {getAttachmentIcon(category as FormAttachment['category'])}
                    <h4 className="font-medium capitalize">{category.toLowerCase()}s</h4>
                    <Badge variant="outline" className="text-xs">
                      {categoryAttachments.length}
                    </Badge>
                  </div>
                  
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {categoryAttachments.map((attachment) => (
                      <div
                        key={attachment.id}
                        className="border rounded-lg p-4 hover:bg-slate-100/70 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center space-x-2">
                            {getAttachmentIcon(attachment.category)}
                            <span className="text-sm font-medium truncate">
                              {attachment.originalName}
                            </span>
                          </div>
                          {getAttachmentTypeBadge(attachment.category)}
                        </div>

                        {/* Image Preview */}
                        {isImageFile(attachment.mimeType) && (
                          <div className="mb-3">
                            <img
                              src={attachment.url}
                              alt={attachment.originalName}
                              className="w-full h-32 object-cover rounded-md cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={() => handlePreview(attachment)}
                            />
                          </div>
                        )}

                        {/* File Info */}
                        <div className="space-y-2 text-xs text-gray-600">
                          <div className="flex items-center justify-between">
                            <span>Size:</span>
                            <span>{formatFileSize(attachment.size)}</span>
                          </div>
                          
                          <div className="flex items-center space-x-1">
                            <Clock className="h-3 w-3" />
                            <span>{new Date(attachment.uploadedAt).toLocaleString()}</span>
                          </div>

                          <div className="text-xs">
                            <span className="font-medium">Filename:</span> {attachment.filename}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center space-x-2 mt-3">
                          {isImageFile(attachment.mimeType) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handlePreview(attachment)}
                              className="flex-1"
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              View
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownload(attachment)}
                            className="flex-1"
                          >
                            <Download className="h-3 w-3 mr-1" />
                            Download
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Image Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Camera className="h-5 w-5" />
              <span>{selectedAttachment?.originalName}</span>
              {selectedAttachment && getAttachmentTypeBadge(selectedAttachment.category)}
            </DialogTitle>
          </DialogHeader>
          
          {selectedAttachment && (
            <div className="space-y-4">
              {/* Image */}
              {isImageFile(selectedAttachment.mimeType) && (
                <div className="flex justify-center">
                  <img
                    src={selectedAttachment.url}
                    alt={selectedAttachment.originalName}
                    className="max-w-full max-h-[60vh] object-contain rounded-lg"
                  />
                </div>
              )}

              {/* Metadata */}
              <div className="grid gap-4 md:grid-cols-2 text-sm">
                <div>
                  <h4 className="font-medium mb-2">File Information</h4>
                  <div className="space-y-1 text-gray-600">
                    <div>Size: {formatFileSize(selectedAttachment.size)}</div>
                    <div>Type: {selectedAttachment.mimeType}</div>
                    <div>Uploaded: {new Date(selectedAttachment.uploadedAt).toLocaleString()}</div>
                    <div>Filename: {selectedAttachment.filename}</div>
                    <div>Original Name: {selectedAttachment.originalName}</div>
                  </div>
                </div>
              </div>


              {/* Actions */}
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => handleDownload(selectedAttachment)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
