import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal, Edit, Trash2, MapPin, Building } from 'lucide-react';
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
import { Skeleton } from '@/components/ui/skeleton';
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
import { toast } from 'sonner';
import { locationsService } from '@/services/locations';
import { Pincode } from '@/types/location';
import { EditPincodeDialog } from './EditPincodeDialog';
import { CascadingEditPincodeDialog } from './CascadingEditPincodeDialog';
import { EnhancedAreaManager } from './EnhancedAreaManager';

interface PincodesTableProps {
  data: Pincode[];
  isLoading: boolean;
}

export function PincodesTable({ data, isLoading }: PincodesTableProps) {
  const [selectedPincode, setSelectedPincode] = useState<Pincode | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showCascadingEditDialog, setShowCascadingEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [pincodeToDelete, setPincodeToDelete] = useState<Pincode | null>(null);

  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: (id: string) => locationsService.deletePincode(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pincodes'] });
      toast.success('Pincode deleted successfully');
      setShowDeleteDialog(false);
      setPincodeToDelete(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to delete pincode');
    },
  });

  const handleEdit = (pincode: Pincode) => {
    setSelectedPincode(pincode);
    setShowEditDialog(true);
  };

  const handleCascadingEdit = (pincode: Pincode) => {
    setSelectedPincode(pincode);
    setShowCascadingEditDialog(true);
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
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center space-x-4">
            <Skeleton className="h-12 w-12 rounded" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-[200px]" />
              <Skeleton className="h-4 w-[150px]" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-12">
        <MapPin className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-semibold">No pincodes found</h3>
        <p className="text-muted-foreground">
          Get started by adding your first pincode.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pincode</TableHead>
              <TableHead>Areas</TableHead>
              <TableHead>City</TableHead>
              <TableHead>State</TableHead>
              <TableHead>Created Date</TableHead>
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
                    <Badge variant="outline" className="font-mono">
                      {pincode.code}
                    </Badge>
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
                  {pincode.state ? (
                    <Badge variant="outline">{pincode.state}</Badge>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  {new Date(pincode.createdAt).toLocaleDateString()}
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
                        Quick Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleCascadingEdit(pincode)}>
                        <Building className="mr-2 h-4 w-4" />
                        Edit Location
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

      {/* Edit Dialog */}
      {selectedPincode && (
        <EditPincodeDialog
          pincode={selectedPincode}
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
        />
      )}

      {/* Cascading Edit Dialog */}
      {selectedPincode && (
        <CascadingEditPincodeDialog
          pincode={selectedPincode}
          open={showCascadingEditDialog}
          onOpenChange={setShowCascadingEditDialog}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the pincode
              "{pincodeToDelete?.code}" for areas "{pincodeToDelete?.areas?.[0]?.name || pincodeToDelete?.area || 'Unknown'}"
              {pincodeToDelete?.areas && pincodeToDelete.areas.length > 1 && ` and ${pincodeToDelete.areas.length - 1} other area(s)`}.
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
