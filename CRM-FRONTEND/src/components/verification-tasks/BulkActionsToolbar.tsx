import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Users,
  X,
  UserCheck,
  AlertTriangle,
  User
} from 'lucide-react';
import { useUsers } from '@/hooks/useUsers';

interface BulkActionsToolbarProps {
  selectedCount: number;
  onBulkAssign: (assignedTo: string, reason?: string) => Promise<void>;
  onClearSelection: () => void;
}

export const BulkActionsToolbar: React.FC<BulkActionsToolbarProps> = ({
  selectedCount,
  onBulkAssign,
  onClearSelection
}) => {
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [assignmentReason, setAssignmentReason] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const { data: usersData } = useUsers();
  const fieldUsers = usersData?.data?.filter(user => user.role === 'FIELD_USER') || [];

  const handleBulkAssign = async () => {
    if (!assignedTo) {return;}

    setLoading(true);
    try {
      await onBulkAssign(assignedTo, assignmentReason || undefined);
      setShowAssignModal(false);
      setAssignedTo('');
      setAssignmentReason('');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseModal = () => {
    setShowAssignModal(false);
    setAssignedTo('');
    setAssignmentReason('');
  };

  return (
    <>
      <Card className="border-green-200 bg-green-50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-green-600" />
                <span className="font-medium text-green-900">
                  Bulk Actions
                </span>
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  {selectedCount} selected
                </Badge>
              </div>
              
              <div className="flex items-center space-x-2">
                <Button
                  onClick={() => setShowAssignModal(true)}
                  size="sm"
                  variant="outline"
                  className="border-blue-300 text-green-700 hover:bg-green-100"
                >
                  <UserCheck className="h-4 w-4 mr-2" />
                  Assign Tasks
                </Button>
              </div>
            </div>

            <Button
              onClick={onClearSelection}
              variant="ghost"
              size="sm"
              className="text-green-600 hover:text-green-700 hover:bg-green-100"
            >
              <X className="h-4 w-4 mr-1" />
              Clear Selection
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Assignment Modal */}
      <Dialog open={showAssignModal} onOpenChange={handleCloseModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <UserCheck className="h-5 w-5" />
              <span>Bulk Assign Tasks</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Selection Summary */}
            <Card className="bg-gray-50 border-gray-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Assigning {selectedCount} task{selectedCount !== 1 ? 's' : ''}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      All selected tasks will be assigned to the chosen user
                    </p>
                  </div>
                  <Badge className="bg-green-100 text-green-800">
                    {selectedCount} Task{selectedCount !== 1 ? 's' : ''}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Assignment Form */}
            <div className="space-y-4">
              {/* Field User Selection */}
              <div className="space-y-2">
                <Label htmlFor="bulkAssignedTo">
                  Assign To <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={assignedTo}
                  onValueChange={setAssignedTo}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a field user">
                      {assignedTo && (
                        <div className="flex items-center space-x-2">
                          <User className="h-4 w-4" />
                          <span>
                            {fieldUsers.find(user => user.id === assignedTo)?.name}
                          </span>
                        </div>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {fieldUsers.length === 0 ? (
                      <div className="p-2 text-sm text-gray-500">
                        No field users available
                      </div>
                    ) : (
                      fieldUsers.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          <div className="flex items-center space-x-2">
                            <User className="h-4 w-4" />
                            <div>
                              <div className="font-medium">{user.name}</div>
                              <div className="text-xs text-gray-500">{user.email}</div>
                            </div>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Assignment Reason */}
              <div className="space-y-2">
                <Label htmlFor="bulkAssignmentReason">
                  Assignment Reason (Optional)
                </Label>
                <Textarea
                  id="bulkAssignmentReason"
                  value={assignmentReason}
                  onChange={(e) => setAssignmentReason(e.target.value)}
                  placeholder="Explain why these tasks are being assigned to this user..."
                  rows={3}
                />
                <p className="text-xs text-gray-500">
                  This reason will be applied to all selected tasks and visible in audit logs.
                </p>
              </div>
            </div>

            {/* Warning */}
            <Card className="bg-yellow-50 border-yellow-200">
              <CardContent className="p-4">
                <div className="flex items-start space-x-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div className="text-sm text-yellow-800">
                    <p className="font-medium">Bulk Assignment Warning</p>
                    <p className="mt-1">
                      This action will assign all {selectedCount} selected task{selectedCount !== 1 ? 's' : ''} to the chosen user. 
                      This action cannot be undone in bulk.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Assignment Summary */}
            {assignedTo && (
              <Card className="bg-green-50 border-green-200">
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-green-900">
                      Assignment Summary
                    </p>
                    <div className="text-sm text-green-800">
                      <p>
                        <span className="font-medium">Assignee:</span>{' '}
                        {fieldUsers.find(user => user.id === assignedTo)?.name}
                      </p>
                      <p>
                        <span className="font-medium">Tasks:</span>{' '}
                        {selectedCount} task{selectedCount !== 1 ? 's' : ''}
                      </p>
                      {assignmentReason && (
                        <p>
                          <span className="font-medium">Reason:</span>{' '}
                          {assignmentReason.length > 50 
                            ? `${assignmentReason.substring(0, 50)}...` 
                            : assignmentReason
                          }
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <div className="flex justify-end space-x-3">
              <Button onClick={handleCloseModal} variant="outline">
                Cancel
              </Button>
              <Button 
                onClick={handleBulkAssign} 
                disabled={loading || !assignedTo}
              >
                {loading ? 'Assigning...' : `Assign ${selectedCount} Task${selectedCount !== 1 ? 's' : ''}`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
