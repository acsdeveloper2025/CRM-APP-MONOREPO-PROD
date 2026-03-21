import { useState } from 'react';
import { MoreHorizontal, Edit, Trash2, MapPin, Building } from 'lucide-react';
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
} from '@/ui/components/DropdownMenu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/ui/components/Table';
import { LoadingState } from '@/ui/components/Loading';
import { formatBadgeLabel } from '@/lib/badgeStyles';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/ui/components/AlertDialog';
import { Box } from '@/ui/primitives/Box';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';
import { locationsService } from '@/services/locations';
import { Pincode } from '@/types/location';
import { CascadingEditPincodeDialog } from './CascadingEditPincodeDialog';
import { EnhancedAreaManager } from './EnhancedAreaManager';

interface PincodesTableProps {
  data: Pincode[];
  isLoading: boolean;
}

export function PincodesTable({ data, isLoading }: PincodesTableProps) {
  const [selectedPincode, setSelectedPincode] = useState<Pincode | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [pincodeToDelete, setPincodeToDelete] = useState<Pincode | null>(null);

  const deleteMutation = useMutationWithInvalidation({
    mutationFn: (id: string) => locationsService.deletePincode(id),
    invalidateKeys: [['pincodes']],
    successMessage: 'Pincode deleted successfully',
    errorContext: 'Pincode Deletion',
    errorFallbackMessage: 'Failed to delete pincode',
    onSuccess: () => {
      setShowDeleteDialog(false);
      setPincodeToDelete(null);
    },
  });

  const handleEdit = (pincode: Pincode) => {
    setSelectedPincode(pincode);
    setShowEditDialog(true);
  };

  const handleDelete = (pincode: Pincode) => {
    setPincodeToDelete(pincode);
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    if (pincodeToDelete) {
      deleteMutation.mutate(pincodeToDelete.id);
    }
  };

  if (isLoading) {
    return <LoadingState message="Loading pincodes..." size="lg" />;
  }

  if (!data || data.length === 0) {
    return (
      <Stack gap={3} align="center" style={{ paddingBlock: '3rem', textAlign: 'center' }}>
        <MapPin size={48} style={{ color: 'var(--ui-text-soft)', opacity: 0.75 }} />
        <Text as="h3" variant="title">No pincodes found</Text>
        <Text tone="muted">
          Get started by adding your first pincode.
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
              <TableHead>Pincode</TableHead>
              <TableHead>Areas</TableHead>
              <TableHead>City</TableHead>
              <TableHead>State</TableHead>
              <TableHead>Created Date</TableHead>
              <TableHead style={{ textAlign: 'right' }}>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((pincode) => (
              <TableRow key={pincode.id}>
                <TableCell style={{ fontWeight: 600 }}>
                  <Stack direction="horizontal" gap={2} align="center">
                    <Box
                      style={{
                        width: '2rem',
                        height: '2rem',
                        borderRadius: '999px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'color-mix(in srgb, var(--ui-accent) 12%, transparent)',
                        color: 'var(--ui-accent)',
                      }}
                    >
                      <MapPin size={16} />
                    </Box>
                    <Badge variant="outline">
                      {formatBadgeLabel(pincode.code)}
                    </Badge>
                  </Stack>
                </TableCell>
                <TableCell>
                  <EnhancedAreaManager pincode={pincode} />
                </TableCell>
                <TableCell>
                  {pincode.cityName ? (
                    <Stack direction="horizontal" gap={1} align="center">
                      <Building size={12} style={{ color: 'var(--ui-text-soft)' }} />
                      <Text as="span" variant="body-sm">{pincode.cityName}</Text>
                    </Stack>
                  ) : (
                    <Text as="span" variant="body-sm" tone="muted">No city</Text>
                  )}
                </TableCell>
                <TableCell>
                  {(pincode.state || (pincode as Pincode & { stateName?: string }).stateName) ? (
                    <Badge variant="outline">
                      {formatBadgeLabel(
                        pincode.state || (pincode as Pincode & { stateName?: string }).stateName || ''
                      )}
                    </Badge>
                  ) : (
                    <Text as="span" variant="body-sm" tone="muted">-</Text>
                  )}
                </TableCell>
                <TableCell>
                  <Text as="span" variant="body-sm" tone="muted">
                    {new Date(pincode.createdAt).toLocaleDateString()}
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
                      <DropdownMenuItem onClick={() => handleEdit(pincode)}>
                        <Edit size={16} style={{ marginRight: '0.5rem' }} />
                        Edit Pincode
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleDelete(pincode)}
                        style={{ color: 'var(--ui-danger)' }}
                      >
                        <Trash2 size={16} style={{ marginRight: '0.5rem' }} />
                        Delete Pincode
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>

      {/* Edit Pincode Dialog */}
      {selectedPincode && (
        <CascadingEditPincodeDialog
          pincode={selectedPincode}
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
              This action cannot be undone. This will permanently delete the pincode
              &quot;{pincodeToDelete?.code}&quot; for areas &quot;{pincodeToDelete?.areas?.[0]?.name || pincodeToDelete?.area || 'Unknown'}&quot;
              {pincodeToDelete?.areas && pincodeToDelete.areas.length > 1 && ` and ${pincodeToDelete.areas.length - 1} other area(s)`}.
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
