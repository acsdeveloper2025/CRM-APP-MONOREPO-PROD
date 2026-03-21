import React, { useState } from 'react';
import { Loader2, User } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/components/Dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/components/Select';
import { useFieldUsers } from '@/hooks/useUsers';
import type { Case } from '@/types/case';
import { Button } from '@/ui/components/Button';
import { Textarea } from '@/ui/components/Textarea';
import { Card } from '@/ui/components/Card';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';

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
  
  // Use legacy assignedToId to lookup name as assignedTo object is deprecated
  const currentAssigneeUser = fieldUsers?.find(user => user.id === caseItem.assignedToId);
  const currentAssignee = currentAssigneeUser?.name || 'Unassigned';

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent style={{ maxWidth: 540 }}>
        <DialogHeader>
          <DialogTitle style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <User size={18} />
            <span>Reassign Case</span>
          </DialogTitle>
          <DialogDescription>
            Reassign case #{caseItem.caseId || caseItem.id} to a different field agent.
          </DialogDescription>
        </DialogHeader>

        <Stack gap={4} style={{ paddingTop: 8, paddingBottom: 8 }}>
          <Card tone="muted" staticCard>
            <Stack gap={1}>
              <Text variant="label" tone="soft">Currently assigned</Text>
              <Text variant="body" tone="accent">{currentAssignee}</Text>
              <Text variant="body-sm" tone="muted">
                Case: {caseItem.applicantName} - {caseItem.address}
              </Text>
            </Stack>
          </Card>

          <Stack gap={2}>
            <Text as="label" htmlFor="assignedTo" variant="label" tone="soft">
              Reassign to Field Agent *
            </Text>
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Loader2 size={16} {...{ className: "animate-spin" }} />
                      <span>Loading field agents...</span>
                    </div>
                  </SelectItem>
                ) : !fieldUsers || fieldUsers.length === 0 ? (
                  <SelectItem value="no-users" disabled>
                    No field agents available
                  </SelectItem>
                ) : (
                  fieldUsers
                    .filter(user => user.id !== caseItem.assignedToId) // Exclude current assignee (using legacy field)
                    .map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <User size={16} />
                          <span>{user.name} ({user.email})</span>
                        </div>
                      </SelectItem>
                    ))
                )}
              </SelectContent>
            </Select>
          </Stack>

          <Stack gap={2}>
            <Text as="label" htmlFor="reason" variant="label" tone="soft">
              Reason for Reassignment *
            </Text>
            <Textarea
              id="reason"
              placeholder="Please provide a reason for this reassignment..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isLoading}
              rows={3}
            />
          </Stack>

          {selectedUser && (
            <Card tone="highlight" staticCard>
              <Stack gap={1}>
                <Text variant="label" tone="soft">Will be assigned to</Text>
                <Text variant="body" tone="accent">{selectedUser.name}</Text>
                <Text variant="body-sm" tone="muted">
                Email: {selectedUser.email}
                </Text>
              </Stack>
            </Card>
          )}
        </Stack>

        <DialogFooter>
          <Button variant="secondary" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!selectedUserId || !reason.trim() || isLoading}>
            {isLoading ? (
              <>
                <Loader2 size={16} {...{ className: "animate-spin" }} />
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
