import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { usersService } from '@/services/users';
import { clientsService } from '@/services/clients';
import { toast } from 'sonner';
import type { User } from '@/types/user';
import type { Client } from '@/types/client';
import { LoadingSpinner } from '@/components/ui/loading';
import { isBackendScopedUser } from '@/utils/userPermissionProfiles';

interface ClientAssignmentSectionProps {
  user: User;
}

export function ClientAssignmentSection({ user }: ClientAssignmentSectionProps) {
  const [selectedClientIds, setSelectedClientIds] = useState<number[]>([]);
  const queryClient = useQueryClient();

  // Fetch all clients
  const { data: clientsData, isLoading: clientsLoading } = useQuery({
    queryKey: ['clients', 'all'],
    queryFn: () => clientsService.getClients({ limit: 100 }),
  });

  // Fetch current user client assignments
  const { data: assignmentsData, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['user-client-assignments', user.id],
    queryFn: () => usersService.getUserClientAssignments(user.id),
  });

  // Update selected clients when assignments data loads
  useEffect(() => {
    if (assignmentsData?.data) {
      const assignedClientIds = assignmentsData.data.map((assignment: { clientId: number }) => assignment.clientId);
      setSelectedClientIds(assignedClientIds);
    }
  }, [assignmentsData]);

  // Save assignments mutation
  const saveAssignmentsMutation = useMutation({
    mutationFn: (clientIds: number[]) => usersService.assignClientsToUser(user.id, clientIds),
    onSuccess: () => {
      toast.success('Client assignments updated successfully');
      // Invalidate all user-related queries to ensure UI updates immediately
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['user-client-assignments', user.id] });
      queryClient.invalidateQueries({ queryKey: ['user-stats'] });
    },
    onError: (error: { response?: { data?: { message?: string } } }) => {
      toast.error(error.response?.data?.message || 'Failed to update client assignments');
    },
  });

  // Only show for BACKEND_USER users (moved after all hooks)
  if (!isBackendScopedUser(user)) {
    return null;
  }

  const clients = clientsData?.data || [];

  const handleClientToggle = (clientId: number, checked: boolean) => {
    if (checked) {
      setSelectedClientIds(prev => [...prev, clientId]);
    } else {
      setSelectedClientIds(prev => prev.filter(id => id !== clientId));
    }
  };

  const handleSaveAssignments = () => {
    saveAssignmentsMutation.mutate(selectedClientIds);
  };

  const isLoading = clientsLoading || assignmentsLoading || saveAssignmentsMutation.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Client Assignments
        </CardTitle>
        <CardDescription>
          Select which clients this user can access
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner size="md" />
          </div>
        ) : (
          <>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {clients.map((client: Client) => (
                <div key={client.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`client-${client.id}`}
                    checked={selectedClientIds.includes(client.id)}
                    onCheckedChange={(checked) => handleClientToggle(client.id, checked as boolean)}
                  />
                  <label
                    htmlFor={`client-${client.id}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {client.name}
                  </label>
                </div>
              ))}
            </div>
            <Button 
              onClick={handleSaveAssignments}
              disabled={saveAssignmentsMutation.isPending}
              className="w-full"
            >
              <Save className="h-4 w-4 mr-2" />
              Save Client Assignments
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
