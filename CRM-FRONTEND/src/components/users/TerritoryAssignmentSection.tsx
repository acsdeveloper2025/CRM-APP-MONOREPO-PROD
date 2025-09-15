import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2, Plus, MapPin, Building2, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTerritoryAssignments } from '@/hooks/useTerritoryAssignments';
import { usePincodes } from '@/hooks/useLocations';
import { useAreasByPincode } from '@/hooks/useAreas';
import type { TerritorySelection, FieldAgentTerritoryDetail } from '@/types/territoryAssignment';

// Area Selector Component
interface AreaSelectorProps {
  pincodeId: number;
  selectedAreaIds: number[];
  onAreaToggle: (areaId: number, checked: boolean) => void;
  disabled?: boolean;
}

const AreaSelector: React.FC<AreaSelectorProps> = React.memo(({
  pincodeId,
  selectedAreaIds,
  onAreaToggle,
  disabled = false
}) => {
  const { data: areasData, isLoading: areasLoading } = useAreasByPincode(pincodeId);
  const areas = areasData?.data || [];

  if (areasLoading) {
    return (
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm text-muted-foreground">Loading areas...</span>
      </div>
    );
  }

  if (areas.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No areas found for this pincode</p>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
      {areas.map((area) => (
        <div key={area.id} className="flex items-center space-x-2">
          <Checkbox
            id={`area-${pincodeId}-${area.id}`}
            checked={selectedAreaIds.includes(area.id)}
            onCheckedChange={(checked) => onAreaToggle(area.id, checked as boolean)}
            disabled={disabled}
          />
          <label
            htmlFor={`area-${pincodeId}-${area.id}`}
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
          >
            {area.name}
          </label>
        </div>
      ))}
    </div>
  );
});

interface TerritoryAssignmentSectionProps {
  userId: string;
  userRole?: string;
  onAssignmentsChange?: (assignments: TerritorySelection[]) => void;
  disabled?: boolean;
}

