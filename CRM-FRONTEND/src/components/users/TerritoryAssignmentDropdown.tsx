import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { MapPin, Building2, Loader2, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { territoryAssignmentService } from '@/services/territoryAssignments';
import { usePincodes } from '@/hooks/useLocations';
import { useAreasByPincode } from '@/hooks/useAreas';
import { MultiSelectDropdown, MultiSelectOption } from '@/components/ui/multi-select-dropdown';
import type { User as UserType } from '@/types/user';

interface TerritoryAssignmentDropdownProps {
  user: UserType;
}

interface AreaAssignment {
  pincodeId: number;
  areaIds: number[];
}

export function TerritoryAssignmentDropdown({ user }: TerritoryAssignmentDropdownProps) {
  // Sequential assignment state
  const [selectedPincodeId, setSelectedPincodeId] = useState<number | null>(null);
  const [selectedAreaIds, setSelectedAreaIds] = useState<number[]>([]);
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

  // Fetch areas for the selected pincode
  const { data: areasData, isLoading: areasLoading } = useAreasByPincode(selectedPincodeId || undefined);

  // Save individual pincode-area assignment mutation
  const saveAssignmentMutation = useMutation({
    mutationFn: (data: { pincodeId: number; areaIds: number[] }) =>
      territoryAssignmentService.assignSinglePincodeWithAreas(user.id, data),
    onSuccess: (response) => {
      toast.success(`Pincode ${response.data.pincodeCode} assigned with ${response.data.assignedAreas} areas`);
      // Reset form
      setSelectedPincodeId(null);
      setSelectedAreaIds([]);
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
      toast.error(error.response?.data?.message || 'Failed to save assignment');
    },
  });

  // Remove all assignments mutation
  const removeAllAssignmentsMutation = useMutation({
    mutationFn: () => territoryAssignmentService.removeAllTerritoryAssignments(user.id),
    onSuccess: (response) => {
      toast.success(`All territory assignments removed for ${response.data.userName}`);
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

  // Convert pincodes to single-select dropdown options (exclude already assigned pincodes)
  const pincodeOptions: MultiSelectOption[] = useMemo(() => {
    if (!availablePincodes) return [];

    const assignedPincodeIds = new Set(currentAssignments.map(assignment => assignment.pincodeId));

    return availablePincodes
      .filter(pincode => {
        // Exclude already assigned pincodes
        if (assignedPincodeIds.has(pincode.id)) return false;

        if (!pincodeSearchQuery) return true;
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
    if (!availableAreas) return [];

    return availableAreas
      .filter(area => {
        if (!areaSearchQuery) return true;
        return area.name.toLowerCase().includes(areaSearchQuery.toLowerCase());
      })
      .map(area => ({
        id: area.id,
        label: area.name,
        description: area.description || ''
      }));
  }, [availableAreas, areaSearchQuery]);

  // Handle single pincode selection
  const handlePincodeSelectionChange = (values: (string | number)[]) => {
    const pincodeId = values.length > 0 ? Number(values[0]) : null;
    setSelectedPincodeId(pincodeId);
    // Reset area selection when pincode changes
    setSelectedAreaIds([]);
  };

  // Handle area selection changes
  const handleAreaSelectionChange = (values: (string | number)[]) => {
    const newAreaIds = values.map(id => Number(id));
    setSelectedAreaIds(newAreaIds);
  };

  // Handle save assignment
  const handleSaveAssignment = () => {
    if (!selectedPincodeId) {
      toast.error('Please select a pincode first');
      return;
    }

    saveAssignmentMutation.mutate({
      pincodeId: selectedPincodeId,
      areaIds: selectedAreaIds
    });
  };

  // Handle remove all assignments
  const handleRemoveAllAssignments = () => {
    if (window.confirm(`Are you sure you want to remove ALL territory assignments for ${user.name}? This action cannot be undone.`)) {
      removeAllAssignmentsMutation.mutate();
    }
  };

  const isLoading = pincodesLoading || territoryLoading;
  const isSaving = saveAssignmentMutation.isPending || removeAllAssignmentsMutation.isPending;
  const canSave = selectedPincodeId !== null;

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
              Sequential pincode-area assignment: Select one pincode, choose areas, then save
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

        {/* Sequential Assignment Interface */}
        <div className="space-y-6">
          {/* Step 1: Pincode Selection */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-sm font-medium flex items-center justify-center">1</div>
              <h4 className="font-medium">Select Pincode</h4>
            </div>

            <MultiSelectDropdown
              options={pincodeOptions}
              selectedValues={selectedPincodeId ? [selectedPincodeId] : []}
              onSelectionChange={handlePincodeSelectionChange}
              placeholder="Select one pincode..."
              searchPlaceholder="Search by pincode or city..."
              onSearch={setPincodeSearchQuery}
              searchQuery={pincodeSearchQuery}
              isLoading={pincodesLoading}
              maxDisplayItems={50}
              emptyMessage={pincodeOptions.length === 0 ? "All available pincodes are already assigned" : "No pincodes found"}
            />

            {pincodeOptions.length === 0 && (
              <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded">
                💡 All available pincodes have been assigned. Use "Remove All" to clear assignments if needed.
              </div>
            )}
          </div>

          {/* Step 2: Area Selection */}
          {selectedPincodeId && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-sm font-medium flex items-center justify-center">2</div>
                <h4 className="font-medium">Select Areas for Pincode {pincodeOptions.find(p => p.id === selectedPincodeId)?.label}</h4>
              </div>

              {areasLoading ? (
                <div className="flex items-center gap-2 py-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Loading areas...</span>
                </div>
              ) : areaOptions.length === 0 ? (
                <div className="text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/30 p-3 rounded">
                  ⚠️ No areas configured for this pincode. Configure areas in Location Management first.
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                    <span className="font-medium">Available areas:</span> {areaOptions.length} areas for this pincode
                  </div>

                  <MultiSelectDropdown
                    options={areaOptions}
                    selectedValues={selectedAreaIds}
                    onSelectionChange={handleAreaSelectionChange}
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

          {/* Step 3: Save Assignment */}
          {selectedPincodeId && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-sm font-medium flex items-center justify-center">3</div>
                <h4 className="font-medium">Save Assignment</h4>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
                <div>
                  <div className="font-medium">
                    Pincode: {pincodeOptions.find(p => p.id === selectedPincodeId)?.label}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Areas: {selectedAreaIds.length === 0 ? 'None selected (entire pincode)' : `${selectedAreaIds.length} selected`}
                  </div>
                </div>
                <Button
                  onClick={handleSaveAssignment}
                  disabled={isSaving}
                  className="flex items-center gap-2"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save Assignment
                </Button>
              </div>
            </div>
          )}

          {/* Instructions */}
          {!selectedPincodeId && pincodeOptions.length > 0 && (
            <div className="text-sm text-muted-foreground bg-blue-50 dark:bg-blue-950/30 p-4 rounded-lg">
              <h5 className="font-medium mb-2">How to assign territories:</h5>
              <ol className="list-decimal list-inside space-y-1">
                <li>Select one pincode from the dropdown above</li>
                <li>Choose areas within that pincode (optional)</li>
                <li>Save the assignment</li>
                <li>Repeat for additional pincodes</li>
              </ol>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
