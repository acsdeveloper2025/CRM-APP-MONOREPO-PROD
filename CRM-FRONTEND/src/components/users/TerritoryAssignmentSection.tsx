import React, { useState, useMemo, useEffect } from 'react';
import { MapPin } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/components/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/components/tabs';
import { Atom } from 'react-loading-indicators';
import { usePincodes } from '@/hooks/useLocations';
import {
  useUserTerritoryAssignments,
  useAreasByPincodes,
  useBulkSaveTerritoryAssignments,
} from '@/hooks/useTerritoryAssignments';
import { PincodeSelectionTab } from './PincodeSelectionTab';
import { AreaSelectionTab } from './AreaSelectionTab';
import { AssignmentSummary } from './AssignmentSummary';
import type { User } from '@/types/user';
import type { PincodeWithCity, TerritoryAssignment } from '@/types/territoryAssignment';

interface TerritoryAssignmentSectionProps {
  user: User;
}

export const TerritoryAssignmentSection: React.FC<TerritoryAssignmentSectionProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'pincodes' | 'areas' | 'summary'>('pincodes');
  const [selectedPincodeIds, setSelectedPincodeIds] = useState<Set<number>>(new Set());
  const [selectedAreasByPincode, setSelectedAreasByPincode] = useState<Map<number, Set<number>>>(
    new Map()
  );

  // Fetch all pincodes (limit 10000 to ensure we get all/most for client-side search)
  const { data: pincodesData, isLoading: pincodesLoading } = usePincodes({ limit: 10000 });

  // Fetch user's existing territory assignments
  const { data: existingAssignments, isLoading: assignmentsLoading } =
    useUserTerritoryAssignments(user.id);

  // Fetch areas for selected pincodes
  const selectedPincodeIdsArray = Array.from(selectedPincodeIds);
  const { data: areasByPincode = {}, isLoading: areasLoading } =
    useAreasByPincodes(selectedPincodeIdsArray);

  // Bulk save mutation
  const saveMutation = useBulkSaveTerritoryAssignments(user.id);

  // Load existing assignments into state
  useEffect(() => {
    if (existingAssignments?.pincodeAssignments) {
      const pincodeIds = new Set<number>();
      const areasByPincode = new Map<number, Set<number>>();

      existingAssignments.pincodeAssignments.forEach((assignment) => {
        pincodeIds.add(assignment.pincodeId);

        const areaIds = new Set(assignment.areaAssignments.map((a) => a.areaId));
        areasByPincode.set(assignment.pincodeId, areaIds);
      });

      setSelectedPincodeIds(pincodeIds);
      setSelectedAreasByPincode(areasByPincode);
    }
  }, [existingAssignments]);

  // Handle pincode toggle
  const handlePincodeToggle = (pincodeId: number) => {
    setSelectedPincodeIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(pincodeId)) {
        newSet.delete(pincodeId);
        // Also remove all area selections for this pincode
        setSelectedAreasByPincode((prevAreas) => {
          const newMap = new Map(prevAreas);
          newMap.delete(pincodeId);
          return newMap;
        });
      } else {
        newSet.add(pincodeId);
      }
      return newSet;
    });
  };

  // Handle area toggle
  const handleAreaToggle = (pincodeId: number, areaId: number) => {
    setSelectedAreasByPincode((prev) => {
      const newMap = new Map(prev);
      const areaIds = newMap.get(pincodeId) || new Set();
      const newAreaIds = new Set(areaIds);

      if (newAreaIds.has(areaId)) {
        newAreaIds.delete(areaId);
      } else {
        newAreaIds.add(areaId);
      }

      newMap.set(pincodeId, newAreaIds);
      return newMap;
    });
  };

  // Generate assignments for save
  const generateAssignments = (): TerritoryAssignment[] => {
    return Array.from(selectedPincodeIds).map((pincodeId) => ({
      pincodeId,
      areaIds: Array.from(selectedAreasByPincode.get(pincodeId) || []),
    }));
  };

  // Handle save
  const handleSave = () => {
    const assignments = generateAssignments();
    saveMutation.mutate(assignments);
  };

  // Format all pincodes with city info
  const allPincodes = useMemo<PincodeWithCity[]>(() => {
    if (!pincodesData?.data) {
      return [];
    }

    return pincodesData.data.map((p): PincodeWithCity => ({
      id: typeof p.id === 'string' ? parseInt(p.id, 10) : p.id,
      code: p.code,
      cityId: typeof p.cityId === 'string' ? parseInt(p.cityId, 10) : p.cityId,
      cityName: p.cityName,
      stateId: p.city?.stateId || 0,
      stateName: p.state,
      countryId: p.city?.countryId || 0,
      countryName: p.country,
    }));
  }, [pincodesData]);

  // Get selected pincodes with city info
  const selectedPincodes = useMemo<PincodeWithCity[]>(() => {
    return allPincodes.filter((p) => selectedPincodeIds.has(p.id));
  }, [allPincodes, selectedPincodeIds]);



  // Calculate area count by pincode
  const areaCountByPincode = useMemo(() => {
    const counts: Record<number, number> = {};
    Object.entries(areasByPincode).forEach(([pincodeId, areas]) => {
      counts[Number(pincodeId)] = areas.length;
    });
    return counts;
  }, [areasByPincode]);

  if (pincodesLoading || assignmentsLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle {...{ className: "flex items-center gap-2" }}>
            <MapPin {...{ className: "h-5 w-5 text-emerald-600" }} />
            Territory Assignments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div {...{ className: "flex justify-center items-center py-12" }}>
            <Atom color="#10B981" size="medium" />
          </div>
        </CardContent>
      </Card>
    );
  }



  return (
    <Card>
      <CardHeader>
        <CardTitle {...{ className: "flex items-center gap-2" }}>
          <MapPin {...{ className: "h-5 w-5 text-emerald-600" }} />
          Territory Assignments
        </CardTitle>
        <CardDescription>
          Assign pincodes and areas to this field agent. They will only see cases and tasks for their
          assigned territories.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as 'pincodes' | 'areas' | 'summary')}
        >
          <TabsList {...{ className: "grid w-full grid-cols-3" }}>
            <TabsTrigger value="pincodes">Select Pincodes</TabsTrigger>
            <TabsTrigger value="areas" disabled={selectedPincodeIds.size === 0}>
              Select Areas
            </TabsTrigger>
            <TabsTrigger value="summary">Summary</TabsTrigger>
          </TabsList>

          <TabsContent value="pincodes" {...{ className: "mt-6" }}>
            <PincodeSelectionTab
              pincodes={allPincodes}
              selectedPincodeIds={selectedPincodeIds}
              onPincodeToggle={handlePincodeToggle}
              areaCountByPincode={areaCountByPincode}
            />
          </TabsContent>

          <TabsContent value="areas" {...{ className: "mt-6" }}>
            {areasLoading ? (
              <div {...{ className: "flex justify-center items-center py-12" }}>
                <Atom color="#10B981" size="medium" />
              </div>
            ) : (
              <AreaSelectionTab
                selectedPincodes={selectedPincodes}
                areasByPincode={areasByPincode}
                selectedAreasByPincode={selectedAreasByPincode}
                onAreaToggle={handleAreaToggle}
                onSave={handleSave}
                isSaving={saveMutation.isPending}
              />
            )}
          </TabsContent>

          <TabsContent value="summary" {...{ className: "mt-6" }}>
            <AssignmentSummary
              savedAssignments={existingAssignments?.pincodeAssignments || []}
              isLoading={assignmentsLoading}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

