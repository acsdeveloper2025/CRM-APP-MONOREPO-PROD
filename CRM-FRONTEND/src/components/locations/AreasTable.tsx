import { useState } from 'react';
import { MoreHorizontal, Edit, Trash2, MapPin, Hash } from 'lucide-react';
import { useMutationWithInvalidation } from '@/hooks/useStandardizedMutation';
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
import { LoadingState } from '@/ui/components/loading';
import { Box } from '@/ui/primitives/Box';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';
import { locationsService } from '@/services/locations';
import { EditAreaDialog } from './EditAreaDialog';
import { PincodeArea } from '@/types/location';
import { formatDate } from '@/lib/utils';

interface AreasTableProps {
  data: PincodeArea[];
  isLoading: boolean;
}

interface AreaWithDetails extends PincodeArea {
  usageCount?: number;
}

export function AreasTable({ data, isLoading }: AreasTableProps) {
  const [areaToDelete, setAreaToDelete] = useState<AreaWithDetails | null>(null);
  const [areaToEdit, setAreaToEdit] = useState<AreaWithDetails | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);

  const deleteMutation = useMutationWithInvalidation({
    mutationFn: (id: string) => locationsService.deleteArea(id),
    invalidateKeys: [['areas'], ['pincodes']],
    successMessage: 'Area deleted successfully',
    errorContext: 'Area Deletion',
    errorFallbackMessage: 'Failed to delete area',
    onSuccess: () => {
      setAreaToDelete(null);
    },
  });

  const handleEdit = (area: AreaWithDetails) => {
    setAreaToEdit(area);
    setShowEditDialog(true);
  };

  const handleDelete = (area: AreaWithDetails) => {
    setAreaToDelete(area);
  };

  const confirmDelete = () => {
    if (areaToDelete) {
      deleteMutation.mutate(String(areaToDelete.id));
    }
  };

  if (isLoading) {
    return <LoadingState message="Loading areas..." size="lg" />;
  }

  if (!data || data.length === 0) {
    return (
      <Box style={{ overflowX: 'auto', border: '1px solid var(--ui-border)', borderRadius: 'var(--ui-radius-lg)' }}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Area Name</TableHead>
              <TableHead>Usage Count</TableHead>
              <TableHead>Created Date</TableHead>
              <TableHead style={{ textAlign: 'right' }}>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell colSpan={4} style={{ textAlign: 'center', paddingBlock: '2rem' }}>
                <Text tone="muted">
                  No areas found. Areas will appear here when pincodes are created with area information.
                </Text>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Box>
    );
  }

  return (
    <>
      <Box style={{ overflowX: 'auto', border: '1px solid var(--ui-border)', borderRadius: 'var(--ui-radius-lg)' }}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Area Name</TableHead>
              <TableHead>Usage Count</TableHead>
              <TableHead>Created Date</TableHead>
              <TableHead style={{ textAlign: 'right' }}>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((area) => {
              const areaWithDetails = area as AreaWithDetails;
              return (
                <TableRow key={area.id}>
                  <TableCell>
                    <Stack direction="horizontal" gap={2} align="center" wrap="wrap">
                      <MapPin size={16} style={{ color: 'var(--ui-text-soft)' }} />
                      <Text as="span" variant="label">{area.name}</Text>
                      <Badge variant="outline">
                        #{area.displayOrder}
                      </Badge>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    {areaWithDetails.usageCount !== undefined && (
                      <Stack direction="horizontal" gap={1} align="center">
                        <Hash size={12} style={{ color: 'var(--ui-text-soft)' }} />
                        <Text as="span" variant="body-sm">
                          {areaWithDetails.usageCount}
                        </Text>
                      </Stack>
                    )}
                  </TableCell>
                  <TableCell>
                    <Text as="span" variant="body-sm" tone="muted">
                      {formatDate(area.createdAt || '')}
                    </Text>
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
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleEdit(areaWithDetails)}>
                          <Edit size={16} style={{ marginRight: '0.5rem' }} />
                          Edit Area
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          style={{ color: 'var(--ui-danger)' }}
                          onClick={() => handleDelete(areaWithDetails)}
                        >
                          <Trash2 size={16} style={{ marginRight: '0.5rem' }} />
                          Delete Area
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Box>

      {/* Edit Dialog */}
      {areaToEdit && (
        <EditAreaDialog
          area={areaToEdit}
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!areaToDelete} onOpenChange={() => setAreaToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {areaToDelete?.usageCount && areaToDelete.usageCount > 0
                ? 'Cannot Delete Area'
                : 'Are you sure?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {areaToDelete?.usageCount && areaToDelete.usageCount > 0 ? (
                <>
                  Cannot delete area &quot;{areaToDelete?.name}&quot; because it is currently assigned to{' '}
                  <strong>{areaToDelete.usageCount}</strong> pincode(s).
                  <span style={{ display: 'block', marginTop: '0.5rem', color: 'var(--ui-warning)', fontWeight: 600 }}>
                    Please remove this area from all pincodes before deleting it.
                  </span>
                </>
              ) : (
                <>
                  This action cannot be undone. This will permanently delete the area
                  &quot;{areaToDelete?.name}&quot;.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {areaToDelete?.usageCount && areaToDelete.usageCount > 0 ? 'Close' : 'Cancel'}
            </AlertDialogCancel>
            {(!areaToDelete?.usageCount || areaToDelete.usageCount === 0) && (
              <AlertDialogAction
                onClick={confirmDelete}
                style={{ background: 'var(--ui-danger)', color: 'white' }}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete Area'}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
