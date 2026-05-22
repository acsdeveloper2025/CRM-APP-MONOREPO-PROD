import { useState } from 'react';
import { MoreHorizontal, Edit, Trash2, Eye, MapPin, ToggleLeft, ToggleRight } from 'lucide-react';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import { locationsService } from '@/services/locations';
import { EditStateDialog } from './EditStateDialog';
import { StateDetailsDialog } from './StateDetailsDialog';
import type { State } from '@/types/location';

interface StatesTableProps {
  data: State[];
  isLoading: boolean;
}

export function StatesTable({ data, isLoading }: StatesTableProps) {
  const queryClient = useQueryClient();
  const [selectedState, setSelectedState] = useState<State | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [stateToDelete, setStateToDelete] = useState<State | null>(null);

  const deleteStateMutation = useMutationWithInvalidation({
    mutationFn: (id: string) => locationsService.deleteState(id),
    invalidateKeys: [['states'], ['state-stats']],
    successMessage: 'State deleted successfully',
    errorContext: 'State Deletion',
    errorFallbackMessage: 'Failed to delete state',
    onSuccess: () => {
      setShowDeleteDialog(false);
      setStateToDelete(null);
    },
  });

  const toggleActiveMutation = useStandardizedMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      locationsService.updateState(id, { isActive }),
    errorContext: 'State Status Toggle',
    errorFallbackMessage: 'Failed to update state status',
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['states'] });
      queryClient.invalidateQueries({ queryKey: ['state-stats'] });
    },
  });

  const handleEdit = (state: State) => {
    setSelectedState(state);
    setShowEditDialog(true);
  };

  const handleView = (state: State) => {
    setSelectedState(state);
    setShowDetailsDialog(true);
  };

  const handleDelete = (state: State) => {
    setStateToDelete(state);
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    if (stateToDelete) {
      deleteStateMutation.mutate(String(stateToDelete.id));
    }
  };

  if (isLoading) {
    return (
      <TableSkeleton
        headers={['Name', 'Code', 'Country', 'Cities', 'Created', 'Status', 'Actions']}
      />
    );
  }

  if (!data.length) {
    return (
      <div className="text-center py-8">
        <MapPin className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-2 text-sm font-medium text-foreground">No states found</h3>
        <p className="mt-1 text-sm text-muted-foreground">Get started by creating a new state.</p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Country</TableHead>
              <TableHead>Cities</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[70px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((state) => (
              <TableRow key={state.id}>
                <TableCell className="font-medium">{state.name}</TableCell>
                <TableCell>
                  <Badge className={baseBadgeStyle}>{formatBadgeLabel(state.code)}</Badge>
                </TableCell>
                <TableCell>{state.country}</TableCell>
                <TableCell>
                  <Badge className={baseBadgeStyle}>{state.cityCount || 0} CITIES</Badge>
                </TableCell>
                <TableCell>{new Date(state.createdAt).toLocaleDateString()}</TableCell>
                <TableCell>
                  {state.isActive === false ? (
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
                      <DropdownMenuItem onClick={() => handleView(state)}>
                        <Eye className="mr-2 h-4 w-4" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleEdit(state)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={toggleActiveMutation.isPending}
                        onClick={() =>
                          toggleActiveMutation.mutate({
                            id: String(state.id),
                            isActive: !(state.isActive ?? true),
                          })
                        }
                      >
                        {state.isActive === false ? (
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
                        onClick={() => handleDelete(state)}
                        className="text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {selectedState && (
        <>
          <EditStateDialog
            state={selectedState}
            open={showEditDialog}
            onOpenChange={setShowEditDialog}
          />
          <StateDetailsDialog
            state={selectedState}
            open={showDetailsDialog}
            onOpenChange={setShowDetailsDialog}
          />
        </>
      )}

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the state &quot;
              {stateToDelete?.name}&quot; and all associated cities.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteStateMutation.isPending}
            >
              {deleteStateMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
