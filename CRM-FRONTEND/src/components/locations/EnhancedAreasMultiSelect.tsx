import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { locationsService } from '@/services/locations';
import { MultiSelectDropdown, MultiSelectOption } from '@/ui/components/MultiSelectDropdown';
import { Box } from '@/ui/primitives/Box';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';

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

  return (
    <Stack gap={2}>
      <Box style={error ? { border: '1px solid var(--ui-danger)', borderRadius: 'var(--ui-radius-md)' } : undefined}>
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
        />
      </Box>

      {error && (
        <Text variant="body-sm" tone="danger">{error}</Text>
      )}

      {selectedAreaIds.length > 0 && (
        <Text variant="caption" tone="muted">
          {selectedAreaIds.length} of {maxAreas} areas selected
          {selectedAreaIds.length >= maxAreas && ' (maximum reached)'}
        </Text>
      )}

      {queryError && (
        <Text variant="body-sm" tone="danger">
          Failed to load areas. Please try again.
        </Text>
      )}
    </Stack>
  );
}
