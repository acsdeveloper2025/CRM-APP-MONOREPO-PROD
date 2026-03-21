import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/ui/components/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/ui/components/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/ui/components/popover';
import { Badge } from '@/ui/components/badge';
import { Box } from '@/ui/primitives/Box';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';
import { locationsService } from '@/services/locations';

// interface Area {
//   id: string;
//   name: string;
// }

interface AreasMultiSelectProps {
  selectedAreaIds: string[];
  onAreasChange: (areaIds: string[]) => void;
  disabled?: boolean;
  error?: string;
}

export function AreasMultiSelect({
  selectedAreaIds,
  onAreasChange,
  disabled = false,
  error,
}: AreasMultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState('');

  // Fetch all available areas
  const { data: areasData, isLoading, error: queryError } = useQuery({
    queryKey: ['standalone-areas'],
    queryFn: () => locationsService.getStandaloneAreas(),
  });

  const allAreas = React.useMemo(() => areasData?.data || [], [areasData?.data]);

  // Filter areas based on search
  const areas = React.useMemo(() => {
    if (!searchValue.trim()) {
      return allAreas;
    }
    return allAreas.filter(area =>
      area.name.toLowerCase().includes(searchValue.toLowerCase())
    );
  }, [allAreas, searchValue]);

  const selectedAreas = allAreas.filter(area => selectedAreaIds.includes(area.id));

  const handleSelect = (areaId: string) => {
    if (selectedAreaIds.includes(areaId)) {
      // Remove area
      const newSelection = selectedAreaIds.filter(id => id !== areaId);
      onAreasChange(newSelection);
    } else {
      // Add area (check max limit)
      if (selectedAreaIds.length >= 15) {
        return; // Maximum limit reached
      }
      const newSelection = [...selectedAreaIds, areaId];
      onAreasChange(newSelection);
    }
  };

  const handleRemove = (areaId: string) => {
    onAreasChange(selectedAreaIds.filter(id => id !== areaId));
  };

  return (
    <Stack gap={2}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            fullWidth
            disabled={disabled}
            style={{
              justifyContent: 'space-between',
              color: selectedAreaIds.length === 0 ? 'var(--ui-text-muted)' : undefined,
              borderColor: error ? 'var(--ui-danger)' : undefined,
            }}
          >
            {selectedAreaIds.length === 0
              ? "Select areas..."
              : `${selectedAreaIds.length} area${selectedAreaIds.length === 1 ? '' : 's'} selected${selectedAreaIds.length >= 15 ? ' (max)' : ''}`
            }
            <ChevronsUpDown size={16} style={{ marginLeft: '0.5rem', opacity: 0.5, flexShrink: 0 }} />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" style={{ width: 'var(--radix-popover-trigger-width)', padding: 0 }}>
          <Command shouldFilter={false}>
            <Box style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--ui-border)', paddingInline: '0.75rem' }}>
              <CommandInput
                placeholder="Search areas..."
                value={searchValue}
                onValueChange={setSearchValue}
                style={{ flex: 1 }}
              />
              {searchValue && (
                <Button
                  variant="ghost"
                  onClick={() => setSearchValue('')}
                  style={{ padding: 0, minWidth: '1.5rem', minHeight: '1.5rem', background: 'transparent' }}
                >
                  <X size={16} />
                </Button>
              )}
            </Box>
            <CommandList style={{ maxHeight: '16rem' }}>
              <CommandEmpty>
                {isLoading ? "Loading areas..." : queryError ? `Error: ${queryError.message}` : searchValue ? `No areas found matching "${searchValue}"` : "No areas found"}
              </CommandEmpty>
              <CommandGroup>
                {!isLoading && areas.length > 0 && (
                  <Text
                    variant="caption"
                    tone="muted"
                    style={{ display: 'block', padding: '0.25rem 0.5rem', borderBottom: '1px solid var(--ui-border)' }}
                  >
                    {areas.length} area{areas.length === 1 ? '' : 's'} {searchValue ? `matching "${searchValue}"` : 'available'}
                  </Text>
                )}
                {areas.map((area) => {
                  const isSelected = selectedAreaIds.includes(area.id);
                  return (
                    <CommandItem
                      key={area.id}
                      value={area.name}
                      style={{ cursor: 'pointer' }}
                      onSelect={() => {
                        handleSelect(area.id);
                        // Keep the popover open for multi-selection
                      }}
                    >
                      <Check
                        size={16}
                        style={{ marginRight: '0.5rem', opacity: isSelected ? 1 : 0 }}
                      />
                      {area.name}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Selected areas display */}
      {selectedAreas.length > 0 && (
        <Box style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
          {selectedAreas.map((area) => (
            <Badge
              key={area.id}
              variant="secondary"
            >
              {area.name}
              {!disabled && (
                <button
                  type="button"
                  style={{ marginLeft: '0.25rem', borderRadius: '999px', outline: 'none' }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleRemove(area.id);
                    }
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onClick={() => handleRemove(area.id)}
                >
                  <X size={12} style={{ color: 'var(--ui-text-muted)' }} />
                </button>
              )}
            </Badge>
          ))}
        </Box>
      )}

      {error && (
        <Text variant="body-sm" tone="danger">{error}</Text>
      )}

      <Text variant="caption" tone="muted">
        Select areas from the available list. Areas must be created in the Areas management tab first.
      </Text>
    </Stack>
  );
}
