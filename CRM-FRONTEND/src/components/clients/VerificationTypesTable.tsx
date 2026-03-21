import { useState } from 'react';
import { useStandardizedMutation } from '@/hooks/useStandardizedMutation';
import { MoreHorizontal, Edit, Trash2, CheckCircle } from 'lucide-react';
import { Button } from '@/ui/components/Button';
import { Badge } from '@/ui/components/Badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/ui/components/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/ui/components/table';
import { LoadingState } from '@/ui/components/loading';
import { Box } from '@/ui/primitives/Box';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/ui/components/alert-dialog';
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
    return <LoadingState message="Loading verification types..." size="lg" />;
  }

  if (!data || data.length === 0) {
    return (
      <Stack gap={3} align="center" style={{ paddingBlock: '3rem', textAlign: 'center' }}>
        <CheckCircle size={48} style={{ color: 'var(--ui-text-soft)', opacity: 0.75 }} />
        <Text as="h3" variant="title">No verification types found</Text>
        <Text tone="muted">
          Get started by creating your first verification type.
        </Text>
      </Stack>
    );
  }

  return (
    <>
      <Box style={{ overflowX: 'auto', border: '1px solid var(--ui-border)', borderRadius: 'var(--ui-radius-lg)' }}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type Name</TableHead>
              <TableHead>Created Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead style={{ textAlign: 'right' }}>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((type) => (
              <TableRow key={type.id}>
                <TableCell style={{ fontWeight: 600 }}>
                  <Stack direction="horizontal" gap={2} align="center">
                    <Box style={{ width: '2rem', height: '2rem', borderRadius: '999px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'color-mix(in srgb, var(--ui-accent) 12%, transparent)', color: 'var(--ui-accent)' }}>
                      <CheckCircle size={16} />
                    </Box>
                    <Text as="span" variant="label">{type.name}</Text>
                  </Stack>
                </TableCell>

                <TableCell>
                  <Text as="span" variant="body-sm" tone="muted">{new Date(type.createdAt).toLocaleDateString()}</Text>
                </TableCell>
                <TableCell>
                  <Badge variant="positive">Active</Badge>
                </TableCell>
                <TableCell style={{ textAlign: 'right' }}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" aria-label="Open actions menu">
                        <MoreHorizontal size={16} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => handleEdit(type)}>
                        <Edit size={16} style={{ marginRight: '0.5rem' }} />
                        Edit Type
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleDelete(type)}
                        style={{ color: 'var(--ui-danger)' }}
                      >
                        <Trash2 size={16} style={{ marginRight: '0.5rem' }} />
                        Delete Type
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>

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
              style={{ background: 'var(--ui-danger)', color: 'white' }}
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
