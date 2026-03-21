import React, { useState } from 'react';
import { Camera, FileText, PenTool, Download, Eye, Clock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/components/Card';
import { Badge } from '@/ui/components/Badge';
import { Button } from '@/ui/components/Button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/ui/components/Dialog';
import { FormAttachment } from '@/types/form';
import { Box } from '@/ui/primitives/Box';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';

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
        return <Camera size={16} />;
      case 'DOCUMENT':
        return <FileText size={16} />;
      case 'OTHER':
        return <PenTool size={16} />;
      default:
        return <FileText size={16} />;
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
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const isImageFile = (mimeType: string) => mimeType.startsWith('image/');

  const handlePreview = (attachment: FormAttachment) => {
    setSelectedAttachment(attachment);
    setShowPreview(true);
  };

  const handleDownload = (attachment: FormAttachment) => {
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
          <CardTitle>
            <Stack direction="horizontal" gap={2} align="center">
              <Camera size={20} />
              <span>Attachments</span>
              <Badge variant="outline">{attachments.length}</Badge>
            </Stack>
          </CardTitle>
          <CardDescription>Photos, documents, and signatures captured during verification</CardDescription>
        </CardHeader>
        <CardContent>
          {attachments.length === 0 ? (
            <Stack gap={2} align="center" style={{ textAlign: 'center', paddingBlock: '2rem' }}>
              <FileText size={48} style={{ color: 'var(--ui-text-muted)' }} />
              <Text variant="body-sm" tone="muted">No attachments found</Text>
            </Stack>
          ) : (
            <Stack gap={6}>
              {Object.entries(groupedAttachments).map(([category, categoryAttachments]) => (
                <Stack key={category} gap={3}>
                  <Stack direction="horizontal" gap={2} align="center">
                    {getAttachmentIcon(category as FormAttachment['category'])}
                    <Text as="h4" variant="label" style={{ textTransform: 'capitalize' }}>{category.toLowerCase()}s</Text>
                    <Badge variant="outline">{categoryAttachments.length}</Badge>
                  </Stack>

                  <Box style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                    {categoryAttachments.map((attachment) => (
                      <Box
                        key={attachment.id}
                        style={{ border: '1px solid var(--ui-border)', borderRadius: 'var(--ui-radius-lg)', padding: '1rem' }}
                      >
                        <Stack gap={3}>
                          <Box style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                            <Stack direction="horizontal" gap={2} align="center">
                              {getAttachmentIcon(attachment.category)}
                              <Text as="span" variant="body-sm" style={{ fontWeight: 600 }}>{attachment.originalName}</Text>
                            </Stack>
                            {getAttachmentTypeBadge(attachment.category)}
                          </Box>

                          {isImageFile(attachment.mimeType) ? (
                            <Box style={{ marginBottom: '0.25rem' }}>
                              <img
                                src={attachment.url}
                                alt={attachment.originalName}
                                style={{ width: '100%', height: '8rem', objectFit: 'cover', borderRadius: 'var(--ui-radius-md)', cursor: 'pointer' }}
                                onClick={() => handlePreview(attachment)}
                              />
                            </Box>
                          ) : null}

                          <Stack gap={2}>
                            <Box style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Text as="span" variant="caption" tone="muted">Size:</Text>
                              <Text as="span" variant="caption" tone="muted">{formatFileSize(attachment.size)}</Text>
                            </Box>
                            <Stack direction="horizontal" gap={1} align="center">
                              <Clock size={12} />
                              <Text as="span" variant="caption" tone="muted">{new Date(attachment.uploadedAt).toLocaleString()}</Text>
                            </Stack>
                            <Text variant="caption" tone="muted">
                              <strong>Filename:</strong> {attachment.filename}
                            </Text>
                          </Stack>

                          <Stack direction="horizontal" gap={2}>
                            {isImageFile(attachment.mimeType) ? (
                              <Button variant="outline" onClick={() => handlePreview(attachment)} fullWidth icon={<Eye size={12} />}>
                                View
                              </Button>
                            ) : null}
                            <Button variant="outline" onClick={() => handleDownload(attachment)} fullWidth icon={<Download size={12} />}>
                              Download
                            </Button>
                          </Stack>
                        </Stack>
                      </Box>
                    ))}
                  </Box>
                </Stack>
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent style={{ width: 'min(92vw, 64rem)', maxHeight: '90vh' }}>
          <DialogHeader>
            <DialogTitle>
              <Stack direction="horizontal" gap={2} align="center" wrap="wrap">
                <Camera size={20} />
                <span>{selectedAttachment?.originalName}</span>
                {selectedAttachment ? getAttachmentTypeBadge(selectedAttachment.category) : null}
              </Stack>
            </DialogTitle>
          </DialogHeader>

          {selectedAttachment ? (
            <Stack gap={4}>
              {isImageFile(selectedAttachment.mimeType) ? (
                <Box style={{ display: 'flex', justifyContent: 'center' }}>
                  <img
                    src={selectedAttachment.url}
                    alt={selectedAttachment.originalName}
                    style={{ maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain', borderRadius: 'var(--ui-radius-lg)' }}
                  />
                </Box>
              ) : null}

              <Box style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                <Stack gap={1}>
                  <Text as="h4" variant="label">File Information</Text>
                  <Text variant="body-sm" tone="muted">Size: {formatFileSize(selectedAttachment.size)}</Text>
                  <Text variant="body-sm" tone="muted">Type: {selectedAttachment.mimeType}</Text>
                  <Text variant="body-sm" tone="muted">Uploaded: {new Date(selectedAttachment.uploadedAt).toLocaleString()}</Text>
                  <Text variant="body-sm" tone="muted">Filename: {selectedAttachment.filename}</Text>
                  <Text variant="body-sm" tone="muted">Original Name: {selectedAttachment.originalName}</Text>
                </Stack>
              </Box>

              <Stack direction="horizontal" justify="flex-end" gap={2}>
                <Button variant="outline" onClick={() => handleDownload(selectedAttachment)} icon={<Download size={16} />}>
                  Download
                </Button>
              </Stack>
            </Stack>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
