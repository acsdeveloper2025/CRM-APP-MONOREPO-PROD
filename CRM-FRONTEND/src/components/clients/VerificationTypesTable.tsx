import { useState } from 'react';
import { useStandardizedMutation } from '@/hooks/useStandardizedMutation';
import { useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal, Edit, Trash2, CheckCircle, ToggleLeft, ToggleRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { TableSkeleton } from '@/components/ui/table-skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { clientsService } from '@/services/clients';
import { VerificationType } from '@/types/client';
import { EditVerificationTypeDialog } from './EditVerificationTypeDialog';

interface VerificationTypesTableProps {
  data: VerificationType[];
  isLoading: boolean;
}

export function VerificationTypesTable({ data, isLoading }: VerificationTypesTableProps) {
  const [selectedType, setSelectedType] = useState<VerificationType | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [typeToDelete, setTypeToDelete] = useState<VerificationType | null>(null);

  const queryClient = useQueryClient();

  const deleteMutation = useStandardizedMutation({
    mutationFn: (id: number) => clientsService.deleteVerificationType(id),
    successMessage: 'Verification type deleted successfully',
    errorContext: 'Verification Type Deletion',
    errorFallbackMessage: 'Failed to delete verification type',
    onSuccess: () => {
      setShowDeleteDialog(false);
      setTypeToDelete(null);
    },
    onErrorCallback: () => {
      setShowDeleteDialog(false);
      setTypeToDelete(null);
    },
  });

  const toggleActiveMutation = useStandardizedMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      clientsService.updateVerificationType(id, { isActive }),
    errorContext: 'Verification Type Status Toggle',
    errorFallbackMessage: 'Failed to update verification type status',
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['verification-types'] });
      queryClient.invalidateQueries({ queryKey: ['verification-types-stats'] });
    },
  });

  const handleEdit = (type: VerificationType) => {
    setSelectedType(type);
    setShowEditDialog(true);
  };

  const handleDelete = (type: VerificationType) => {
    setTypeToDelete(type);
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    if (typeToDelete) {
      deleteMutation.mutate(typeToDelete.id);
    }
  };

  if (isLoading) {
    return <TableSkeleton headers={['Type Name', 'Created Date', 'Status', 'Actions']} />;
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-12">
        <CheckCircle className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-semibold">No verification types found</h3>
        <p className="text-muted-foreground">
          Get started by creating your first verification type.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type Name</TableHead>
              <TableHead>Created Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((type) => (
              <TableRow key={type.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center space-x-2">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <CheckCircle className="h-4 w-4 text-primary" />
                    </div>
                    <span>{type.name}</span>
                  </div>
                </TableCell>

                <TableCell>{new Date(type.createdAt).toLocaleDateString()}</TableCell>
                <TableCell>
                  {type.isActive === false ? (
                    <Badge variant="secondary">INACTIVE</Badge>
                  ) : (
                    <Badge variant="default">ACTIVE</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => handleEdit(type)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit Type
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={toggleActiveMutation.isPending}
                        onClick={() =>
                          toggleActiveMutation.mutate({
                            id: type.id,
                            isActive: !(type.isActive ?? true),
                          })
                        }
                      >
                        {type.isActive === false ? (
                          <>
                            <ToggleRight className="mr-2 h-4 w-4" />
                            Activate
                          </>
                        ) : (
                          <>
                            <ToggleLeft className="mr-2 h-4 w-4" />
                            Deactivate
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleDelete(type)}
                        className="text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Type
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Edit Dialog */}
      {selectedType && (
        <EditVerificationTypeDialog
          verificationType={selectedType}
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the verification type
              &quot;{typeToDelete?.name}&quot;.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
