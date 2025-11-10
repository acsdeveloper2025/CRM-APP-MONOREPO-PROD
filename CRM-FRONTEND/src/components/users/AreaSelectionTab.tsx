import React, { useState, useMemo } from 'react';
import { Search, CheckSquare, Square, AlertCircle, Save } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import type { PincodeWithCity, Area } from '@/types/territoryAssignment';

interface AreaSelectionTabProps {
  selectedPincodes: PincodeWithCity[];
  areasByPincode: Record<number, Area[]>;
  selectedAreasByPincode: Map<number, Set<number>>;
  onAreaToggle: (pincodeId: number, areaId: number) => void;
  onSave: () => void;
  isSaving: boolean;
}

export const AreaSelectionTab: React.FC<AreaSelectionTabProps> = ({
  selectedPincodes,
  areasByPincode,
  selectedAreasByPincode,
  onAreaToggle,
  onSave,
  isSaving,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Filter areas by search term
  const filteredPincodes = useMemo(() => {
    if (!searchTerm.trim()) return selectedPincodes;

    const search = searchTerm.toLowerCase();
    return selectedPincodes
      .map((pincode) => {
        const areas = areasByPincode[pincode.id] || [];
        const filteredAreas = areas.filter((area) => area.name.toLowerCase().includes(search));

        return filteredAreas.length > 0 ? { ...pincode, filteredAreas } : null;
      })
      .filter((p) => p !== null) as (PincodeWithCity & { filteredAreas: Area[] })[];
  }, [selectedPincodes, areasByPincode, searchTerm]);

  // Select all areas for a specific pincode
  const handleSelectAllForPincode = (pincodeId: number) => {
    const areas = areasByPincode[pincodeId] || [];
    const selectedAreas = selectedAreasByPincode.get(pincodeId) || new Set();

    areas.forEach((area) => {
      if (!selectedAreas.has(area.id)) {
        onAreaToggle(pincodeId, area.id);
      }
    });
  };

  // Clear all areas for a specific pincode
  const handleClearAllForPincode = (pincodeId: number) => {
    const selectedAreas = selectedAreasByPincode.get(pincodeId) || new Set();

    Array.from(selectedAreas).forEach((areaId) => {
      onAreaToggle(pincodeId, areaId);
    });
  };

  // Calculate total selected areas
  const totalSelectedAreas = useMemo(() => {
    let count = 0;
    selectedAreasByPincode.forEach((areaIds) => {
      count += areaIds.size;
    });
    return count;
  }, [selectedAreasByPincode]);

  if (selectedPincodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <AlertCircle className="h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Pincodes Selected</h3>
        <p className="text-gray-600 max-w-md">
          Please select pincodes from the "Select Pincodes" tab first. Then you can select areas for
          each pincode here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with search */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search areas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200">
          {totalSelectedAreas} {totalSelectedAreas === 1 ? 'area' : 'areas'} selected
        </Badge>
      </div>

      {/* Areas grouped by pincode */}
      <div className="space-y-4 max-h-[500px] overflow-y-auto">
        {filteredPincodes.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No areas found matching your search</div>
        ) : (
          filteredPincodes.map((pincode) => {
            const areas = searchTerm
              ? (pincode as any).filteredAreas
              : areasByPincode[pincode.id] || [];
            const selectedAreas = selectedAreasByPincode.get(pincode.id) || new Set();
            const allSelected = areas.length > 0 && areas.every((area: Area) => selectedAreas.has(area.id));

            return (
              <div key={pincode.id} className="border rounded-lg overflow-hidden">
                {/* Pincode header */}
                <div className="bg-gray-50 px-4 py-3 border-b flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{pincode.code}</span>
                    <span className="text-gray-500">-</span>
                    <span className="text-gray-700">{pincode.cityName}</span>
                    <span className="text-gray-400 text-sm">({pincode.stateName})</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {selectedAreas.size} / {areas.length} selected
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSelectAllForPincode(pincode.id)}
                      disabled={allSelected}
                    >
                      <CheckSquare className="h-4 w-4 mr-1" />
                      Select All
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleClearAllForPincode(pincode.id)}
                      disabled={selectedAreas.size === 0}
                    >
                      <Square className="h-4 w-4 mr-1" />
                      Clear
                    </Button>
                  </div>
                </div>

                {/* Area list */}
                <div className="divide-y">
                  {areas.length === 0 ? (
                    <div className="p-4 text-center text-gray-500 text-sm">
                      No areas available for this pincode
                    </div>
                  ) : (
                    areas.map((area: Area) => {
                      const isSelected = selectedAreas.has(area.id);

                      return (
                        <div
                          key={area.id}
                          className={`flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer transition-colors ${
                            isSelected ? 'bg-emerald-50' : ''
                          }`}
                          onClick={() => onAreaToggle(pincode.id, area.id)}
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => onAreaToggle(pincode.id, area.id)}
                          />
                          <span className="text-gray-900">{area.name}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Save button */}
      {selectedPincodes.length > 0 && (
        <div className="flex justify-end pt-4 border-t">
          <Button
            onClick={onSave}
            disabled={isSaving || selectedPincodes.length === 0}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save All Assignments'}
          </Button>
        </div>
      )}
    </div>
  );
};

