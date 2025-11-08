import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, Loader2, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { territoryAssignmentService } from '@/services/territoryAssignments';
import { usePincodes } from '@/hooks/useLocations';
import { useAreasByPincode } from '@/hooks/useAreas';
import { MultiSelectDropdown, MultiSelectOption } from '@/components/ui/multi-select-dropdown';
import type { User as UserType } from '@/types/user';

interface TerritoryAssignmentDropdownProps {
  user: UserType;
}

// interface AreaAssignment {
//   pincodeId: number;
//   areaIds: number[];
// }

interface AreaAssignment {
  pincodeId: number;
  areaIds: number[];
}

export function TerritoryAssignmentDropdown({ user }: TerritoryAssignmentDropdownProps) {
  // Multi-select assignment state
  const [selectedPincodeIds, setSelectedPincodeIds] = useState<number[]>([]);
  const [selectedAreaAssignments, setSelectedAreaAssignments] = useState<AreaAssignment[]>([]);
  const [hasPincodeChanges, setHasPincodeChanges] = useState(false);
  const [hasAreaChanges, setHasAreaChanges] = useState(false);
  const [pincodeSearchQuery, setPincodeSearchQuery] = useState('');
  const [areaSearchQuery, setAreaSearchQuery] = useState('');
  const queryClient = useQueryClient();

  // Fetch available pincodes
  const { data: pincodesData, isLoading: pincodesLoading } = usePincodes();

  // Fetch current territory assignments
  const { data: territoryData, isLoading: territoryLoading } = useQuery({
    queryKey: ['user-territory-assignments', user.id],
    queryFn: () => territoryAssignmentService.getFieldAgentTerritoryById(user.id),
    enabled: !!user.id,
  });

  // Fetch areas for the selected pincodes (we'll fetch for the first selected pincode for now)
  const firstSelectedPincodeId = selectedPincodeIds.length > 0 ? selectedPincodeIds[0] : undefined;
  const { data: areasData, isLoading: areasLoading } = useAreasByPincode(firstSelectedPincodeId);

  // Save pincode assignments mutation
  const savePincodesMutation = useMutation({
    mutationFn: (pincodeIds: number[]) =>
      territoryAssignmentService.assignPincodesToFieldAgent(user.id, { pincodeIds }),
    onSuccess: () => {
      toast.success('Pincode assignments saved successfully');
      setHasPincodeChanges(false);
      setSelectedPincodeIds([]);
      // Invalidate queries to refresh data
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
      toast.error(error.response?.data?.message || 'Failed to save pincode assignments');
    },
  });

  // Save area assignments mutation
  const saveAreasMutation = useMutation({
    mutationFn: (assignments: AreaAssignment[]) =>
      territoryAssignmentService.assignAreasToFieldAgent(user.id, { assignments }),
    onSuccess: () => {
      toast.success('Area assignments saved successfully');
      setHasAreaChanges(false);
      setSelectedAreaAssignments([]);
      // Invalidate queries to refresh data
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
      toast.error(error.response?.data?.message || 'Failed to save area assignments');
    },
  });

  // Remove all assignments mutation
  const removeAllAssignmentsMutation = useMutation({
    mutationFn: () => territoryAssignmentService.removeAllTerritoryAssignments(user.id),
    onSuccess: (response) => {
      toast.success(`All territory assignments removed for ${response.data.userName}`);
      // Reset form state
      setSelectedPincodeIds([]);
      setSelectedAreaAssignments([]);
      setHasPincodeChanges(false);
      setHasAreaChanges(false);
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
      toast.error(error.response?.data?.message || 'Failed to remove all assignments');
    },
  });

  const currentAssignments = territoryData?.data?.territoryAssignments || [];
  const availablePincodes = pincodesData?.data || [];
  const availableAreas = areasData?.data || [];

  // Convert pincodes to multi-select dropdown options (exclude already assigned pincodes)
  const pincodeOptions: MultiSelectOption[] = useMemo(() => {
    if (!availablePincodes) {return [];}

    const assignedPincodeIds = new Set(currentAssignments.map(assignment => assignment.pincodeId));

    return availablePincodes
      .filter(pincode => {
        // Exclude already assigned pincodes
        if (assignedPincodeIds.has(pincode.id)) {return false;}

        if (!pincodeSearchQuery) {return true;}
        const query = pincodeSearchQuery.toLowerCase();
        return (
          pincode.code.toLowerCase().includes(query) ||
          pincode.cityName?.toLowerCase().includes(query) ||
          pincode.state?.toLowerCase().includes(query)
        );
      })
      .map(pincode => ({
        id: pincode.id,
        label: pincode.code,
        description: `${pincode.cityName}, ${pincode.state}`
      }));
  }, [availablePincodes, pincodeSearchQuery, currentAssignments]);

  // Convert areas to dropdown options for the selected pincode
  const areaOptions: MultiSelectOption[] = useMemo(() => {
    if (!availableAreas) {return [];}

    return availableAreas
      .filter(area => {
        if (!areaSearchQuery) {return true;}
        return area.name.toLowerCase().includes(areaSearchQuery.toLowerCase());
      })
      .map(area => ({
        id: area.id,
        label: area.name,
        description: area.description || ''
      }));
  }, [availableAreas, areaSearchQuery]);

  // Handle multi-pincode selection
  const handlePincodeSelectionChange = (values: (string | number)[]) => {
    const newPincodeIds = values.map(id => Number(id));
    setSelectedPincodeIds(newPincodeIds);
    setHasPincodeChanges(true);
  };

  // Handle area selection changes for a specific pincode
  const handleAreaSelectionChange = (pincodeId: number, areaIds: number[]) => {
    setSelectedAreaAssignments(prev => {
      const filtered = prev.filter(a => a.pincodeId !== pincodeId);
      if (areaIds.length > 0) {
        return [...filtered, { pincodeId, areaIds }];
      }
      return filtered;
    });
    setHasAreaChanges(true);
  };

  // Save pincode assignments
  const handleSavePincodes = () => {
    if (selectedPincodeIds.length === 0) {
      toast.error('Please select at least one pincode');
      return;
    }
    savePincodesMutation.mutate(selectedPincodeIds);
  };

  // Save area assignments
  const handleSaveAreas = () => {
    if (selectedAreaAssignments.length === 0) {
      toast.error('Please select areas for at least one pincode');
      return;
    }
    saveAreasMutation.mutate(selectedAreaAssignments);
  };

  // Handle remove all assignments
  const handleRemoveAllAssignments = () => {
    if (window.confirm(`Are you sure you want to remove ALL territory assignments for ${user.name}? This action cannot be undone.`)) {
      removeAllAssignmentsMutation.mutate();
    }
  };

  const isLoading = pincodesLoading || territoryLoading;
  const isSaving = savePincodesMutation.isPending || saveAreasMutation.isPending || removeAllAssignmentsMutation.isPending;

  if (isLoading) {
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
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <MapPin className="h-5 w-5" />
              <span>Territory Assignments</span>
            </CardTitle>
            <CardDescription>
              Multi-select pincode and area assignment: Select multiple pincodes, save them, then optionally assign specific areas
            </CardDescription>
          </div>
          {currentAssignments.length > 0 && (
            <Button
              onClick={handleRemoveAllAssignments}
              disabled={isSaving}
              variant="destructive"
              size="sm"
              className="flex items-center gap-2"
            >
              {removeAllAssignmentsMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <span>🗑️</span>
              )}
              Remove All
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">

        {/* Multi-Select Assignment Interface */}
        <div className="space-y-6">
          {/* Step 1: Pincode Selection */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-green-100 text-green-600 text-sm font-medium flex items-center justify-center">1</div>
                <h4 className="font-medium">Select Pincodes</h4>
              </div>
              {hasPincodeChanges && (
                <Button
                  onClick={handleSavePincodes}
                  disabled={isSaving || selectedPincodeIds.length === 0}
                  size="sm"
                  className="flex items-center gap-2"
                >
                  {savePincodesMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save Pincodes
                </Button>
              )}
            </div>

            <MultiSelectDropdown
              options={pincodeOptions}
              selectedValues={selectedPincodeIds}
              onSelectionChange={handlePincodeSelectionChange}
              placeholder="Select pincodes..."
              searchPlaceholder="Search by pincode or city..."
              onSearch={setPincodeSearchQuery}
              searchQuery={pincodeSearchQuery}
              isLoading={pincodesLoading}
              maxDisplayItems={50}
              emptyMessage={pincodeOptions.length === 0 ? "All available pincodes are already assigned" : "No pincodes found"}
              autoClose={true}
            />

            {pincodeOptions.length === 0 && (
              <div className="text-sm text-gray-600 bg-muted/50 p-3 rounded">
                💡 All available pincodes have been assigned. Use "Remove All" to clear assignments if needed.
              </div>
            )}
          </div>

          {/* Step 2: Area Selection (for first selected pincode) */}
          {firstSelectedPincodeId && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-green-100 text-green-600 text-sm font-medium flex items-center justify-center">2</div>
                  <h4 className="font-medium">Select Areas for Pincode {pincodeOptions.find(p => p.id === firstSelectedPincodeId)?.label}</h4>
                </div>
                {hasAreaChanges && (
                  <Button
                    onClick={handleSaveAreas}
                    disabled={isSaving || selectedAreaAssignments.length === 0}
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    {saveAreasMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Save Areas
                  </Button>
                )}
              </div>

              {areasLoading ? (
                <div className="flex items-center gap-2 py-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-gray-600">Loading areas...</span>
                </div>
              ) : areaOptions.length === 0 ? (
                <div className="text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/30 p-3 rounded">
                  ⚠️ No areas configured for this pincode. Configure areas in Location Management first.
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-xs text-gray-600 bg-muted/50 p-2 rounded">
                    <span className="font-medium">Available areas:</span> {areaOptions.length} areas for this pincode
                  </div>

                  <MultiSelectDropdown
                    options={areaOptions}
                    selectedValues={selectedAreaAssignments.find(a => a.pincodeId === firstSelectedPincodeId)?.areaIds || []}
                    onSelectionChange={(values) => handleAreaSelectionChange(firstSelectedPincodeId, values.map(v => Number(v)))}
                    placeholder="Select areas (optional)..."
                    searchPlaceholder="Search areas..."
                    onSearch={setAreaSearchQuery}
                    searchQuery={areaSearchQuery}
                    isLoading={areasLoading}
                    maxDisplayItems={100}
                    emptyMessage="No areas found"
                  />
                </div>
              )}
            </div>
          )}

          {/* Instructions */}
          {selectedPincodeIds.length === 0 && pincodeOptions.length > 0 && (
            <div className="text-sm text-gray-600 bg-green-50 dark:bg-blue-950/30 p-4 rounded-lg">
              <h5 className="font-medium mb-2">How to assign territories:</h5>
              <ol className="list-decimal list-inside space-y-1">
                <li>Select one or more pincodes from the dropdown above</li>
                <li>Click "Save Pincodes" to assign them</li>
                <li>Optionally, select specific areas within a pincode</li>
                <li>Click "Save Areas" to assign specific areas</li>
              </ol>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
