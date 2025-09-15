import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { rateTypesService, type RateType } from '@/services/rateTypes';
import { CreateRateTypeDialog } from './CreateRateTypeDialog';
import { EditRateTypeDialog } from './EditRateTypeDialog';
import { DeleteConfirmationDialog } from './DeleteConfirmationDialog';
import toast from 'react-hot-toast';

export function RateTypesTab() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingRateType, setEditingRateType] = useState<RateType | null>(null);
  const [deletingRateType, setDeletingRateType] = useState<RateType | null>(null);

  const queryClient = useQueryClient();

  // Fetch rate types
  const { data: rateTypesData, isLoading } = useQuery({
    queryKey: ['rate-types', searchQuery],
    queryFn: () => rateTypesService.getRateTypes({ search: searchQuery, limit: 100 }),
  });

  const rateTypes = rateTypesData?.data || [];

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => rateTypesService.deleteRateType(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rate-types'] });
      queryClient.invalidateQueries({ queryKey: ['rate-management-stats'] });
      toast.success('Rate type deleted successfully');
      setDeletingRateType(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to delete rate type');
    },
  });

  // Toggle active status mutation
  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      rateTypesService.updateRateType(id, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rate-types'] });
      queryClient.invalidateQueries({ queryKey: ['rate-management-stats'] });
      toast.success('Rate type status updated');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update rate type');
    },
  });

  const handleDelete = (rateType: RateType) => {
    setDeletingRateType(rateType);
  };

  const confirmDelete = () => {
    if (deletingRateType) {
      deleteMutation.mutate(deletingRateType.id);
    }
  };

  const handleToggleActive = (rateType: RateType) => {
    toggleActiveMutation.mutate({
      id: rateType.id,
      isActive: !rateType.isActive,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search rate types..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Rate Type
        </Button>
      </div>

      {/* Predefined Rate Types Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Standard Rate Types</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {['Local', 'Local1', 'Local2', 'OGL', 'OGL1', 'OGL2', 'Outstation'].map((type) => (
              <div key={type} className="text-center p-3 border rounded-lg">
                <div className="font-medium text-sm">{type}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {type.startsWith('Local') ? 'Local Area' : 
                   type.startsWith('OGL') ? 'Out of Gujarat/Local' : 
                   'Outstation'}
                </div>
              </div>
            ))}
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            These are the standard rate types used in the verification system. You can create additional custom rate types as needed.
          </p>
        </CardContent>
      </Card>

      {/* Rate Types Table */}
      <Card>
        <CardHeader>
          <CardTitle>Rate Types ({rateTypes.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : rateTypes.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No rate types found</p>
              <Button 
                variant="outline" 
                onClick={() => setShowCreateDialog(true)}
                className="mt-4"
              >
                Create your first rate type
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rateTypes.map((rateType) => (
                  <TableRow key={rateType.id}>
                    <TableCell className="font-medium">{rateType.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {rateType.description || 'No description'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={rateType.isActive}
                          onCheckedChange={() => handleToggleActive(rateType)}
                          disabled={toggleActiveMutation.isPending}
                        />
                        <Badge variant={rateType.isActive ? 'default' : 'secondary'}>
                          {rateType.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(rateType.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingRateType(rateType)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(rateType)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <CreateRateTypeDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />

      {editingRateType && (
        <EditRateTypeDialog
          rateType={editingRateType}
          open={!!editingRateType}
          onOpenChange={(open) => !open && setEditingRateType(null)}
        />
      )}

      {deletingRateType && (
        <DeleteConfirmationDialog
          open={!!deletingRateType}
          onOpenChange={(open) => !open && setDeletingRateType(null)}
          title="Delete Rate Type"
          description={`Are you sure you want to delete the rate type "${deletingRateType.name}"? This action cannot be undone.`}
          onConfirm={confirmDelete}
          isLoading={deleteMutation.isPending}
        />
      )}
    </div>
  );
}
