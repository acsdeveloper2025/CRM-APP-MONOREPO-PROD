import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Search, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { SearchableSelect, SearchableSelectOption } from '@/components/ui/searchable-select';
import { commissionManagementApi } from '../../services/commissionManagementApi';
import { FieldUserCommissionAssignment, CreateFieldUserCommissionAssignmentData } from '../../types/commission';
import { User } from '../../types/user';
import { RateType } from '../../types/rateType';
import { userApi } from '../../services/userApi';
import { rateTypeApi } from '../../services/rateTypeApi';

interface FieldUserAssignmentFormData {
  userId: string;
  rateTypeId: number;
  commissionAmount: number;
  currency: string;
  clientId?: number;
  effectiveFrom?: string;
  effectiveTo?: string;
}

export const FieldUserAssignmentsTab: React.FC = () => {
  const [assignments, setAssignments] = useState<FieldUserCommissionAssignment[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [rateTypes, setRateTypes] = useState<RateType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<FieldUserCommissionAssignment | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterUserId, setFilterUserId] = useState('');
  const [filterRateTypeId, setFilterRateTypeId] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [formData, setFormData] = useState<FieldUserAssignmentFormData>({
    userId: '',
    rateTypeId: 0,
    commissionAmount: 0,
    currency: 'INR'
  });

  useEffect(() => {
    loadData();
  }, [currentPage, searchTerm, filterUserId, filterRateTypeId]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load assignments with filters
      const assignmentsResponse = await commissionManagementApi.getFieldUserCommissionAssignments({
        page: currentPage,
        limit: 20,
        search: searchTerm,
        userId: filterUserId || undefined,
        rateTypeId: filterRateTypeId ? Number(filterRateTypeId) : undefined
      });

      setAssignments(assignmentsResponse.data);
      setTotalPages(assignmentsResponse.pagination.totalPages);

      // Load users and rate types for dropdowns
      const [usersResponse, rateTypesResponse] = await Promise.all([
        userApi.getUsers({ role: 'FIELD_AGENT', limit: 100 }),
        rateTypeApi.getRateTypes({ isActive: true })
      ]);

      setUsers(usersResponse.data);
      setRateTypes(rateTypesResponse.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const assignmentData: CreateFieldUserCommissionAssignmentData = {
        userId: formData.userId,
        rateTypeId: formData.rateTypeId,
        commissionAmount: formData.commissionAmount,
        currency: formData.currency,
        clientId: formData.clientId,
        effectiveFrom: formData.effectiveFrom,
        effectiveTo: formData.effectiveTo
      };

      if (editingAssignment) {
        await commissionManagementApi.updateFieldUserCommissionAssignment(
          String(editingAssignment.id),
          assignmentData
        );
      } else {
        await commissionManagementApi.createFieldUserCommissionAssignment(assignmentData);
      }

      setShowForm(false);
      setEditingAssignment(null);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Error saving assignment:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      userId: '',
      rateTypeId: 0,
      commissionAmount: 0,
      currency: 'INR'
    });
  };

  const handleEdit = (assignment: FieldUserCommissionAssignment) => {
    setEditingAssignment(assignment);
    setFormData({
      userId: assignment.user_id,
      rateTypeId: assignment.rate_type_id,
      commissionAmount: Number(assignment.commission_amount),
      currency: assignment.currency,
      clientId: assignment.client_id || undefined,
      effectiveFrom: assignment.effective_from ? new Date(assignment.effective_from).toISOString().split('T')[0] : undefined,
      effectiveTo: assignment.effective_to ? new Date(assignment.effective_to).toISOString().split('T')[0] : undefined
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this assignment?')) {
      try {
        await commissionManagementApi.deleteFieldUserCommissionAssignment(id);
        loadData();
      } catch (error) {
        console.error('Error deleting assignment:', error);
      }
    }
  };

  const exportData = () => {
    const csvContent = [
      ['User Name', 'Rate Type', 'Commission Amount', 'Currency', 'Effective From', 'Effective To', 'Status'].join(','),
      ...assignments.map(assignment => [
        assignment.user_name || '',
        assignment.rate_type_name || '',
        assignment.commission_amount,
        assignment.currency,
        assignment.effective_from ? new Date(assignment.effective_from).toLocaleDateString() : '',
        assignment.effective_to ? new Date(assignment.effective_to).toLocaleDateString() : '',
        assignment.is_active ? 'Active' : 'Inactive'
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `field-user-assignments-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Commission Rate Assignments
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-2">
            Configure commission rates for field users by rate type and client (not for case assignments)
          </p>
        </CardHeader>
        <CardContent className="p-6">
          {/* Search and Filter Section */}
          <div className="space-y-4 mb-6">
            <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <Input
                    placeholder="Search assignments..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-64"
                  />
                </div>

                <div className="w-48">
                  <SearchableSelect
                    options={[
                      { value: '', label: 'All Users' },
                      ...(users || []).map(user => ({
                        value: user.id,
                        label: user.name,
                        description: user.email
                      }))
                    ]}
                    value={filterUserId}
                    onValueChange={setFilterUserId}
                    placeholder="Filter by user..."
                    searchPlaceholder="Search users..."
                  />
                </div>

                <div className="w-48">
                  <SearchableSelect
                    options={[
                      { value: '', label: 'All Rate Types' },
                      ...(rateTypes || []).map(rateType => ({
                        value: rateType.id.toString(),
                        label: rateType.name,
                        description: `Rate: ${rateType.rate_amount || 'Not set'}`
                      }))
                    ]}
                    value={filterRateTypeId}
                    onValueChange={setFilterRateTypeId}
                    placeholder="Filter by rate type..."
                    searchPlaceholder="Search rate types..."
                  />
                </div>
              </div>

              <div className="flex gap-2 flex-shrink-0">
                <Button
                  onClick={exportData}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Export
                </Button>
                <Button
                  onClick={() => {
                    setShowForm(true);
                    setEditingAssignment(null);
                    resetForm();
                  }}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Rate Assignment
                </Button>
              </div>
            </div>
          </div>

          {/* Assignments Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Rate Type</TableHead>
                  <TableHead>Commission</TableHead>
                  <TableHead>Effective Period</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.map((assignment) => (
                  <TableRow key={assignment.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{assignment.user_name}</div>
                        <div className="text-sm text-muted-foreground">{assignment.user_email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{assignment.rate_type_name}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {assignment.currency} {assignment.commission_amount}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>From: {assignment.effective_from ? new Date(assignment.effective_from).toLocaleDateString() : 'N/A'}</div>
                        <div>To: {assignment.effective_to ? new Date(assignment.effective_to).toLocaleDateString() : 'Ongoing'}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={assignment.is_active ? "default" : "secondary"}>
                        {assignment.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(assignment)}
                          className="h-8 w-8"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(String(assignment.id))}
                          className="h-8 w-8 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center mt-6">
              <div className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assignment Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingAssignment ? 'Edit Commission Rate Assignment' : 'Create Commission Rate Assignment'}
            </DialogTitle>
            <DialogDescription>
              {editingAssignment
                ? 'Update the commission rate assignment details for the selected field user.'
                : 'Create a new commission rate assignment for a field user. This will determine their commission rate for specific verification types.'
              }
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="userId">Field User *</Label>
                <SearchableSelect
                  options={(users || []).map(user => ({
                    value: user.id,
                    label: user.name,
                    description: user.email
                  }))}
                  value={formData.userId}
                  onValueChange={(value) => setFormData({ ...formData, userId: value })}
                  placeholder="Search and select field user..."
                  searchPlaceholder="Search by name or email..."
                  emptyMessage="No field users found"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="rateTypeId">Rate Type *</Label>
                <SearchableSelect
                  options={(rateTypes || []).map(rateType => ({
                    value: rateType.id.toString(),
                    label: rateType.name,
                    description: `Rate: ${rateType.rate_amount || 'Not set'}`
                  }))}
                  value={formData.rateTypeId ? formData.rateTypeId.toString() : ''}
                  onValueChange={(value) => setFormData({ ...formData, rateTypeId: value ? Number(value) : 0 })}
                  placeholder="Search and select rate type..."
                  searchPlaceholder="Search rate types..."
                  emptyMessage="No rate types found"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="currency">Currency *</Label>
                  <Select
                    value={formData.currency}
                    onValueChange={(value) => setFormData({ ...formData, currency: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Currency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INR">INR</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="commissionAmount">Commission Amount *</Label>
                  <Input
                    id="commissionAmount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.commissionAmount}
                    onChange={(e) => setFormData({ ...formData, commissionAmount: Number(e.target.value) })}
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowForm(false);
                  setEditingAssignment(null);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button type="submit">
                {editingAssignment ? 'Update Assignment' : 'Create Assignment'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
