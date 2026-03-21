import { useState } from 'react';
import { MoreHorizontal, Edit, Trash2, Eye, MapPin } from 'lucide-react';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/ui/components/AlertDialog';
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
import { Box } from '@/ui/primitives/Box';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';
import { locationsService } from '@/services/locations';
import { EditStateDialog } from './EditStateDialog';
import { StateDetailsDialog } from './StateDetailsDialog';
import type { State } from '@/types/location';

interface StatesTableProps {
  data: State[];
  isLoading: boolean;
}

export function StatesTable({ data, isLoading }: StatesTableProps) {
  const [selectedState, setSelectedState] = useState<State | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [stateToDelete, setStateToDelete] = useState<State | null>(null);

  const deleteStateMutation = useMutationWithInvalidation({
    mutationFn: (id: string) => locationsService.deleteState(id),
    invalidateKeys: [['states']],
    successMessage: 'State deleted successfully',
    errorContext: 'State Deletion',
    errorFallbackMessage: 'Failed to delete state',
    onSuccess: () => {
      setShowDeleteDialog(false);
      setStateToDelete(null);
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
    return <LoadingState message="Loading states..." size="lg" />;
  }

  if (!data.length) {
    return (
      <Stack gap={3} align="center" style={{ paddingBlock: '2rem', textAlign: 'center' }}>
        <MapPin size={48} style={{ color: 'var(--ui-text-soft)', opacity: 0.75 }} />
        <Text as="h3" variant="title">No states found</Text>
        <Text tone="muted">
          Get started by creating a new state.
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
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Country</TableHead>
              <TableHead>Cities</TableHead>
              <TableHead>Created</TableHead>
              <TableHead style={{ textAlign: 'right' }}>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((state) => (
              <TableRow key={state.id}>
                <TableCell style={{ fontWeight: 600 }}>
                  <Text as="span" variant="label">{state.name}</Text>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{formatBadgeLabel(state.code)}</Badge>
                </TableCell>
                <TableCell>
                  <Text as="span" variant="body-sm">{state.country}</Text>
                </TableCell>
                <TableCell>
                  <Badge variant="accent">
                    {state.cityCount || 0} CITIES
                  </Badge>
                </TableCell>
                <TableCell>
                  <Text as="span" variant="body-sm" tone="muted">
                    {new Date(state.createdAt).toLocaleDateString()}
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
                      <DropdownMenuItem onClick={() => handleView(state)}>
                        <Eye size={16} style={{ marginRight: '0.5rem' }} />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleEdit(state)}>
                        <Edit size={16} style={{ marginRight: '0.5rem' }} />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleDelete(state)}
                        style={{ color: 'var(--ui-danger)' }}
                      >
                        <Trash2 size={16} style={{ marginRight: '0.5rem' }} />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>

      {/* Dialogs */}
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the state
              &quot;{stateToDelete?.name}&quot; and all associated cities.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              style={{ background: 'var(--ui-danger)', color: 'white' }}
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
