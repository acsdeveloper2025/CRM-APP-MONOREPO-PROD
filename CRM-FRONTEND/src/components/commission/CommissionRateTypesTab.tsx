import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Edit, Trash2, Settings } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import { commissionManagementService } from '@/services/commissionManagement';
import { CommissionRateTypeForm } from './CommissionRateTypeForm';
import { toast } from 'sonner';
import type { CommissionRateType } from '@/types/commission';

export const CommissionRateTypesTab: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingRateType, setEditingRateType] = useState<CommissionRateType | null>(null);

  const queryClient = useQueryClient();

  // Fetch commission rate types
  const { data: rateTypesData, isLoading } = useQuery({
    queryKey: ['commission-rate-types', searchQuery],
    queryFn: () => commissionManagementService.getCommissionRateTypes({
      search: searchQuery || undefined,
    }),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => commissionManagementService.deleteCommissionRateType(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commission-rate-types'] });
      toast.success('Commission rate type deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to delete commission rate type');
    },
  });

  const rateTypes = rateTypesData?.data || [];

  const handleEdit = (rateType: CommissionRateType) => {
    setEditingRateType(rateType);
  };

  const handleDelete = async (rateType: CommissionRateType) => {
    if (window.confirm(`Are you sure you want to delete the commission rate type for "${rateType.rateTypeName}"?`)) {
      deleteMutation.mutate(rateType.id);
    }
  };

  const handleFormSuccess = () => {
    setIsCreateDialogOpen(false);
    setEditingRateType(null);
    queryClient.invalidateQueries({ queryKey: ['commission-rate-types'] });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Commission Rate Types</h2>
          <p className="text-muted-foreground">
            Configure commission templates for different rate types
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Rate Type
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create Commission Rate Type</DialogTitle>
              <DialogDescription>
                Create a new commission rate type template that can be used for field user assignments.
              </DialogDescription>
            </DialogHeader>
            <CommissionRateTypeForm
              onSuccess={handleFormSuccess}
              onCancel={() => setIsCreateDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search rate types..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rate Types Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Commission Rate Types ({rateTypes.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : rateTypes.length === 0 ? (
            <div className="text-center py-8">
              <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No Commission Rate Types</h3>
              <p className="text-muted-foreground mb-4">
                Create your first commission rate type to get started.
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Rate Type
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rate Type</TableHead>
                  <TableHead>Commission</TableHead>
                  <TableHead>Currency</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rateTypes.map((rateType) => (
                  <TableRow key={rateType.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium text-foreground">
                          {rateType.rateTypeName}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          ID: {rateType.rateTypeId}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {rateType.commissionAmount ? (
                          <span className="text-green-600">
                            {rateType.currency} {rateType.commissionAmount.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-blue-600">
                            {rateType.commissionPercentage}%
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {rateType.commissionAmount ? 'Fixed Amount' : 'Percentage'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{rateType.currency}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={rateType.isActive ? 'default' : 'secondary'}>
                        {rateType.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {new Date(rateType.createdAt).toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(rateType)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(rateType)}
                          disabled={deleteMutation.isPending}
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

      {/* Edit Dialog */}
      <Dialog open={!!editingRateType} onOpenChange={() => setEditingRateType(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Commission Rate Type</DialogTitle>
            <DialogDescription>
              Update the commission rate type details and configuration.
            </DialogDescription>
          </DialogHeader>
          {editingRateType && (
            <CommissionRateTypeForm
              rateType={editingRateType}
              onSuccess={handleFormSuccess}
              onCancel={() => setEditingRateType(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Info Card */}
      <Card className="bg-muted/50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Settings className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-2">About Commission Rate Types</h3>
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>• Commission rate types serve as templates for field user assignments</p>
                <p>• You can set either a fixed amount or percentage-based commission</p>
                <p>• Rate types are linked to existing rate types from the rate management system</p>
                <p>• Inactive rate types cannot be assigned to new field users</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
