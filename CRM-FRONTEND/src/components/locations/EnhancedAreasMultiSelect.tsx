import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { locationsService } from '@/services/locations';
import { MultiSelectDropdown, MultiSelectOption } from '@/components/ui/multi-select-dropdown';
import { logger } from '@/utils/logger';

// interface Area {
//   id: string;
//   name: string;
// }

interface EnhancedAreasMultiSelectProps {
  selectedAreaIds: string[];
  onAreasChange: (areaIds: string[]) => void;
  disabled?: boolean;
  error?: string;
  placeholder?: string;
  maxAreas?: number;
}

export function EnhancedAreasMultiSelect({
  selectedAreaIds,
  onAreasChange,
  disabled = false,
  error,
  placeholder = "Select areas...",
  maxAreas = 15,
}: EnhancedAreasMultiSelectProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch all available areas
  const { data: areasData, isLoading, error: queryError } = useQuery({
    queryKey: ['standalone-areas'],
    queryFn: () => locationsService.getStandaloneAreas(),
  });

  const allAreas = useMemo(() => areasData?.data || [], [areasData?.data]);

  // Convert areas to dropdown options with search filtering
  const areaOptions: MultiSelectOption[] = useMemo(() => {
    if (!allAreas) {return [];}
    
    return allAreas
      .filter(area => {
        // Apply search filter
        if (!searchQuery) {return true;}
        const query = searchQuery.toLowerCase();
        return area.name.toLowerCase().includes(query);
      })
      .map(area => ({
        id: area.id,
        label: area.name,
        className: "text-gray-900" // Ensure text is visible
      }));
  }, [allAreas, searchQuery]);

  // Handle selection changes with max limit validation
  const handleSelectionChange = (values: (string | number)[]) => {
    const stringValues = values.map(id => String(id));
    
    // Enforce max areas limit
    if (stringValues.length > maxAreas) {
      return; // Don't allow more than max areas
    }
    
    onAreasChange(stringValues);
  };

  // Debug logging for development
  React.useEffect(() => {
    if (queryError) {
      logger.error('EnhancedAreasMultiSelect Error:', queryError);
    }
    if (allAreas.length > 0) {
      logger.warn('🔍 Areas data:', allAreas);
      logger.warn('🔍 Processed options:', areaOptions);
    }
  }, [queryError, allAreas, areaOptions]);

  return (
    <div className="space-y-2">
      <MultiSelectDropdown
        options={areaOptions}
        selectedValues={selectedAreaIds}
        onSelectionChange={handleSelectionChange}
        placeholder={placeholder}
        searchPlaceholder="Search areas..."
        onSearch={setSearchQuery}
        searchQuery={searchQuery}
        isLoading={isLoading}
        disabled={disabled}
        maxDisplayItems={50}
        emptyMessage="No areas found matching your search"
        className={error ? "border-red-500" : ""}
      />
      
      {/* Error message */}
      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
      
      {/* Selection info */}
      {selectedAreaIds.length > 0 && (
        <p className="text-xs text-gray-600">
          {selectedAreaIds.length} of {maxAreas} areas selected
          {selectedAreaIds.length >= maxAreas && " (maximum reached)"}
        </p>
      )}
      
      {/* Query error display */}
      {queryError && (
        <p className="text-sm text-red-500">
          Failed to load areas. Please try again.
        </p>
      )}
    </div>
  );
}
