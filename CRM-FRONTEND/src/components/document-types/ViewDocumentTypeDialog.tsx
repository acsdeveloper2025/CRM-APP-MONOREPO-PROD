import React from 'react';
import { Shield, FileText, Calendar, Hash, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { DOCUMENT_TYPE_DISPLAY_NAMES, DOCUMENT_TYPE_COLORS, type DocumentType } from '@/types/documentType';
import { cn } from '@/lib/utils';

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
  if (!documentType) return null;

  const getCategoryBadge = (category: string) => {
    const color = DOCUMENT_TYPE_COLORS[category as keyof typeof DOCUMENT_TYPE_COLORS] || 'gray';
    const displayName = DOCUMENT_TYPE_DISPLAY_NAMES[category as keyof typeof DOCUMENT_TYPE_DISPLAY_NAMES] || category;
    
    return (
      <Badge
        variant="secondary"
        className={cn(
          'text-sm',
          `bg-${color}-100 text-${color}-800 border-${color}-200`
        )}
      >
        {displayName}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
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
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>{documentType.name}</span>
          </DialogTitle>
          <DialogDescription>
            Document type details and configuration
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Basic Information</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-600">Name</label>
                <p className="text-sm font-medium">{documentType.name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Code</label>
                <p className="text-sm">
                  <code className="bg-muted px-2 py-1 rounded text-sm">
                    {documentType.code}
                  </code>
                </p>
              </div>
            </div>

            {documentType.description && (
              <div>
                <label className="text-sm font-medium text-gray-600">Description</label>
                <p className="text-sm mt-1">{documentType.description}</p>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-gray-600">Category</label>
              <div className="mt-1">
                {getCategoryBadge(documentType.category)}
              </div>
            </div>
          </div>

          <Separator />

          {/* Properties */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Properties</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                {documentType.isGovernmentIssued ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-gray-400" />
                )}
                <span className="text-sm">Government Issued</span>
              </div>
              
              <div className="flex items-center space-x-2">
                {documentType.requiresVerification ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-gray-400" />
                )}
                <span className="text-sm">Requires Verification</span>
              </div>
            </div>

            {documentType.validityPeriodMonths && (
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-gray-600" />
                <span className="text-sm">
                  Valid for {documentType.validityPeriodMonths} months
                </span>
              </div>
            )}

            <div className="flex items-center space-x-2">
              <Badge variant={documentType.isActive ? 'default' : 'secondary'}>
                {documentType.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          </div>

          {/* Validation Rules */}
          {(documentType.formatPattern || documentType.minLength || documentType.maxLength) && (
            <>
              <Separator />
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Validation Rules</h3>
                
                {documentType.formatPattern && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Format Pattern</label>
                    <p className="text-sm mt-1">
                      <code className="bg-muted px-2 py-1 rounded text-sm">
                        {documentType.formatPattern}
                      </code>
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  {documentType.minLength && (
                    <div>
                      <label className="text-sm font-medium text-gray-600">Minimum Length</label>
                      <p className="text-sm mt-1">{documentType.minLength} characters</p>
                    </div>
                  )}
                  
                  {documentType.maxLength && (
                    <div>
                      <label className="text-sm font-medium text-gray-600">Maximum Length</label>
                      <p className="text-sm mt-1">{documentType.maxLength} characters</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Usage Statistics */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Usage Statistics</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-600">Clients Using</label>
                <p className="text-sm mt-1">{documentType.clientCount || 0} clients</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-600">Sort Order</label>
                <p className="text-sm mt-1">{documentType.sortOrder || 0}</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Metadata */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Metadata</h3>
            
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-600">Created At</label>
                <p className="text-sm mt-1">
                  {documentType.createdAt ? formatDate(documentType.createdAt) : 'N/A'}
                </p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-600">Last Updated</label>
                <p className="text-sm mt-1">
                  {documentType.updatedAt ? formatDate(documentType.updatedAt) : 'N/A'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
