import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal, Edit, Trash2, Eye, FileText } from 'lucide-react';
import { Button } from '@/ui/components/Button';
import { Badge } from '@/ui/components/Badge';
import { baseBadgeStyle, formatBadgeLabel } from '@/lib/badgeStyles';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/ui/components/Table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/ui/components/DropdownMenu';
import { documentTypesService } from '@/services/documentTypes';
import { EditDocumentTypeDialog } from './EditDocumentTypeDialog';
import { ViewDocumentTypeDialog } from './ViewDocumentTypeDialog';
import { type DocumentType } from '@/types/documentType';
interface DocumentTypesTableProps {
  data: DocumentType[];
  isLoading: boolean;
}
export const DocumentTypesTable: React.FC<DocumentTypesTableProps> = ({ data, isLoading }) => {
  const [editingDocumentType, setEditingDocumentType] = useState<DocumentType | null>(null);
  const [viewingDocumentType, setViewingDocumentType] = useState<DocumentType | null>(null);
  const queryClient = useQueryClient();
  const deleteDocumentTypeMutation = useMutation({
    mutationFn: (id: number) => documentTypesService.deleteDocumentType(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-types'] });
      queryClient.invalidateQueries({ queryKey: ['document-types-stats'] });
    },
  });
  const handleDelete = async (documentType: DocumentType) => {
    // eslint-disable-next-line no-alert
    if (window.confirm(`Are you sure you want to delete "${documentType.name}"?`)) {
      try {
        await deleteDocumentTypeMutation.mutateAsync(documentType.id);
      } catch (error) {
        console.error('Failed to delete document type:', error);
      }
    }
  };
  if (isLoading) {
    return (
      <div {...{ className: 'space-y-3' }}>
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            {...{ className: 'h-12 bg-slate-100 dark:bg-slate-800/60 animate-pulse rounded' }}
          />
        ))}
      </div>
    );
  }
  return (
    <>
      <div {...{ className: 'rounded-md border overflow-auto' }}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Usage</TableHead>
              <TableHead {...{ className: 'w-[70px]' }}>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} {...{ className: 'text-center py-8 text-gray-600' }}>
                  No document types found
                </TableCell>
              </TableRow>
            ) : (
              data.map((documentType) => (
                <TableRow key={documentType.id}>
                  <TableCell>
                    <div {...{ className: 'flex items-center space-x-2' }}>
                      <FileText {...{ className: 'h-4 w-4 text-gray-600' }} />
                      <div>
                        <div {...{ className: 'font-medium' }}>{documentType.name}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge {...{ className: baseBadgeStyle }}>
                      {formatBadgeLabel(documentType.code)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div {...{ className: 'text-sm text-gray-600' }}>
                      {documentType.clientCount || 0} clients
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" {...{ className: 'h-8 w-8 p-0' }}>
                          <MoreHorizontal {...{ className: 'h-4 w-4' }} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => setViewingDocumentType(documentType)}>
                          <Eye {...{ className: 'mr-2 h-4 w-4' }} />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setEditingDocumentType(documentType)}>
                          <Edit {...{ className: 'mr-2 h-4 w-4' }} />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDelete(documentType)}
                          {...{ className: 'text-destructive' }}
                        >
                          <Trash2 {...{ className: 'mr-2 h-4 w-4' }} />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Dialogs */}
      <EditDocumentTypeDialog
        documentType={editingDocumentType}
        open={!!editingDocumentType}
        onOpenChange={(open) => !open && setEditingDocumentType(null)}
      />

      <ViewDocumentTypeDialog
        documentType={viewingDocumentType}
        open={!!viewingDocumentType}
        onOpenChange={(open) => !open && setViewingDocumentType(null)}
      />
    </>
  );
};
