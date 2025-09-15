import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useFieldUsers } from '@/hooks/useUsers';
import { Loader2, User } from 'lucide-react';
import type { Case } from '@/types/case';

interface ReassignCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReassign: (assignedToId: string, reason: string) => void;
  case: Case;
  isLoading?: boolean;
}

export const ReassignCaseModal: React.FC<ReassignCaseModalProps> = ({
  isOpen,
  onClose,
  onReassign,
  case: caseItem,
  isLoading = false,
}) => {
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const { data: fieldUsers, isLoading: loadingUsers } = useFieldUsers();

  const handleSubmit = () => {
    if (!selectedUserId || !reason.trim()) {
      return;
    }
    onReassign(selectedUserId, reason.trim());
  };

  const handleClose = () => {
    setSelectedUserId('');
    setReason('');
    onClose();
  };

  const selectedUser = fieldUsers?.find(user => user.id === selectedUserId);
  const currentAssignee = caseItem.assignedToName || 'Unassigned';

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <User className="h-5 w-5" />
            <span>Reassign Case</span>
          </DialogTitle>
          <DialogDescription>
            Reassign case #{caseItem.caseId || caseItem.id} to a different field agent.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current Assignment Info */}
          <div className="bg-muted p-3 rounded-lg">
            <div className="text-sm">
              <span className="font-medium">Currently assigned to:</span>{' '}
              <span className="text-blue-600">{currentAssignee}</span>
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              Case: {caseItem.applicantName} - {caseItem.address}
            </div>
          </div>

          {/* Field Agent Selection */}
          <div className="space-y-2">
            <Label htmlFor="assignedTo">Reassign to Field Agent *</Label>
            <Select 
              value={selectedUserId} 
              onValueChange={setSelectedUserId}
              disabled={loadingUsers || isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select field agent" />
              </SelectTrigger>
              <SelectContent>
                {loadingUsers ? (
                  <SelectItem value="loading" disabled>
                    <div className="flex items-center space-x-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Loading field agents...</span>
                    </div>
                  </SelectItem>
                ) : !fieldUsers || fieldUsers.length === 0 ? (
                  <SelectItem value="no-users" disabled>
                    No field agents available
                  </SelectItem>
                ) : (
                  fieldUsers
                    .filter(user => user.id !== caseItem.assignedTo) // Exclude current assignee
                    .map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        <div className="flex items-center space-x-2">
                          <User className="h-4 w-4" />
                          <span>{user.name} ({user.email})</span>
                        </div>
                      </SelectItem>
                    ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Reassignment Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">Reason for Reassignment *</Label>
            <Textarea
              id="reason"
              placeholder="Please provide a reason for this reassignment..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isLoading}
              rows={3}
            />
          </div>

          {/* Selected User Preview */}
          {selectedUser && (
            <div className="bg-blue-50 p-3 rounded-lg">
              <div className="text-sm">
                <span className="font-medium">Will be assigned to:</span>{' '}
                <span className="text-blue-600">{selectedUser.name}</span>
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                Email: {selectedUser.email}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={handleClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={!selectedUserId || !reason.trim() || isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Reassigning...
              </>
            ) : (
              'Reassign Case'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
