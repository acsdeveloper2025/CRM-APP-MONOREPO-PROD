import React, { useState, useEffect } from 'react';
import { Search, UserCheck, Loader2 } from 'lucide-react';
import { useFieldUsers } from '@/hooks/useUsers';
import { User } from '@/types/user';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/ui/components/Dialog';
import { Button } from '@/ui/components/Button';
import { Input } from '@/ui/components/Input';
import { Badge } from '@/ui/components/Badge';
import { Card } from '@/ui/components/Card';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';

interface UserSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectUser: (userId: string, userName: string) => void;
  currentAssignedUserId?: string;
  title?: string;
}

export const UserSelectionModal: React.FC<UserSelectionModalProps> = ({
  isOpen,
  onClose,
  onSelectUser,
  currentAssignedUserId,
  title = "Assign to Field Agent"
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  
  const { data: fieldUsers, isLoading, error } = useFieldUsers();

  // Filter users based on search term
  const filteredUsers = fieldUsers?.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  // Reset search when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setSelectedUserId(currentAssignedUserId || null);
    }
  }, [isOpen, currentAssignedUserId]);

  const handleSelectUser = (user: User) => {
    setSelectedUserId(user.id);
  };

  const handleConfirmSelection = () => {
    if (selectedUserId) {
      const selectedUser = fieldUsers?.find(user => user.id === selectedUserId);
      if (selectedUser) {
        onSelectUser(selectedUser.id, selectedUser.name);
        onClose();
      }
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent style={{ maxWidth: 540 }}>
        <DialogHeader>
          <DialogTitle style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <UserCheck size={18} />
            {title}
          </DialogTitle>
        </DialogHeader>

        <Stack gap={4}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--ui-text-soft)' }} />
            <Input
              placeholder="Search field agents..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: 42 }}
            />
          </div>

          <Stack gap={2} style={{ maxHeight: 320, overflowY: 'auto' }}>
            {isLoading ? (
              <div {...{ className: "ui-empty-state" }}>
                <Loader2 size={22} {...{ className: "animate-spin" }} />
                <Text variant="body">Loading field agents...</Text>
              </div>
            ) : error ? (
              <div {...{ className: "ui-empty-state" }}>
                <Text variant="body">Error loading field agents</Text>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div {...{ className: "ui-empty-state" }}>
                <Text variant="body">No field agents found</Text>
                {searchTerm && (
                  <Text variant="body-sm" tone="muted">Try adjusting your search terms</Text>
                )}
              </div>
            ) : (
              filteredUsers.map((user) => (
                <Card
                  key={user.id}
                  tone={selectedUserId === user.id ? 'highlight' : 'muted'}
                  onClick={() => handleSelectUser(user)}
                  style={{ cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 999,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'var(--ui-accent-soft)',
                        color: 'var(--ui-accent-strong)',
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {getInitials(user.name)}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <Text variant="body" style={{ fontWeight: 600 }}>{user.name}</Text>
                      {currentAssignedUserId === user.id && (
                        <Badge variant="neutral">
                          Current
                        </Badge>
                      )}
                      </div>
                    {user.email && (
                      <Text variant="body-sm" tone="muted" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {user.email}
                      </Text>
                    )}
                    </div>

                  {selectedUserId === user.id && (
                      <UserCheck size={18} style={{ color: 'var(--ui-accent)' }} />
                  )}
                  </div>
                </Card>
              ))
            )}
          </Stack>

          <div style={{ display: 'flex', gap: 12, paddingTop: 8 }}>
            <Button variant="secondary" onClick={onClose} fullWidth>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmSelection}
              disabled={!selectedUserId || selectedUserId === currentAssignedUserId}
              fullWidth
            >
              {selectedUserId === currentAssignedUserId ? 'No Change' : 'Assign User'}
            </Button>
          </div>
        </Stack>
      </DialogContent>
    </Dialog>
  );
};
