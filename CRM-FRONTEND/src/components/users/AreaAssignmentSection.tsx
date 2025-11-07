import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapPin, Save, Search, Info } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { usersService } from '@/services/users';
import { locationsService } from '@/services/locations';
import type { User } from '@/types/user';
import { LoadingSpinner } from '@/components/ui/loading';

interface AreaAssignmentSectionProps {
  user: User;
  selectedPincodeIds: number[];
}

export function AreaAssignmentSection({ user, selectedPincodeIds }: AreaAssignmentSectionProps) {
  const queryClient = useQueryClient();
  const [selectedAreaIds, setSelectedAreaIds] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch all areas from backend using the service
  const { data: areasData, isLoading: areasLoading } = useQuery({
    queryKey: ['areas', 'all'],
    queryFn: () => locationsService.getAreas({ limit: 1000 }),
  });

  // Fetch current user area assignments from territory assignments
  const { data: assignmentsData, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['user-area-assignments', user.id],
    queryFn: () => usersService.getUserPincodeAssignments(user.id),
  });

  // Fetch areas for selected pincodes to enable smart filtering
  const { data: pincodeAreasData } = useQuery({
    queryKey: ['pincode-areas', selectedPincodeIds],
    queryFn: async () => {
      if (selectedPincodeIds.length === 0) return [];

      // Fetch areas for each selected pincode
      const areasPromises = selectedPincodeIds.map((pincodeId: number) =>
        locationsService.getAreasByPincode(pincodeId)
      );

      const results = await Promise.all(areasPromises);

      // Combine all areas and remove duplicates
      const allAreas = results.flatMap((result: any) => result.data || []);
      const uniqueAreaIds = new Set(allAreas.map((area: any) => parseInt(area.id)));

      return Array.from(uniqueAreaIds);
    },
    enabled: selectedPincodeIds.length > 0,
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

  // Get all areas and apply smart filtering
  const allAreas = areasData?.data || [];
  const allowedAreaIds = pincodeAreasData || [];

  // Filter areas based on selected pincodes (smart filtering)
  const availableAreas = useMemo(() => {
    if (selectedPincodeIds.length === 0) {
      // No pincodes selected, show all areas
      return allAreas;
    }

    // Only show areas that belong to selected pincodes
    return allAreas.filter((area: any) =>
      allowedAreaIds.includes(parseInt(area.id))
    );
  }, [allAreas, allowedAreaIds, selectedPincodeIds.length]);

  // Apply search filter
  const filteredAreas = useMemo(() => {
    if (!searchQuery.trim()) return availableAreas;

    const query = searchQuery.toLowerCase();
    return availableAreas.filter((area: any) =>
      area.name.toLowerCase().includes(query)
    );
  }, [availableAreas, searchQuery]);

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
            <LoadingSpinner size="md" />
          </div>
        ) : (
          <>
            {/* Smart filtering info alert */}
            {selectedPincodeIds.length > 0 && (
              <Alert className="mb-4 border-[#10B981] bg-green-50">
                <Info className="h-4 w-4 text-[#10B981]" />
                <AlertDescription className="text-sm text-[#1F2937]">
                  Showing only areas from selected pincodes ({selectedPincodeIds.length} pincode{selectedPincodeIds.length !== 1 ? 's' : ''})
                </AlertDescription>
              </Alert>
            )}

            {/* Search input */}
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search areas by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 border-gray-300 focus:border-[#10B981] focus:ring-[#10B981]"
                />
              </div>
            </div>

            {/* Areas list */}
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              {filteredAreas.length === 0 ? (
                <div className="text-sm text-gray-500 text-center py-4">
                  {searchQuery ? 'No areas match your search' : assignedPincodeIds.length === 0 ? 'Please assign pincodes first to see available areas' : 'No areas available for assigned pincodes'}
                </div>
              ) : (
                filteredAreas.map((area: any) => (
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

            {/* Save button */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <Button
                onClick={handleSave}
                disabled={saveAssignmentsMutation.isPending || filteredAreas.length === 0}
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

