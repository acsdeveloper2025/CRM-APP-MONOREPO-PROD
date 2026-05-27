/**
 * A2.3 (audit 2026-05-25): admin page for the revoke_reasons master.
 *
 * Intentionally minimal — the table is small (≤ ~20 rows ever expected),
 * so we skip the §9 5-card stats grid, pagination, and xlsx export
 * (overkill for this scale). Operators get list + Create + Edit dialogs
 * + toggle active in a single page.
 *
 * Code is immutable post-create. The Edit dialog only exposes
 * label / sortOrder / isActive.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Pencil, Plus } from 'lucide-react';
import { useMutationWithInvalidation } from '@/hooks/useStandardizedMutation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { LoadingSpinner } from '@/components/ui/loading';
import {
  revokeReasonsService,
  type RevokeReason,
  type CreateRevokeReasonRequest,
  type UpdateRevokeReasonRequest,
} from '@/services/revokeReasons';

const EMPTY_CREATE: CreateRevokeReasonRequest = {
  code: '',
  label: '',
  sortOrder: 100,
  isActive: true,
};

export default function RevokeReasonsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateRevokeReasonRequest>(EMPTY_CREATE);
  const [editing, setEditing] = useState<RevokeReason | null>(null);
  const [editForm, setEditForm] = useState<UpdateRevokeReasonRequest>({});

  const { data, isLoading } = useQuery({
    queryKey: ['revoke-reasons', 'all'],
    queryFn: () => revokeReasonsService.listAll({ isActive: 'all', sortBy: 'sortOrder' }),
  });
  const reasons = data?.data ?? [];

  const createMutation = useMutationWithInvalidation({
    mutationFn: (input: CreateRevokeReasonRequest) => revokeReasonsService.create(input),
    invalidateKeys: [
      ['revoke-reasons', 'all'],
      ['revoke-reasons', 'active'],
    ],
    successMessage: 'Revoke reason created',
    errorContext: 'Create Revoke Reason',
  });

  const updateMutation = useMutationWithInvalidation({
    mutationFn: ({ id, data: payload }: { id: number; data: UpdateRevokeReasonRequest }) =>
      revokeReasonsService.update(id, payload),
    invalidateKeys: [
      ['revoke-reasons', 'all'],
      ['revoke-reasons', 'active'],
    ],
    successMessage: 'Revoke reason updated',
    errorContext: 'Update Revoke Reason',
  });

  const handleCreateOpenChange = (open: boolean) => {
    if (!open && !createMutation.isPending) {
      setCreateForm(EMPTY_CREATE);
    }
    setCreateOpen(open);
  };

  const handleCreateSubmit = () => {
    const trimmedCode = createForm.code.trim().toUpperCase();
    if (!/^[A-Z_]+$/.test(trimmedCode)) {
      toast.error('Code must contain only uppercase letters and underscores');
      return;
    }
    if (!createForm.label.trim()) {
      toast.error('Label is required');
      return;
    }
    createMutation.mutate(
      { ...createForm, code: trimmedCode, label: createForm.label.trim() },
      {
        onSuccess: () => {
          setCreateOpen(false);
          setCreateForm(EMPTY_CREATE);
        },
      }
    );
  };

  const handleEditOpenChange = (open: boolean) => {
    if (!open && !updateMutation.isPending) {
      setEditing(null);
      setEditForm({});
    }
  };

  const openEdit = (reason: RevokeReason) => {
    setEditing(reason);
    setEditForm({
      label: reason.label,
      sortOrder: reason.sortOrder,
      isActive: reason.isActive,
    });
  };

  const handleEditSubmit = () => {
    if (!editing) {
      return;
    }
    if (editForm.label !== undefined && !editForm.label.trim()) {
      toast.error('Label cannot be empty');
      return;
    }
    updateMutation.mutate(
      { id: editing.id, data: editForm },
      {
        onSuccess: () => {
          setEditing(null);
          setEditForm({});
        },
      }
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Revoke Reasons</h1>
          <p className="text-sm text-muted-foreground">
            Manage the canonical list of reasons that field agents and operators can pick when
            revoking a verification task.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          Add Reason
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner size="lg" />
            </div>
          ) : reasons.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No revoke reasons configured. Click &quot;Add Reason&quot; to create the first one.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead className="text-right">Sort Order</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reasons.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">
                      <span className="case-sensitive">{r.code}</span>
                    </TableCell>
                    <TableCell>{r.label}</TableCell>
                    <TableCell className="text-right">{r.sortOrder}</TableCell>
                    <TableCell>
                      {r.isActive ? (
                        <Badge variant="default">ACTIVE</Badge>
                      ) : (
                        <Badge variant="secondary">INACTIVE</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(r)}>
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">Edit {r.code}</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={handleCreateOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Revoke Reason</DialogTitle>
            <DialogDescription>
              Code is immutable post-create. Pick something stable like{' '}
              <span className="case-sensitive">NOT_MY_AREA</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="create-code">Code *</Label>
              <Input
                id="create-code"
                value={createForm.code}
                onChange={(e) => setCreateForm({ ...createForm, code: e.target.value })}
                placeholder="e.g. NOT_MY_AREA"
                disabled={createMutation.isPending}
              />
              <p className="text-xs text-muted-foreground">
                Uppercase letters and underscores only. Cannot be changed later.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-label">Label *</Label>
              <Input
                id="create-label"
                value={createForm.label}
                onChange={(e) => setCreateForm({ ...createForm, label: e.target.value })}
                placeholder="e.g. Not my area"
                disabled={createMutation.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-sort">Sort Order</Label>
              <Input
                id="create-sort"
                type="number"
                value={createForm.sortOrder ?? 0}
                onChange={(e) =>
                  setCreateForm({ ...createForm, sortOrder: Number(e.target.value) })
                }
                disabled={createMutation.isPending}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="create-active">Active</Label>
              <Switch
                id="create-active"
                checked={createForm.isActive ?? true}
                onCheckedChange={(checked) => setCreateForm({ ...createForm, isActive: checked })}
                disabled={createMutation.isPending}
              />
            </div>
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <Button
              variant="outline"
              disabled={createMutation.isPending}
              onClick={() => handleCreateOpenChange(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateSubmit} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editing !== null} onOpenChange={handleEditOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Revoke Reason</DialogTitle>
            <DialogDescription>
              Code is immutable. To retire a reason without losing historical FK pointers, toggle
              the <strong>Active</strong> switch off instead of deleting.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Code</Label>
                <div className="font-mono text-sm bg-muted px-3 py-2 rounded">
                  <span className="case-sensitive">{editing.code}</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-label">Label *</Label>
                <Input
                  id="edit-label"
                  value={editForm.label ?? ''}
                  onChange={(e) => setEditForm({ ...editForm, label: e.target.value })}
                  disabled={updateMutation.isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-sort">Sort Order</Label>
                <Input
                  id="edit-sort"
                  type="number"
                  value={editForm.sortOrder ?? 0}
                  onChange={(e) => setEditForm({ ...editForm, sortOrder: Number(e.target.value) })}
                  disabled={updateMutation.isPending}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="edit-active">Active</Label>
                <Switch
                  id="edit-active"
                  checked={editForm.isActive ?? false}
                  onCheckedChange={(checked) => setEditForm({ ...editForm, isActive: checked })}
                  disabled={updateMutation.isPending}
                />
              </div>
            </div>
          )}
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <Button
              variant="outline"
              disabled={updateMutation.isPending}
              onClick={() => handleEditOpenChange(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleEditSubmit} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
