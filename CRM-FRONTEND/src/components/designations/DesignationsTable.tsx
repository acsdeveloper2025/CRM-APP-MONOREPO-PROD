import { useState } from 'react';
import { useStandardizedMutation } from '@/hooks/useStandardizedMutation';
import { useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal, Edit, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
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
import { designationsService } from '@/services/designations';
import type { Designation } from '@/types/user';
import { EditDesignationDialog } from './EditDesignationDialog';

// Row shape returned by the list endpoint adds userCount (left join COUNT)
// which isn't on the canonical Designation interface. Augment locally.
type DesignationRow = Designation & { userCount?: number };

interface DesignationsTableProps {
  data: DesignationRow[];
  isLoading: boolean;
}

export function DesignationsTable({ data, isLoading }: DesignationsTableProps) {
  const [editing, setEditing] = useState<Designation | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<DesignationRow | null>(null);

  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['designations'] });
    queryClient.invalidateQueries({ queryKey: ['designation-stats'] });
  };

  const toggleActiveMutation = useStandardizedMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      designationsService.updateDesignation(id, { isActive }),
    successMessage: 'Designation status updated',
    errorContext: 'Designation Status Update',
    errorFallbackMessage: 'Failed to update designation status',
    onSuccess: invalidate,
  });

  const deleteMutation = useStandardizedMutation({
    mutationFn: (id: number) => designationsService.deleteDesignation(id),
    successMessage: 'Designation deleted',
    errorContext: 'Designation Deletion',
    errorFallbackMessage: 'Failed to delete designation',
    onSuccess: () => {
      setPendingDelete(null);
      invalidate();
    },
    onErrorCallback: () => setPendingDelete(null),
  });

  if (isLoading) {
    return (
      <TableSkeleton
        headers={['Name', 'Department', 'Description', 'Users', 'Status', '']}
        count={5}
      />
    );
  }

  if (data.length === 0) {
    return (
      <div className="rounded-md border bg-card p-8 text-center text-sm text-muted-foreground">
        No designations to show.
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="hidden md:table-cell">Department</TableHead>
              <TableHead className="hidden lg:table-cell">Description</TableHead>
              <TableHead className="w-20 text-right">Users</TableHead>
              <TableHead className="w-24">Status</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground">
                  {row.departmentName || '—'}
                </TableCell>
                <TableCell className="hidden lg:table-cell text-muted-foreground">
                  {row.description || '—'}
                </TableCell>
                <TableCell className="text-right">{row.userCount ?? 0}</TableCell>
                <TableCell>
                  {row.isActive === false ? (
                    <Badge variant="secondary">INACTIVE</Badge>
                  ) : (
                    <Badge variant="default">ACTIVE</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label="Row actions">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuItem
                        onClick={() => {
                          setEditing(row);
                          setShowEdit(true);
                        }}
                      >
                        <Edit className="mr-2 h-4 w-4" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          toggleActiveMutation.mutate({
                            id: row.id,
                            isActive: !(row.isActive ?? true),
                          })
                        }
                      >
                        {row.isActive === false ? (
                          <>
                            <ToggleRight className="mr-2 h-4 w-4" /> Activate
                          </>
                        ) : (
                          <>
                            <ToggleLeft className="mr-2 h-4 w-4" /> Deactivate
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setPendingDelete(row)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {editing && (
        <EditDesignationDialog
          designation={editing}
          open={showEdit}
          onOpenChange={(open) => {
            setShowEdit(open);
            if (!open) {
              setEditing(null);
            }
          }}
        />
      )}

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete designation?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete ? (
                <>
                  This will permanently delete <strong>{pendingDelete.name}</strong>. Designations
                  with assigned users cannot be deleted.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={() => pendingDelete && deleteMutation.mutate(pendingDelete.id)}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
