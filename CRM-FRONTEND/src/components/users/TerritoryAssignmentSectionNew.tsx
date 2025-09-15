import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { MapPin, Loader2, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { territoryAssignmentService } from '@/services/territoryAssignments';
import { usePincodes } from '@/hooks/useLocations';
import type { User as UserType } from '@/types/user';

interface TerritoryAssignmentSectionProps {
  user: UserType;
}

export function TerritoryAssignmentSection({ user }: TerritoryAssignmentSectionProps) {
  const [selectedPincodeIds, setSelectedPincodeIds] = useState<number[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const queryClient = useQueryClient();

  // Fetch available pincodes
  const { data: pincodesData, isLoading: pincodesLoading } = usePincodes();

  // Fetch current territory assignments
  const { data: territoryData, isLoading: territoryLoading } = useQuery({
    queryKey: ['user-territory-assignments', user.id],
    queryFn: () => territoryAssignmentService.getFieldAgentTerritoryById(user.id),
    enabled: !!user.id,
  });

  // Save assignments mutation
  const saveAssignmentsMutation = useMutation({
    mutationFn: (pincodeIds: number[]) => territoryAssignmentService.assignPincodesToFieldAgent(user.id, { pincodeIds }),
    onSuccess: () => {
      toast.success('Territory assignments updated successfully');
      setHasChanges(false);
      // Invalidate all queries related to this user to ensure Permission Summary updates
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const queryKey = query.queryKey;
          return (
            (Array.isArray(queryKey) && queryKey.includes(user.id)) ||
            (Array.isArray(queryKey) && queryKey[0] === 'user-territory-assignments') ||
            (Array.isArray(queryKey) && queryKey[0] === 'user' && queryKey[1] === user.id)
          );
        }
      });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update territory assignments');
    },
  });

  const pincodes = pincodesData?.data || [];
  const currentAssignments = territoryData?.data?.territoryAssignments || [];

  // Initialize selected pincodes from current assignments
  useEffect(() => {
    if (currentAssignments.length > 0) {
      const assignedPincodeIds = currentAssignments.map(assignment => assignment.pincodeId);
      setSelectedPincodeIds(assignedPincodeIds);
    }
  }, [currentAssignments]);

  // Handle pincode selection
  const handlePincodeToggle = (pincodeId: number, checked: boolean) => {
    setSelectedPincodeIds(prev => {
      const newSelection = checked 
        ? [...prev, pincodeId]
        : prev.filter(id => id !== pincodeId);
      
      // Check if there are changes
      const currentIds = currentAssignments.map(assignment => assignment.pincodeId).sort();
      const newIds = newSelection.sort();
      setHasChanges(JSON.stringify(currentIds) !== JSON.stringify(newIds));
      
      return newSelection;
    });
  };

  // Handle save
  const handleSave = () => {
    saveAssignmentsMutation.mutate(selectedPincodeIds);
  };

  if (territoryLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <span>Loading territory assignments...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <MapPin className="h-5 w-5" />
          <span>Territory Assignments</span>
        </CardTitle>
        <CardDescription>
          Assign pincodes to this field agent for case routing and territory management
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Assignments Summary */}
        {currentAssignments.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Current Assignments ({currentAssignments.length} pincodes)</h4>
            <div className="flex flex-wrap gap-1">
              {currentAssignments.map((assignment) => (
                <Badge key={assignment.pincodeId} variant="secondary" className="text-xs">
                  {assignment.pincodeCode} - {assignment.cityName}
                </Badge>
              ))}
            </div>
            <Separator />
          </div>
        )}

        {/* Pincode Selection */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Available Pincodes</h4>
            <div className="text-sm text-muted-foreground">
              {selectedPincodeIds.length} selected
            </div>
          </div>

          {pincodesLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              <span className="text-sm text-muted-foreground">Loading pincodes...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto border rounded-md p-4">
              {pincodes.map((pincode) => (
                <div key={pincode.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`pincode-${pincode.id}`}
                    checked={selectedPincodeIds.includes(pincode.id)}
                    onCheckedChange={(checked) => handlePincodeToggle(pincode.id, checked as boolean)}
                    disabled={saveAssignmentsMutation.isPending}
                  />
                  <label
                    htmlFor={`pincode-${pincode.id}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                  >
                    <div>
                      <div className="font-medium">{pincode.code}</div>
                      <div className="text-xs text-muted-foreground">
                        {pincode.cityName}, {pincode.state}
                      </div>
                    </div>
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Save Button */}
        <div className="flex justify-end space-x-2">
          <Button
            onClick={handleSave}
            disabled={!hasChanges || saveAssignmentsMutation.isPending}
            className="min-w-[120px]"
          >
            {saveAssignmentsMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Assignments
              </>
            )}
          </Button>
        </div>

        {/* Info */}
        <div className="text-xs text-muted-foreground text-center pt-2 border-t">
          <p>
            {hasChanges 
              ? '⚠️ You have unsaved changes. Click "Save Assignments" to apply them.'
              : '✓ All changes are saved.'
            }
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
