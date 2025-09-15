import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { MapPin, Loader2, Save, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { territoryAssignmentService } from '@/services/territoryAssignments';
import { usePincodes } from '@/hooks/useLocations';
import { useAreasByPincode } from '@/hooks/useAreas';
import type { User as UserType } from '@/types/user';

interface TerritoryAssignmentSectionProps {
  user: UserType;
}

interface AreaAssignment {
  pincodeId: number;
  areaIds: number[];
}

export function TerritoryAssignmentSectionEnhanced({ user }: TerritoryAssignmentSectionProps) {
  const [selectedPincodeIds, setSelectedPincodeIds] = useState<number[]>([]);
  const [selectedAreaAssignments, setSelectedAreaAssignments] = useState<AreaAssignment[]>([]);
  const [hasPincodeChanges, setHasPincodeChanges] = useState(false);
  const [hasAreaChanges, setHasAreaChanges] = useState(false);
  const queryClient = useQueryClient();

  // Fetch available pincodes
  const { data: pincodesData, isLoading: pincodesLoading } = usePincodes();

  // Fetch current territory assignments
  const { data: territoryData, isLoading: territoryLoading } = useQuery({
    queryKey: ['user-territory-assignments', user.id],
    queryFn: () => territoryAssignmentService.getFieldAgentTerritoryById(user.id),
    enabled: !!user.id,
  });

  // Save pincode assignments mutation
  const savePincodeAssignmentsMutation = useMutation({
    mutationFn: (pincodeIds: number[]) => territoryAssignmentService.assignPincodesToFieldAgent(user.id, { pincodeIds }),
    onSuccess: () => {
      toast.success('Pincode assignments updated successfully');
      setHasPincodeChanges(false);
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
      toast.error(error.response?.data?.message || 'Failed to update pincode assignments');
    },
  });

  // Save area assignments mutation
  const saveAreaAssignmentsMutation = useMutation({
    mutationFn: (assignments: AreaAssignment[]) => territoryAssignmentService.assignAreasToFieldAgent(user.id, { assignments }),
    onSuccess: () => {
      toast.success('Area assignments updated successfully');
      setHasAreaChanges(false);
      // Invalidate all queries related to this user
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
      toast.error(error.response?.data?.message || 'Failed to update area assignments');
    },
  });

  const currentAssignments = territoryData?.data?.pincodeAssignments || [];
  const currentAreaAssignments = territoryData?.data?.areaAssignments || [];
  const availablePincodes = pincodesData?.data || [];

  // Initialize selected pincodes from current assignments
  useEffect(() => {
    if (currentAssignments.length > 0) {
      const currentPincodeIds = currentAssignments.map(assignment => assignment.pincodeId);
      setSelectedPincodeIds(currentPincodeIds);
    }
  }, [currentAssignments]);

  // Initialize selected area assignments from current assignments
  useEffect(() => {
    if (currentAreaAssignments.length > 0) {
      // Group area assignments by pincode
      const groupedAssignments = currentAreaAssignments.reduce((acc, assignment) => {
        const existing = acc.find(item => item.pincodeId === assignment.pincodeId);
        if (existing) {
          existing.areaIds.push(assignment.areaId);
        } else {
          acc.push({
            pincodeId: assignment.pincodeId,
            areaIds: [assignment.areaId]
          });
        }
        return acc;
      }, [] as AreaAssignment[]);
      
      setSelectedAreaAssignments(groupedAssignments);
    }
  }, [currentAreaAssignments]);

  // Handle pincode selection
  const handlePincodeToggle = (pincodeId: number, checked: boolean) => {
    setSelectedPincodeIds(prev => {
      const newSelection = checked 
        ? [...prev, pincodeId]
        : prev.filter(id => id !== pincodeId);
      
      // Check if there are changes
      const currentIds = currentAssignments.map(assignment => assignment.pincodeId).sort();
      const newIds = newSelection.sort();
      setHasPincodeChanges(JSON.stringify(currentIds) !== JSON.stringify(newIds));
      
      // If pincode is deselected, remove its area assignments
      if (!checked) {
        setSelectedAreaAssignments(prev => prev.filter(assignment => assignment.pincodeId !== pincodeId));
        setHasAreaChanges(true);
      }
      
      return newSelection;
    });
  };

  // Handle area selection for a specific pincode
  const handleAreaToggle = (pincodeId: number, areaId: number, checked: boolean) => {
    setSelectedAreaAssignments(prev => {
      const existingAssignment = prev.find(assignment => assignment.pincodeId === pincodeId);
      
      let newAssignments;
      if (existingAssignment) {
        if (checked) {
          // Add area to existing assignment
          newAssignments = prev.map(assignment => 
            assignment.pincodeId === pincodeId
              ? { ...assignment, areaIds: [...assignment.areaIds, areaId] }
              : assignment
          );
        } else {
          // Remove area from existing assignment
          newAssignments = prev.map(assignment => 
            assignment.pincodeId === pincodeId
              ? { ...assignment, areaIds: assignment.areaIds.filter(id => id !== areaId) }
              : assignment
          ).filter(assignment => assignment.areaIds.length > 0); // Remove empty assignments
        }
      } else if (checked) {
        // Create new assignment
        newAssignments = [...prev, { pincodeId, areaIds: [areaId] }];
      } else {
        newAssignments = prev;
      }
      
      // Check if there are changes
      const currentGrouped = currentAreaAssignments.reduce((acc, assignment) => {
        const existing = acc.find(item => item.pincodeId === assignment.pincodeId);
        if (existing) {
          existing.areaIds.push(assignment.areaId);
        } else {
          acc.push({
            pincodeId: assignment.pincodeId,
            areaIds: [assignment.areaId]
          });
        }
        return acc;
      }, [] as AreaAssignment[]);
      
      setHasAreaChanges(JSON.stringify(currentGrouped.sort()) !== JSON.stringify(newAssignments.sort()));
      
      return newAssignments;
    });
  };

  // Handle save pincodes
  const handleSavePincodes = () => {
    savePincodeAssignmentsMutation.mutate(selectedPincodeIds);
  };

  // Handle save areas
  const handleSaveAreas = () => {
    saveAreaAssignmentsMutation.mutate(selectedAreaAssignments);
  };

  const isLoading = pincodesLoading || territoryLoading;
  const isSaving = savePincodeAssignmentsMutation.isPending || saveAreaAssignmentsMutation.isPending;

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
        <CardTitle className="flex items-center space-x-2">
          <MapPin className="h-5 w-5" />
          <span>Territory Assignments</span>
        </CardTitle>
        <CardDescription>
          Assign pincodes and areas to this field agent for case routing and territory management
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Assignments Summary */}
        {(currentAssignments.length > 0 || currentAreaAssignments.length > 0) && (
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Current Assignments</h4>
            <div className="space-y-2">
              {currentAssignments.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Pincodes ({currentAssignments.length})</p>
                  <div className="flex flex-wrap gap-1">
                    {currentAssignments.map((assignment) => (
                      <Badge key={assignment.pincodeId} variant="secondary" className="text-xs">
                        {assignment.pincodeCode} - {assignment.cityName}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {currentAreaAssignments.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Areas ({currentAreaAssignments.length})</p>
                  <div className="flex flex-wrap gap-1">
                    {currentAreaAssignments.map((assignment) => (
                      <Badge key={`${assignment.pincodeId}-${assignment.areaId}`} variant="outline" className="text-xs">
                        {assignment.areaName} ({assignment.pincodeCode})
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <Separator />
          </div>
        )}

        <Tabs defaultValue="pincodes" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pincodes" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Pincodes
            </TabsTrigger>
            <TabsTrigger value="areas" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Areas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pincodes" className="space-y-4">
            <PincodeAssignmentTab
              availablePincodes={availablePincodes}
              selectedPincodeIds={selectedPincodeIds}
              onPincodeToggle={handlePincodeToggle}
              hasChanges={hasPincodeChanges}
              onSave={handleSavePincodes}
              isSaving={isSaving}
            />
          </TabsContent>

          <TabsContent value="areas" className="space-y-4">
            <AreaAssignmentTab
              selectedPincodeIds={selectedPincodeIds}
              selectedAreaAssignments={selectedAreaAssignments}
              onAreaToggle={handleAreaToggle}
              hasChanges={hasAreaChanges}
              onSave={handleSaveAreas}
              isSaving={isSaving}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

// Pincode Assignment Tab Component
interface PincodeAssignmentTabProps {
  availablePincodes: any[];
  selectedPincodeIds: number[];
  onPincodeToggle: (pincodeId: number, checked: boolean) => void;
  hasChanges: boolean;
  onSave: () => void;
  isSaving: boolean;
}

function PincodeAssignmentTab({
  availablePincodes,
  selectedPincodeIds,
  onPincodeToggle,
  hasChanges,
  onSave,
  isSaving
}: PincodeAssignmentTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">Available Pincodes ({availablePincodes.length})</h4>
        {hasChanges && (
          <Button
            onClick={onSave}
            disabled={isSaving}
            size="sm"
            className="flex items-center gap-2"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Pincode Assignments
          </Button>
        )}
      </div>

      {availablePincodes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No pincodes available</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
          {availablePincodes.map((pincode) => (
            <div key={pincode.id} className="flex items-center space-x-3 p-3 border rounded-lg">
              <Checkbox
                id={`pincode-${pincode.id}`}
                checked={selectedPincodeIds.includes(pincode.id)}
                onCheckedChange={(checked) => onPincodeToggle(pincode.id, checked as boolean)}
              />
              <div className="flex-1 min-w-0">
                <label
                  htmlFor={`pincode-${pincode.id}`}
                  className="text-sm font-medium cursor-pointer block"
                >
                  {pincode.code}
                </label>
                <p className="text-xs text-muted-foreground truncate">
                  {pincode.cityName}, {pincode.state}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Area Assignment Tab Component
interface AreaAssignmentTabProps {
  selectedPincodeIds: number[];
  selectedAreaAssignments: AreaAssignment[];
  onAreaToggle: (pincodeId: number, areaId: number, checked: boolean) => void;
  hasChanges: boolean;
  onSave: () => void;
  isSaving: boolean;
}

function AreaAssignmentTab({
  selectedPincodeIds,
  selectedAreaAssignments,
  onAreaToggle,
  hasChanges,
  onSave,
  isSaving
}: AreaAssignmentTabProps) {
  if (selectedPincodeIds.length === 0) {
    return (
      <div className="text-center py-8">
        <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h4 className="font-medium mb-2">No Pincodes Selected</h4>
        <p className="text-sm text-muted-foreground">
          Please select pincodes first to assign areas within them.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">Areas in Selected Pincodes</h4>
        {hasChanges && (
          <Button
            onClick={onSave}
            disabled={isSaving}
            size="sm"
            className="flex items-center gap-2"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Area Assignments
          </Button>
        )}
      </div>

      <div className="space-y-6 max-h-96 overflow-y-auto">
        {selectedPincodeIds.map((pincodeId) => (
          <PincodeAreaSelector
            key={pincodeId}
            pincodeId={pincodeId}
            selectedAreaIds={selectedAreaAssignments.find(a => a.pincodeId === pincodeId)?.areaIds || []}
            onAreaToggle={(areaId, checked) => onAreaToggle(pincodeId, areaId, checked)}
          />
        ))}
      </div>
    </div>
  );
}

// Pincode Area Selector Component
interface PincodeAreaSelectorProps {
  pincodeId: number;
  selectedAreaIds: number[];
  onAreaToggle: (areaId: number, checked: boolean) => void;
}

function PincodeAreaSelector({ pincodeId, selectedAreaIds, onAreaToggle }: PincodeAreaSelectorProps) {
  const { data: areasData, isLoading: areasLoading } = useAreasByPincode(pincodeId);
  const areas = areasData?.data || [];

  if (areasLoading) {
    return (
      <div className="border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm text-muted-foreground">Loading areas for pincode {pincodeId}...</span>
        </div>
      </div>
    );
  }

  if (areas.length === 0) {
    return (
      <div className="border rounded-lg p-4">
        <h5 className="font-medium mb-2">Pincode {pincodeId}</h5>
        <p className="text-sm text-muted-foreground">No areas found for this pincode</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg p-4">
      <h5 className="font-medium mb-3">Pincode {pincodeId} ({areas.length} areas)</h5>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {areas.map((area) => (
          <div key={area.id} className="flex items-center space-x-2">
            <Checkbox
              id={`area-${pincodeId}-${area.id}`}
              checked={selectedAreaIds.includes(area.id)}
              onCheckedChange={(checked) => onAreaToggle(area.id, checked as boolean)}
            />
            <label
              htmlFor={`area-${pincodeId}-${area.id}`}
              className="text-sm cursor-pointer flex-1"
            >
              {area.name}
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}
