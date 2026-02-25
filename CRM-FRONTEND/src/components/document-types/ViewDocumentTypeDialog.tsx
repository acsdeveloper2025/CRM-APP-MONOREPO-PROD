import React from 'react';
import { FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import type { DocumentType } from '@/types/documentType';

interface ViewDocumentTypeDialogProps {
  documentType: DocumentType | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ViewDocumentTypeDialog: React.FC<ViewDocumentTypeDialogProps> = ({
  documentType,
  open,
  onOpenChange,
}) => {
  if (!documentType) {return null;}

  const formatDate = (dateString?: string) => {
    if (!dateString) {return 'N/A';}
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>{documentType.name}</span>
          </DialogTitle>
          <DialogDescription>Document type details</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-600">Name</label>
            <p className="text-sm font-medium">{documentType.name}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600">Code</label>
            <p className="text-sm">
              <code className="bg-muted px-2 py-1 rounded text-sm">{documentType.code}</code>
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600">Clients Using</label>
            <p className="text-sm">{documentType.clientCount || 0} clients</p>
          </div>

          <Separator />

          <div>
            <label className="text-sm font-medium text-gray-600">Created At</label>
            <p className="text-sm">{formatDate(documentType.createdAt)}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600">Last Updated</label>
            <p className="text-sm">{formatDate(documentType.updatedAt)}</p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
