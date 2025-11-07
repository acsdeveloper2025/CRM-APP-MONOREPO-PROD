import { useState } from 'react';
import { MoreHorizontal, Edit, Trash2, MapPin, Hash } from 'lucide-react';
import { useStandardizedMutation } from '@/hooks/useStandardizedMutation';
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
import { Skeleton } from '@/components/ui/skeleton';
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

  const deleteMutation = useStandardizedMutation({
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
      deleteMutation.mutate(areaToDelete.id);
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Area Name</TableHead>
              <TableHead>Usage Count</TableHead>
              <TableHead>Created Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, index) => (
              <TableRow key={index}>
                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Area Name</TableHead>
              <TableHead>Usage Count</TableHead>
              <TableHead>Created Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell colSpan={4} className="text-center py-8 text-gray-600">
                No areas found. Areas will appear here when pincodes are created with area information.
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Area Name</TableHead>
              <TableHead>Usage Count</TableHead>
              <TableHead>Created Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((area) => {
              const areaWithDetails = area as AreaWithDetails;
              return (
                <TableRow key={area.id}>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <MapPin className="h-4 w-4 text-gray-600" />
                      <span className="font-medium">{area.name}</span>
                      <Badge variant="outline" className="text-xs">
                        #{area.displayOrder}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    {areaWithDetails.usageCount !== undefined && (
                      <div className="flex items-center space-x-1">
                        <Hash className="h-3 w-3 text-gray-600" />
                        <span className="text-sm font-medium">
                          {areaWithDetails.usageCount}
                        </span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-gray-600">
                      {formatDate(area.createdAt || '')}
                    </span>
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
                        <DropdownMenuItem onClick={() => handleEdit(areaWithDetails)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit Area
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => handleDelete(areaWithDetails)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
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
      </div>

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
                  Cannot delete area "{areaToDelete?.name}" because it is currently assigned to{' '}
                  <strong>{areaToDelete.usageCount}</strong> pincode(s).
                  <span className="block mt-2 text-amber-600 font-medium">
                    Please remove this area from all pincodes before deleting it.
                  </span>
                </>
              ) : (
                <>
                  This action cannot be undone. This will permanently delete the area
                  "{areaToDelete?.name}".
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
                className="bg-red-600 hover:bg-red-700"
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