export const TerritoryAssignmentSection: React.FC<TerritoryAssignmentSectionProps> = ({
  userId,
  userRole,
  onAssignmentsChange,
  disabled = false
}) => {
  const [territorySelections, setTerritorySelections] = useState<TerritorySelection[]>([]);
  const [selectedPincodeId, setSelectedPincodeId] = useState<string>('');
  const [userTerritoryData, setUserTerritoryData] = useState<FieldAgentTerritoryDetail | null>(null);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  // Real API hooks
  const {
    assignPincodes,
    assignAreas,
    removePincodeAssignment,
    removeAreaAssignment,
    loading: territoryLoading
  } = useTerritoryAssignments();

  const { data: pincodesData, isLoading: pincodesLoading } = usePincodes({ limit: 100 });

  // Extract real data from API responses
  const pincodes = pincodesData?.data || [];

  // Memoize the load function to prevent unnecessary re-renders
  const loadUserTerritoryData = useCallback(async () => {
    if (!userId || userRole !== 'FIELD_AGENT') return;

    try {
      // Fetch user's current territory assignments
      const response = await fetch(`/api/territory-assignments/field-agents/${userId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUserTerritoryData(data.data);

        // Convert to TerritorySelection format for the UI
        const selections: TerritorySelection[] = data.data.territoryAssignments.map((assignment: any) => ({
          pincodeId: assignment.pincodeId,
          selectedAreaIds: assignment.assignedAreas.map((area: any) => area.areaId)
        }));

        setTerritorySelections(selections);
        onAssignmentsChange?.(selections);
      }
    } catch (error) {
      console.error('Failed to load territory assignments:', error);
      toast.error('Failed to load territory assignments');
    }
  }, [userId, userRole, onAssignmentsChange]);

  // Load existing territory assignments for the user
  useEffect(() => {
    loadUserTerritoryData();
  }, [loadUserTerritoryData]);

  // Don't show territory assignment for non-field users
  if (userRole !== 'FIELD_AGENT') {
    return null;
  }

  const handleAddPincode = useCallback(async () => {
    if (!selectedPincodeId || isUpdating) {
      if (!selectedPincodeId) toast.error("Please select a pincode to add");
      return;
    }

    const pincodeId = parseInt(selectedPincodeId);
    const existingSelection = territorySelections.find(sel => sel.pincodeId === pincodeId);

    if (existingSelection) {
      toast.error("This pincode is already in the territory assignments");
      return;
    }

    try {
      setIsUpdating(true);
      // Call real API to assign pincode
      await assignPincodes(userId, {
        pincodeIds: [pincodeId]
      });

      const newSelection: TerritorySelection = {
        pincodeId,
        selectedAreaIds: []
      };

      const updatedSelections = [...territorySelections, newSelection];
      setTerritorySelections(updatedSelections);
      onAssignmentsChange?.(updatedSelections);
      setSelectedPincodeId('');
      toast.success("Pincode assigned successfully");
    } catch (error) {
      console.error('Failed to assign pincode:', error);
      toast.error("Failed to assign pincode");
    } finally {
      setIsUpdating(false);
    }
  }, [selectedPincodeId, territorySelections, assignPincodes, userId, onAssignmentsChange, isUpdating]);

  const handleRemovePincode = useCallback(async (pincodeId: number) => {
    if (isUpdating) return;

    try {
      setIsUpdating(true);
      // Call real API to remove pincode assignment
      await removePincodeAssignment(userId, pincodeId);

      const updatedSelections = territorySelections.filter(sel => sel.pincodeId !== pincodeId);
      setTerritorySelections(updatedSelections);
      onAssignmentsChange?.(updatedSelections);

      toast.success("Pincode assignment removed successfully");
    } catch (error) {
      toast.error("Failed to remove pincode assignment");
    } finally {
      setIsUpdating(false);
    }
  }, [removePincodeAssignment, userId, territorySelections, onAssignmentsChange, isUpdating]);

  const handleAreaToggle = useCallback(async (pincodeId: number, areaId: number, checked: boolean) => {
    if (isUpdating) return;

    try {
      setIsUpdating(true);
      if (checked) {
        // Assign area
        await assignAreas(userId, {
          assignments: [{
            pincodeId,
            areaIds: [areaId]
          }]
        });
      } else {
        // Remove area assignment
        await removeAreaAssignment(userId, areaId, pincodeId);
      }

      const updatedSelections = territorySelections.map(selection => {
        if (selection.pincodeId === pincodeId) {
          const updatedAreaIds = checked
            ? [...selection.selectedAreaIds, areaId]
            : selection.selectedAreaIds.filter(id => id !== areaId);

          return {
            ...selection,
            selectedAreaIds: updatedAreaIds
          };
        }
        return selection;
      });

      setTerritorySelections(updatedSelections);
      onAssignmentsChange?.(updatedSelections);
      toast.success(checked ? "Area assigned successfully" : "Area assignment removed successfully");
    } catch (error) {
      console.error('Failed to update area assignment:', error);
      toast.error("Failed to update area assignment");
    } finally {
      setIsUpdating(false);
    }
  }, [assignAreas, removeAreaAssignment, userId, territorySelections, onAssignmentsChange, isUpdating]);



  // Memoize pincode lookup for performance
  const getPincodeInfo = useCallback((pincodeId: number) => {
    return pincodes.find(p => parseInt(p.id) === pincodeId);
  }, [pincodes]);

  // Memoize filtered pincodes to prevent unnecessary re-renders
  const availablePincodes = useMemo(() => {
    const assignedPincodeIds = territorySelections.map(sel => sel.pincodeId);
    return pincodes.filter(pincode => !assignedPincodeIds.includes(parseInt(pincode.id)));
  }, [pincodes, territorySelections]);

  // Show loading state
  if (pincodesLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Territory Assignments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading territory data...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Territory Assignments
        </CardTitle>
        <CardDescription>
          Assign pincodes and areas to this field agent for case routing and territory management
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add New Pincode */}
        <div className="flex gap-2">
          <Select
            value={selectedPincodeId}
            onValueChange={setSelectedPincodeId}
            disabled={disabled || pincodesLoading || territoryLoading || isUpdating}
          >
            <SelectTrigger className="flex-1">
              <SelectValue placeholder={pincodesLoading ? "Loading pincodes..." : "Select a pincode to add"} />
            </SelectTrigger>
            <SelectContent>
              {availablePincodes.map((pincode) => (
                <SelectItem key={pincode.id} value={pincode.id.toString()}>
                  {pincode.code} - {pincode.cityName}, {pincode.state}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={handleAddPincode}
            disabled={disabled || !selectedPincodeId || territoryLoading || isUpdating}
            size="sm"
          >
            {territoryLoading || isUpdating ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-1" />
            )}
            Add Pincode
          </Button>
        </div>

        {/* Current Territory Assignments */}
        <div className="space-y-4">
          {territorySelections.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No territory assignments yet</p>
              <p className="text-sm">Add pincodes to assign territories to this field agent</p>
            </div>
          ) : (
            territorySelections.map((selection) => {
              const pincodeInfo = getPincodeInfo(selection.pincodeId);
              return (
                <Card key={selection.pincodeId} className="border-l-4 border-l-blue-500">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">
                          {pincodeInfo?.code || `Pincode ${selection.pincodeId}`}
                        </CardTitle>
                        <CardDescription>
                          {pincodeInfo?.cityName}, {pincodeInfo?.state}
                        </CardDescription>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemovePincode(selection.pincodeId)}
                        disabled={disabled || territoryLoading || isUpdating}
                        className="text-destructive hover:text-destructive"
                      >
                        {territoryLoading || isUpdating ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">Areas in this Pincode</h4>
                        <Badge variant="secondary">
                          {selection.selectedAreaIds.length} selected
                        </Badge>
                      </div>
                      
                      <AreaSelector
                        pincodeId={selection.pincodeId}
                        selectedAreaIds={selection.selectedAreaIds}
                        onAreaToggle={(areaId, checked) =>
                          handleAreaToggle(selection.pincodeId, areaId, checked)
                        }
                        disabled={disabled || territoryLoading || isUpdating}
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Info about real-time saves */}
        {territorySelections.length > 0 && (
          <div className="text-sm text-muted-foreground text-center pt-4 border-t">
            <p>✓ Territory assignments are saved automatically</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
