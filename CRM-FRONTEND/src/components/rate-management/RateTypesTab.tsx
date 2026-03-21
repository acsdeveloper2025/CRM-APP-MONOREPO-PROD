import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Edit, Trash2, Search } from 'lucide-react';
import { useMutationWithInvalidation } from '@/hooks/useStandardizedMutation';
import { Button } from '@/ui/components/Button';
import { Input } from '@/ui/components/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/components/Card';
import { Badge } from '@/ui/components/Badge';
import { Switch } from '@/ui/components/Switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/ui/components/Table';
import { rateTypesService, type RateType } from '@/services/rateTypes';
import { CreateRateTypeDialog } from './CreateRateTypeDialog';
import { EditRateTypeDialog } from './EditRateTypeDialog';
import { DeleteConfirmationDialog } from './DeleteConfirmationDialog';

export function RateTypesTab() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingRateType, setEditingRateType] = useState<RateType | null>(null);
  const [deletingRateType, setDeletingRateType] = useState<RateType | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Fetch rate types
  const { data: rateTypesData, isLoading } = useQuery({
    queryKey: ['rate-types', searchQuery, currentPage, pageSize],
    queryFn: () => rateTypesService.getRateTypes({
      search: searchQuery,
      page: currentPage,
      limit: pageSize,
    }),
  });

  const rateTypes = rateTypesData?.data || [];

  // Delete mutation
  const deleteMutation = useMutationWithInvalidation({
    mutationFn: (id: number) => rateTypesService.deleteRateType(id),
    invalidateKeys: [['rate-types'], ['rate-management-stats']],
    successMessage: 'Rate type deleted successfully',
    errorContext: 'Rate Type Deletion',
    errorFallbackMessage: 'Failed to delete rate type',
    onSuccess: () => {
      setDeletingRateType(null);
    },
  });

  // Toggle active status mutation
  const toggleActiveMutation = useMutationWithInvalidation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      rateTypesService.updateRateType(id, { isActive }),
    invalidateKeys: [['rate-types'], ['rate-management-stats']],
    successMessage: 'Rate type status updated',
    errorContext: 'Rate Type Status Update',
    errorFallbackMessage: 'Failed to update rate type',
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
    <div {...{ className: "space-y-6" }}>
      {/* Header Actions */}
      <div {...{ className: "flex items-center justify-between" }}>
        <div {...{ className: "flex items-center gap-4" }}>
          <div {...{ className: "relative" }}>
            <Search {...{ className: "absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-600 h-4 w-4" }} />
            <Input
              placeholder="Search rate types..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              {...{ className: "pl-10 w-64" }}
            />
          </div>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus {...{ className: "h-4 w-4 mr-2" }} />
          Create Rate Type
        </Button>
      </div>

      {/* Predefined Rate Types Info */}
      <Card>
        <CardHeader>
          <CardTitle {...{ className: "text-lg" }}>Standard Rate Types</CardTitle>
        </CardHeader>
        <CardContent>
          <div {...{ className: "grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3" }}>
            {['Local', 'Local1', 'Local2', 'OGL', 'OGL1', 'OGL2', 'Outstation'].map((type) => (
              <div key={type} {...{ className: "text-center p-3 border rounded-lg" }}>
                <div {...{ className: "font-medium text-sm" }}>{type}</div>
                <div {...{ className: "text-xs text-gray-600 mt-1" }}>
                  {type.startsWith('Local') ? 'Local Area' :
                   type.startsWith('OGL') ? 'Out of Geolocation' :
                   'Outstation'}
                </div>
              </div>
            ))}
          </div>
          <p {...{ className: "text-sm text-gray-600 mt-4" }}>
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
            <div {...{ className: "flex items-center justify-center py-8" }}>
              <div {...{ className: "animate-spin rounded-full h-8 w-8 border-b-2 border-primary" }} />
            </div>
          ) : rateTypes.length === 0 ? (
            <div {...{ className: "text-center py-8" }}>
              <p {...{ className: "text-gray-600" }}>No rate types found</p>
              <Button 
                variant="outline" 
                onClick={() => setShowCreateDialog(true)}
                {...{ className: "mt-4" }}
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
                  <TableHead {...{ className: "text-right" }}>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rateTypes.map((rateType) => (
                  <TableRow key={rateType.id}>
                    <TableCell {...{ className: "font-medium" }}>{rateType.name}</TableCell>
                    <TableCell {...{ className: "text-gray-600" }}>
                      {rateType.description || 'No description'}
                    </TableCell>
                    <TableCell>
                      <div {...{ className: "flex items-center gap-2" }}>
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
                    <TableCell {...{ className: "text-gray-600" }}>
                      {new Date(rateType.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell {...{ className: "text-right" }}>
                      <div {...{ className: "flex items-center justify-end gap-2" }}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingRateType(rateType)}
                        >
                          <Edit {...{ className: "h-4 w-4" }} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(rateType)}
                          {...{ className: "text-destructive hover:text-destructive" }}
                        >
                          <Trash2 {...{ className: "h-4 w-4" }} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Pagination Controls */}
          {rateTypesData?.pagination && (
            <div {...{ className: "flex flex-col sm:flex-row items-center justify-between gap-4 pt-4" }}>
              <div {...{ className: "text-sm text-gray-600" }}>
                Showing {rateTypes.length} of {rateTypesData.pagination.total} rate types
              </div>
              <div {...{ className: "flex items-center gap-2" }}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <div {...{ className: "text-sm" }}>
                  Page {currentPage} of {rateTypesData.pagination.totalPages || 1}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => prev + 1)}
                  disabled={currentPage >= (rateTypesData.pagination.totalPages || 1)}
                >
                  Next
                </Button>
              </div>
            </div>
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
