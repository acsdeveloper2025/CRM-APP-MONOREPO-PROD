import { useState } from 'react';
import {
  MoreHorizontal,
  Edit,
  Trash2,
  MapPin,
  Building,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useMutationWithInvalidation,
  useStandardizedMutation,
} from '@/hooks/useStandardizedMutation';
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
import { baseBadgeStyle, formatBadgeLabel } from '@/lib/badgeStyles';
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
import { locationsService } from '@/services/locations';
import { Pincode } from '@/types/location';
import { CascadingEditPincodeDialog } from './CascadingEditPincodeDialog';
import { EnhancedAreaManager } from './EnhancedAreaManager';

interface PincodesTableProps {
  data: Pincode[];
  isLoading: boolean;
}

export function PincodesTable({ data, isLoading }: PincodesTableProps) {
  const queryClient = useQueryClient();
  const [selectedPincode, setSelectedPincode] = useState<Pincode | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [pincodeToDelete, setPincodeToDelete] = useState<Pincode | null>(null);

  const deleteMutation = useMutationWithInvalidation({
    mutationFn: (id: string) => locationsService.deletePincode(id),
    invalidateKeys: [['pincodes'], ['pincode-stats']],
    successMessage: 'Pincode deleted successfully',
    errorContext: 'Pincode Deletion',
    errorFallbackMessage: 'Failed to delete pincode',
    onSuccess: () => {
      setShowDeleteDialog(false);
      setPincodeToDelete(null);
    },
  });

  const toggleActiveMutation = useStandardizedMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      locationsService.updatePincode(id, { isActive }),
    errorContext: 'Pincode Status Toggle',
    errorFallbackMessage: 'Failed to update pincode status',
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pincodes'] });
      queryClient.invalidateQueries({ queryKey: ['pincode-stats'] });
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
    return (
      <TableSkeleton
        headers={['Pincode', 'Areas', 'City', 'State', 'Created Date', 'Status', 'Actions']}
      />
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-12">
        <MapPin className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-semibold">No pincodes found</h3>
        <p className="text-muted-foreground">Get started by adding your first pincode.</p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pincode</TableHead>
              <TableHead>Areas</TableHead>
              <TableHead>City</TableHead>
              <TableHead>State</TableHead>
              <TableHead>Created Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((pincode) => (
              <TableRow key={pincode.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center space-x-2">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <MapPin className="h-4 w-4 text-primary" />
                    </div>
                    <Badge className={baseBadgeStyle}>{formatBadgeLabel(pincode.code)}</Badge>
                  </div>
                </TableCell>
                <TableCell>
                  <EnhancedAreaManager pincode={pincode} />
                </TableCell>
                <TableCell>
                  {pincode.cityName ? (
                    <div className="flex items-center space-x-1">
                      <Building className="h-3 w-3 text-muted-foreground" />
                      <span>{pincode.cityName}</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">No city</span>
                  )}
                </TableCell>
                <TableCell>
                  {pincode.state || (pincode as Pincode & { stateName?: string }).stateName ? (
                    <Badge className={baseBadgeStyle}>
                      {formatBadgeLabel(
                        pincode.state ||
                          (pincode as Pincode & { stateName?: string }).stateName ||
                          ''
                      )}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>{new Date(pincode.createdAt).toLocaleDateString()}</TableCell>
                <TableCell>
                  {pincode.isActive === false ? (
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
                      <DropdownMenuItem onClick={() => handleEdit(pincode)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit Pincode
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={toggleActiveMutation.isPending}
                        onClick={() =>
                          toggleActiveMutation.mutate({
                            id: pincode.id,
                            isActive: !(pincode.isActive ?? true),
                          })
                        }
                      >
                        {pincode.isActive === false ? (
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
                        onClick={() => handleDelete(pincode)}
                        className="text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Pincode
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {selectedPincode && (
        <CascadingEditPincodeDialog
          pincode={selectedPincode}
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
        />
      )}

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the pincode &quot;
              {pincodeToDelete?.code}&quot; for areas &quot;
              {pincodeToDelete?.areas?.[0]?.name || pincodeToDelete?.area || 'Unknown'}&quot;
              {pincodeToDelete?.areas &&
                pincodeToDelete.areas.length > 1 &&
                ` and ${pincodeToDelete.areas.length - 1} other area(s)`}
              .
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
