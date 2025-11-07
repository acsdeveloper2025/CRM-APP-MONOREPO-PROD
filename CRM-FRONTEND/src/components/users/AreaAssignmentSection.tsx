import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapPin, Save } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { usersService } from '@/services/users';
import type { User } from '@/types/user';

interface AreaAssignmentSectionProps {
  user: User;
}

export function AreaAssignmentSection({ user }: AreaAssignmentSectionProps) {
  const queryClient = useQueryClient();
  const [selectedAreaIds, setSelectedAreaIds] = useState<number[]>([]);

  // Fetch all areas from backend
  const { data: areasData, isLoading: areasLoading } = useQuery({
    queryKey: ['areas', 'all'],
    queryFn: async () => {
      const response = await fetch('/api/areas?limit=1000');
      const data = await response.json();
      return data;
    },
  });

  // Fetch current user area assignments from territory assignments
  const { data: assignmentsData, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['user-area-assignments', user.id],
    queryFn: () => usersService.getUserPincodeAssignments(user.id),
  });

  // Update selected areas when assignments data loads
  useEffect(() => {
    if (assignmentsData?.data?.territoryAssignments) {
      // Extract all area IDs from assignedAreas field (which is a JSON array)
      const areaIds: number[] = [];
      assignmentsData.data.territoryAssignments.forEach((assignment: any) => {
        if (assignment.assignedAreas && Array.isArray(assignment.assignedAreas)) {
          assignment.assignedAreas.forEach((area: any) => {
            if (area.areaId && !areaIds.includes(area.areaId)) {
              areaIds.push(area.areaId);
            }
          });
        }
      });
      setSelectedAreaIds(areaIds);
    }
  }, [assignmentsData]);

  // Save assignments mutation
  const saveAssignmentsMutation = useMutation({
    mutationFn: (areaIds: number[]) => usersService.assignAreasToUser(user.id, areaIds),
    onSuccess: () => {
      toast.success('Area assignments updated successfully');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['user-area-assignments', user.id] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update area assignments');
    },
  });

  const handleToggleArea = (areaId: number) => {
    setSelectedAreaIds(prev =>
      prev.includes(areaId) ? prev.filter(id => id !== areaId) : [...prev, areaId]
    );
  };

  const handleSave = () => {
    saveAssignmentsMutation.mutate(selectedAreaIds);
  };

  const areas = areasData?.data || [];
  const isLoading = areasLoading || assignmentsLoading;

  return (
    <Card className="border-gray-200">
      <CardHeader className="bg-[#FAFAFA]">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-[#10B981]" />
          <CardTitle className="text-lg font-semibold text-[#1F2937]">Area Assignments</CardTitle>
        </div>
        <CardDescription className="text-sm text-gray-600">
          Select which areas this field agent can access
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-sm text-gray-500">Loading areas...</div>
          </div>
        ) : (
          <>
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              {areas.length === 0 ? (
                <div className="text-sm text-gray-500 text-center py-4">No areas available</div>
              ) : (
                areas.map((area: any) => (
                  <div key={area.id} className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded">
                    <Checkbox
                      id={`area-${area.id}`}
                      checked={selectedAreaIds.includes(parseInt(area.id))}
                      onCheckedChange={() => handleToggleArea(parseInt(area.id))}
                      className="border-gray-300"
                    />
                    <label
                      htmlFor={`area-${area.id}`}
                      className="text-sm font-medium text-[#1F2937] cursor-pointer flex-1"
                    >
                      {area.name}
                    </label>
                  </div>
                ))
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-gray-200">
              <Button
                onClick={handleSave}
                disabled={saveAssignmentsMutation.isPending}
                className="w-full bg-[#10B981] hover:bg-[#059669] text-white"
              >
                <Save className="mr-2 h-4 w-4" />
                {saveAssignmentsMutation.isPending ? 'Saving...' : 'Save Area Assignments'}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

