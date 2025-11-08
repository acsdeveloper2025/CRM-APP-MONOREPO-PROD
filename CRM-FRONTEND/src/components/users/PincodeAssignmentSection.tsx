import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapPin, Save, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { usersService } from '@/services/users';
import { locationsService } from '@/services/locations';
import { toast } from 'sonner';
import type { User } from '@/types/user';
import { LoadingSpinner } from '@/components/ui/loading';

interface PincodeAssignmentSectionProps {
  user: User;
  selectedPincodeIds: number[];
  onSelectedPincodesChange: (ids: number[]) => void;
}

// Custom hook for debounced value
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export function PincodeAssignmentSection({
  user,
  selectedPincodeIds,
  onSelectedPincodesChange
}: PincodeAssignmentSectionProps) {
  

  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300); // 300ms debounce
  const queryClient = useQueryClient();

  // Fetch all pincodes with aggressive caching for performance
  const { data: pincodesData, isLoading: pincodesLoading } = useQuery({
    queryKey: ['pincodes', 'all'],
    queryFn: () => locationsService.getPincodes({ limit: 1000 }),
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes (formerly cacheTime)
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnMount: false, // Don't refetch on component mount if data exists
  });

  // Fetch current user pincode assignments
  const { data: assignmentsData, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['user-pincode-assignments', user.id],
    queryFn: () => usersService.getUserPincodeAssignments(user.id),
  });

  // Update selected pincodes when assignments data loads
  useEffect(() => {
    if (assignmentsData?.data?.territoryAssignments) {
      const assignedPincodeIds = assignmentsData.data.territoryAssignments.map((assignment: any) => assignment.pincodeId);
      onSelectedPincodesChange(assignedPincodeIds);
    }
  }, [assignmentsData, onSelectedPincodesChange]);

  // Save assignments mutation
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

  // Apply search filter with debounced query for better performance
  const filteredPincodes = useMemo(() => {
    if (!debouncedSearchQuery.trim()) {return pincodes;}

    const query = debouncedSearchQuery.toLowerCase();
    return pincodes.filter((pincode: any) =>
      pincode.code?.toLowerCase().includes(query) ||
      pincode.cityName?.toLowerCase().includes(query) ||
      pincode.state?.toLowerCase().includes(query)
    );
  }, [pincodes, debouncedSearchQuery]);

  const handlePincodeToggle = useCallback((pincodeId: number, checked: boolean) => {
    if (checked) {
      onSelectedPincodesChange([...selectedPincodeIds, pincodeId]);
    } else {
      onSelectedPincodesChange(selectedPincodeIds.filter(id => id !== pincodeId));
    }
  }, [selectedPincodeIds, onSelectedPincodesChange]);

  const handleSaveAssignments = () => {
    saveAssignmentsMutation.mutate(selectedPincodeIds);
  };

  const isLoading = pincodesLoading || assignmentsLoading || saveAssignmentsMutation.isPending;

  // Only show for FIELD_AGENT users - check after all hooks
  if (user.role !== 'FIELD_AGENT') {
    return null;
  }

  return (
    <Card className="border-gray-200">
      <CardHeader className="bg-[#FAFAFA]">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-[#10B981]" />
          <CardTitle className="text-lg font-semibold text-[#1F2937]">Pincode Assignments</CardTitle>
        </div>
        <CardDescription className="text-sm text-gray-600">
          Select which pincodes this field agent can access
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner size="md" />
          </div>
        ) : (
          <>
            {/* Search input */}
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search by pincode, city, or state..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 border-gray-300 focus:border-[#10B981] focus:ring-[#10B981]"
                />
              </div>
            </div>

            {/* Pincodes list with optimized rendering */}
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              {filteredPincodes.length === 0 ? (
                <div className="text-sm text-gray-500 text-center py-4">
                  {searchQuery ? 'No pincodes match your search' : 'No pincodes available'}
                </div>
              ) : (
                filteredPincodes.map((pincode: any) => (
                  <div key={pincode.id} className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded">
                    <Checkbox
                      id={`pincode-${pincode.id}`}
                      checked={selectedPincodeIds.includes(parseInt(pincode.id))}
                      onCheckedChange={(checked) => handlePincodeToggle(parseInt(pincode.id), checked as boolean)}
                      className="border-gray-300"
                    />
                    <label
                      htmlFor={`pincode-${pincode.id}`}
                      className="text-sm font-medium text-[#1F2937] cursor-pointer flex-1"
                    >
                      {pincode.code} - {pincode.cityName}, {pincode.state}
                    </label>
                  </div>
                ))
              )}
            </div>

            {/* Save button */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <Button
                onClick={handleSaveAssignments}
                disabled={saveAssignmentsMutation.isPending}
                className="w-full bg-[#10B981] hover:bg-[#059669] text-white"
              >
                <Save className="h-4 w-4 mr-2" />
                {saveAssignmentsMutation.isPending ? 'Saving...' : 'Save Pincode Assignments'}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

