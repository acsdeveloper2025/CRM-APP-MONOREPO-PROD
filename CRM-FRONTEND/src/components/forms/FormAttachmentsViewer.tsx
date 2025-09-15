import React, { useState } from 'react';
import { Camera, FileText, PenTool, Download, Eye, MapPin, Clock, Maximize2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormAttachment } from '@/types/form';

interface FormAttachmentsViewerProps {
  attachments: FormAttachment[];
  readonly?: boolean;
}

export function FormAttachmentsViewer({ attachments, readonly = true }: FormAttachmentsViewerProps) {
  const [selectedAttachment, setSelectedAttachment] = useState<FormAttachment | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const getAttachmentIcon = (type: FormAttachment['type']) => {
    switch (type) {
      case 'photo':
        return <Camera className="h-4 w-4" />;
      case 'document':
        return <FileText className="h-4 w-4" />;
      case 'signature':
        return <PenTool className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getAttachmentTypeBadge = (type: FormAttachment['type']) => {
    const typeConfig = {
      photo: { variant: 'default' as const, label: 'Photo' },
      document: { variant: 'secondary' as const, label: 'Document' },
      signature: { variant: 'outline' as const, label: 'Signature' },
    };
    
    const config = typeConfig[type] || typeConfig.document;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
    link.download = attachment.name;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const groupedAttachments = attachments.reduce((acc, attachment) => {
    if (!acc[attachment.type]) {
      acc[attachment.type] = [];
    }
    acc[attachment.type].push(attachment);
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
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No attachments found</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedAttachments).map(([type, typeAttachments]) => (
                <div key={type}>
                  <div className="flex items-center space-x-2 mb-3">
                    {getAttachmentIcon(type as FormAttachment['type'])}
                    <h4 className="font-medium capitalize">{type}s</h4>
                    <Badge variant="outline" className="text-xs">
                      {typeAttachments.length}
                    </Badge>
                  </div>
                  
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {typeAttachments.map((attachment) => (
                      <div
                        key={attachment.id}
                        className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center space-x-2">
                            {getAttachmentIcon(attachment.type)}
                            <span className="text-sm font-medium truncate">
                              {attachment.name}
                            </span>
                          </div>
                          {getAttachmentTypeBadge(attachment.type)}
                        </div>

                        {/* Image Preview */}
                        {isImageFile(attachment.mimeType) && (
                          <div className="mb-3">
                            <img
                              src={attachment.url}
                              alt={attachment.name}
                              className="w-full h-32 object-cover rounded-md cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={() => handlePreview(attachment)}
                            />
                          </div>
                        )}

                        {/* File Info */}
                        <div className="space-y-2 text-xs text-muted-foreground">
                          <div className="flex items-center justify-between">
                            <span>Size:</span>
                            <span>{formatFileSize(attachment.size)}</span>
                          </div>
                          
                          <div className="flex items-center space-x-1">
                            <Clock className="h-3 w-3" />
                            <span>{new Date(attachment.capturedAt).toLocaleString()}</span>
                          </div>

                          {attachment.location && (
                            <div className="flex items-center space-x-1">
                              <MapPin className="h-3 w-3" />
                              <span>
                                {attachment.location.latitude.toFixed(6)}, {attachment.location.longitude.toFixed(6)}
                              </span>
                            </div>
                          )}

                          {attachment.description && (
                            <div className="text-xs">
                              <span className="font-medium">Note:</span> {attachment.description}
                            </div>
                          )}
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
              <span>{selectedAttachment?.name}</span>
              {selectedAttachment && getAttachmentTypeBadge(selectedAttachment.type)}
            </DialogTitle>
          </DialogHeader>
          
          {selectedAttachment && (
            <div className="space-y-4">
              {/* Image */}
              {isImageFile(selectedAttachment.mimeType) && (
                <div className="flex justify-center">
                  <img
                    src={selectedAttachment.url}
                    alt={selectedAttachment.name}
                    className="max-w-full max-h-[60vh] object-contain rounded-lg"
                  />
                </div>
              )}

              {/* Metadata */}
              <div className="grid gap-4 md:grid-cols-2 text-sm">
                <div>
                  <h4 className="font-medium mb-2">File Information</h4>
                  <div className="space-y-1 text-muted-foreground">
                    <div>Size: {formatFileSize(selectedAttachment.size)}</div>
                    <div>Type: {selectedAttachment.mimeType}</div>
                    <div>Captured: {new Date(selectedAttachment.capturedAt).toLocaleString()}</div>
                  </div>
                </div>

                {selectedAttachment.location && (
                  <div>
                    <h4 className="font-medium mb-2">Location Information</h4>
                    <div className="space-y-1 text-muted-foreground">
                      <div>Latitude: {selectedAttachment.location.latitude.toFixed(6)}</div>
                      <div>Longitude: {selectedAttachment.location.longitude.toFixed(6)}</div>
                      <div>Accuracy: {selectedAttachment.location.accuracy}m</div>
                      {selectedAttachment.location.address && (
                        <div>Address: {selectedAttachment.location.address}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {selectedAttachment.description && (
                <div>
                  <h4 className="font-medium mb-2">Description</h4>
                  <p className="text-sm text-muted-foreground">
                    {selectedAttachment.description}
                  </p>
                </div>
              )}

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
