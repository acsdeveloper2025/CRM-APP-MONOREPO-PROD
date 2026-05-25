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
import { departmentsService } from '@/services/departments';
import type { Department } from '@/types/user';
import { EditDepartmentDialog } from './EditDepartmentDialog';

interface DepartmentsTableProps {
  data: Department[];
  isLoading: boolean;
}

export function DepartmentsTable({ data, isLoading }: DepartmentsTableProps) {
  const [editing, setEditing] = useState<Department | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Department | null>(null);

  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['departments'] });
    queryClient.invalidateQueries({ queryKey: ['department-stats'] });
  };

  const toggleActiveMutation = useStandardizedMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      departmentsService.updateDepartment(id, { isActive }),
    successMessage: 'Department status updated',
    errorContext: 'Department Status Update',
    errorFallbackMessage: 'Failed to update department status',
    onSuccess: invalidate,
  });

  const deleteMutation = useStandardizedMutation({
    mutationFn: (id: number) => departmentsService.deleteDepartment(id),
    successMessage: 'Department deleted',
    errorContext: 'Department Deletion',
    errorFallbackMessage: 'Failed to delete department',
    onSuccess: () => {
      setPendingDelete(null);
      invalidate();
    },
    onErrorCallback: () => setPendingDelete(null),
  });

  if (isLoading) {
    return <TableSkeleton headers={['Name', 'Description', 'Users', 'Status', '']} count={5} />;
  }

  if (data.length === 0) {
    return (
      <div className="rounded-md border bg-card p-8 text-center text-sm text-muted-foreground">
        No departments to show.
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
              <TableHead className="hidden md:table-cell">Description</TableHead>
              <TableHead className="w-20 text-right">Users</TableHead>
              <TableHead className="w-24">Status</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((dept) => (
              <TableRow key={dept.id}>
                <TableCell className="font-medium">{dept.name}</TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground">
                  {dept.description || '—'}
                </TableCell>
                <TableCell className="text-right">{dept.userCount ?? 0}</TableCell>
                <TableCell>
                  {dept.isActive === false ? (
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
                          setEditing(dept);
                          setShowEdit(true);
                        }}
                      >
                        <Edit className="mr-2 h-4 w-4" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          toggleActiveMutation.mutate({
                            id: dept.id,
                            isActive: !(dept.isActive ?? true),
                          })
                        }
                      >
                        {dept.isActive === false ? (
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
                        onClick={() => setPendingDelete(dept)}
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
        <EditDepartmentDialog
          department={editing}
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
            <AlertDialogTitle>Delete department?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete ? (
                <>
                  This will permanently delete <strong>{pendingDelete.name}</strong>. Departments
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
