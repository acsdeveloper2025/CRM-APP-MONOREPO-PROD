import { useState } from 'react';
import { MoreHorizontal, Edit, Trash2, MapPin, Hash, ToggleLeft, ToggleRight } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { TableSkeleton } from '@/components/ui/table-skeleton';
import { locationsService } from '@/services/locations';
import { EditAreaDialog } from './EditAreaDialog';
import type { Area } from '@/types/location';
import { formatDate } from '@/lib/utils';

interface AreasTableProps {
  data: Area[];
  isLoading: boolean;
}

export function AreasTable({ data, isLoading }: AreasTableProps) {
  const queryClient = useQueryClient();
  const [areaToDelete, setAreaToDelete] = useState<Area | null>(null);
  const [areaToEdit, setAreaToEdit] = useState<Area | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);

  const deleteMutation = useMutationWithInvalidation({
    mutationFn: (id: string) => locationsService.deleteArea(id),
    invalidateKeys: [['areas'], ['pincodes'], ['area-stats']],
    successMessage: 'Area deleted successfully',
    errorContext: 'Area Deletion',
    errorFallbackMessage: 'Failed to delete area',
    onSuccess: () => {
      setAreaToDelete(null);
    },
  });

  const toggleActiveMutation = useStandardizedMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      locationsService.updateArea(id, { isActive }),
    errorContext: 'Area Status Toggle',
    errorFallbackMessage: 'Failed to update area status',
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['areas'] });
      queryClient.invalidateQueries({ queryKey: ['area-stats'] });
    },
  });

  const handleEdit = (area: Area) => {
    setAreaToEdit(area);
    setShowEditDialog(true);
  };

  const handleDelete = (area: Area) => {
    setAreaToDelete(area);
  };

  const confirmDelete = () => {
    if (areaToDelete) {
      deleteMutation.mutate(String(areaToDelete.id));
    }
  };

  if (isLoading) {
    return (
      <TableSkeleton headers={['Area Name', 'Usage Count', 'Created Date', 'Status', 'Actions']} />
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Area Name</TableHead>
              <TableHead>Usage Count</TableHead>
              <TableHead>Created Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                No areas found.
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Area Name</TableHead>
              <TableHead>Usage Count</TableHead>
              <TableHead>Created Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((area) => (
              <TableRow key={area.id}>
                <TableCell>
                  <div className="flex items-center space-x-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{area.name}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center space-x-1">
                    <Hash className="h-3 w-3 text-muted-foreground" />
                    <span className="text-sm font-medium">{area.usageCount}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground">
                    {formatDate(area.createdAt || '')}
                  </span>
                </TableCell>
                <TableCell>
                  {area.isActive === false ? (
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
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleEdit(area)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit Area
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={toggleActiveMutation.isPending}
                        onClick={() =>
                          toggleActiveMutation.mutate({
                            id: String(area.id),
                            isActive: !(area.isActive ?? true),
                          })
                        }
                      >
                        {area.isActive === false ? (
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
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => handleDelete(area)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Area
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {areaToEdit && (
        <EditAreaDialog area={areaToEdit} open={showEditDialog} onOpenChange={setShowEditDialog} />
      )}

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
                  Cannot delete area &quot;{areaToDelete?.name}&quot; because it is currently
                  assigned to <strong>{areaToDelete.usageCount}</strong> pincode(s).
                  <span className="block mt-2 text-amber-600 font-medium">
                    Please remove this area from all pincodes before deleting it.
                  </span>
                </>
              ) : (
                <>
                  This action cannot be undone. This will permanently delete the area &quot;
                  {areaToDelete?.name}&quot;.
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
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
