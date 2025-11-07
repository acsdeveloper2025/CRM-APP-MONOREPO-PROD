import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapPin, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { usersService } from '@/services/users';
import { locationsService } from '@/services/locations';
import { toast } from 'sonner';
import type { User } from '@/types/user';
import { LoadingSpinner } from '@/components/ui/loading';

interface PincodeAssignmentSectionProps {
  user: User;
}

export function PincodeAssignmentSection({ user }: PincodeAssignmentSectionProps) {
  const [selectedPincodeIds, setSelectedPincodeIds] = useState<number[]>([]);
  const queryClient = useQueryClient();

  // Only show for FIELD_AGENT users
  if (user.role !== 'FIELD_AGENT') {
    return null;
  }

  // Fetch all pincodes
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { data: pincodesData, isLoading: pincodesLoading } = useQuery({
    queryKey: ['pincodes', 'all'],
    queryFn: () => locationsService.getPincodes({ limit: 1000 }),
  });

  // Fetch current user pincode assignments
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { data: assignmentsData, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['user-pincode-assignments', user.id],
    queryFn: () => usersService.getUserPincodeAssignments(user.id),
  });

  // Update selected pincodes when assignments data loads
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (assignmentsData?.data?.territoryAssignments) {
      const assignedPincodeIds = assignmentsData.data.territoryAssignments.map((assignment: any) => assignment.pincodeId);
      setSelectedPincodeIds(assignedPincodeIds);
    }
  }, [assignmentsData]);

  // Save assignments mutation
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const saveAssignmentsMutation = useMutation({
    mutationFn: (pincodeIds: number[]) => usersService.assignPincodesToUser(user.id, pincodeIds),
    onSuccess: () => {
      toast.success('Pincode assignments updated successfully');
      // Invalidate all queries related to this user
      queryClient.invalidateQueries({
        predicate: (query) => {
          const queryKey = query.queryKey;
          return (
            (Array.isArray(queryKey) && queryKey.includes(user.id)) ||
            (Array.isArray(queryKey) && queryKey[0] === 'user-pincode-assignments') ||
            (Array.isArray(queryKey) && queryKey[0] === 'user' && queryKey[1] === user.id)
          );
        }
      });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update pincode assignments');
    },
  });

  const pincodes = pincodesData?.data || [];

  const handlePincodeToggle = (pincodeId: number, checked: boolean) => {
    if (checked) {
      setSelectedPincodeIds(prev => [...prev, pincodeId]);
    } else {
      setSelectedPincodeIds(prev => prev.filter(id => id !== pincodeId));
    }
  };

  const handleSaveAssignments = () => {
    saveAssignmentsMutation.mutate(selectedPincodeIds);
  };

  const isLoading = pincodesLoading || assignmentsLoading || saveAssignmentsMutation.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Pincode Assignments
        </CardTitle>
        <CardDescription>
          Select which pincodes this field agent can access
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
              {pincodes.map((pincode: any) => (
                <div key={pincode.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`pincode-${pincode.id}`}
                    checked={selectedPincodeIds.includes(parseInt(pincode.id))}
                    onCheckedChange={(checked) => handlePincodeToggle(parseInt(pincode.id), checked as boolean)}
                  />
                  <label
                    htmlFor={`pincode-${pincode.id}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    {pincode.code} - {pincode.cityName}, {pincode.state}
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
              Save Pincode Assignments
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

