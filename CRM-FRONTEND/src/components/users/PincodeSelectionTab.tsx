import React, { useState, useMemo } from 'react';
import { Search, CheckSquare, Square } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import type { PincodeWithCity } from '@/types/territoryAssignment';

interface PincodeSelectionTabProps {
  pincodes: PincodeWithCity[];
  selectedPincodeIds: Set<number>;
  onPincodeToggle: (pincodeId: number) => void;
  areaCountByPincode: Record<number, number>;
}

export const PincodeSelectionTab: React.FC<PincodeSelectionTabProps> = ({
  pincodes,
  selectedPincodeIds,
  onPincodeToggle,
  areaCountByPincode,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Filter pincodes by search term
  const filteredPincodes = useMemo(() => {
    if (!searchTerm.trim()) return pincodes;

    const search = searchTerm.toLowerCase();
    return pincodes.filter(
      (pincode) =>
        pincode.code.toLowerCase().includes(search) ||
        pincode.cityName.toLowerCase().includes(search) ||
        pincode.stateName.toLowerCase().includes(search)
    );
  }, [pincodes, searchTerm]);

  // Select all filtered pincodes
  const handleSelectAll = () => {
    filteredPincodes.forEach((pincode) => {
      const pincodeIdNum = typeof pincode.id === 'string' ? parseInt(pincode.id, 10) : pincode.id;
      if (!selectedPincodeIds.has(pincodeIdNum)) {
        onPincodeToggle(pincodeIdNum);
      }
    });
  };

  // Clear all selected pincodes
  const handleClearAll = () => {
    filteredPincodes.forEach((pincode) => {
      const pincodeIdNum = typeof pincode.id === 'string' ? parseInt(pincode.id, 10) : pincode.id;
      if (selectedPincodeIds.has(pincodeIdNum)) {
        onPincodeToggle(pincodeIdNum);
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Header with search and actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search by pincode, city, or state..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200">
            {selectedPincodeIds.size} selected
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSelectAll}
            disabled={filteredPincodes.length === 0}
          >
            <CheckSquare className="h-4 w-4 mr-2" />
            Select All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearAll}
            disabled={selectedPincodeIds.size === 0}
          >
            <Square className="h-4 w-4 mr-2" />
            Clear All
          </Button>
        </div>
      </div>

      {/* Pincode list - Scrollable, shows all pincodes */}
      <div className="border rounded-lg divide-y max-h-[500px] overflow-y-auto">
        {filteredPincodes.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {searchTerm ? 'No pincodes found matching your search' : 'No pincodes available'}
          </div>
        ) : (
          <>
            {filteredPincodes.map((pincode) => {
              // Convert pincode.id to number for comparison (API returns string IDs)
              const pincodeIdNum = typeof pincode.id === 'string' ? parseInt(pincode.id, 10) : pincode.id;
              const isSelected = selectedPincodeIds.has(pincodeIdNum);
              const areaCount = areaCountByPincode[pincodeIdNum] || 0;

              return (
                <div
                  key={pincode.id}
                  className={`flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer transition-colors ${
                    isSelected ? 'bg-emerald-50' : ''
                  }`}
                  onClick={() => onPincodeToggle(pincodeIdNum)}
                >
                  <Checkbox checked={isSelected} onCheckedChange={() => onPincodeToggle(pincodeIdNum)} />

                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{pincode.code}</span>
                      <span className="text-gray-500">-</span>
                      <span className="text-gray-700">{pincode.cityName}</span>
                      <span className="text-gray-400 text-sm">({pincode.stateName})</span>
                    </div>
                  </div>

                  {areaCount > 0 && (
                    <Badge variant="outline" className="text-xs">
                      {areaCount} {areaCount === 1 ? 'area' : 'areas'}
                    </Badge>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* Total count display */}
      {filteredPincodes.length > 0 && (
        <div className="text-sm text-gray-600 text-center">
          Showing {filteredPincodes.length} {filteredPincodes.length === 1 ? 'pincode' : 'pincodes'}
          {searchTerm && ' (filtered)'}
        </div>
      )}
    </div>
  );
};

