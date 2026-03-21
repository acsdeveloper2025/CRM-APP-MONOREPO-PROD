import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/ui/components/Button';
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
import { Badge } from '@/ui/components/Badge';
import { FormItem, FormLabel, FormMessage, FormDescription } from '@/ui/components/form';
import { Box } from '@/ui/primitives/Box';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';
import { locationsService } from '@/services/locations';

interface AreaSelectorProps {
  selectedAreas: string[]; // Array of area names
  onAreasChange: (areas: string[]) => void;
  cityId?: string;
  error?: string;
  maxAreas?: number;
  minAreas?: number;
  className?: string;
  disabled?: boolean;
}

export function AreaSelector({
  selectedAreas,
  onAreasChange,
  cityId,
  error,
  maxAreas = 15,
  minAreas = 1,
  className,
  disabled = false,
}: AreaSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  // Fetch areas for selection
  const { data: areasData, isLoading } = useQuery({
    queryKey: ['areas-for-selection', cityId, searchValue],
    queryFn: () => locationsService.getAreas({
      search: searchValue || undefined,
    }),
    enabled: open, // Only fetch when dropdown is open
  });

  const availableAreas = areasData?.data || [];



  // Get unique area names from available areas
  const uniqueAreaNames = Array.from(
    new Set(availableAreas.map(area => area.name))
  ).sort();

  const addArea = (areaName: string) => {
    if (selectedAreas.includes(areaName) || selectedAreas.length >= maxAreas) {
      return;
    }
    onAreasChange([...selectedAreas, areaName]);
  };

  const removeArea = (areaName: string) => {
    if (selectedAreas.length <= minAreas) {
      return;
    }
    onAreasChange(selectedAreas.filter(area => area !== areaName));
  };



  return (
    <FormItem>
      <FormLabel>
        Areas ({selectedAreas.length}/{maxAreas})
      </FormLabel>

      <Stack gap={2} style={className ? undefined : undefined}>
        {/* Selected Areas */}
        {selectedAreas.length > 0 && (
          <Box
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.5rem',
              padding: '0.5rem',
              border: '1px solid var(--ui-border)',
              borderRadius: 'var(--ui-radius-md)',
              background: 'color-mix(in srgb, var(--ui-surface) 80%, white)',
            }}
          >
            {selectedAreas.map((areaName, index) => (
              <Badge
                key={`${areaName}-${index}`}
                variant="secondary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
              >
                <Text as="span" variant="caption" style={{ fontWeight: 600 }}>
                  {index + 1}.
                </Text>
                <Text as="span" variant="body-sm">{areaName}</Text>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => removeArea(areaName)}
                  disabled={disabled || selectedAreas.length <= minAreas}
                  style={{ padding: 0, minWidth: '1rem', minHeight: '1rem' }}
                >
                  <X size={12} />
                </Button>
              </Badge>
            ))}
          </Box>
        )}

        {/* Area Selector */}
        {selectedAreas.length < maxAreas && (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                fullWidth
                disabled={disabled}
                style={{ justifyContent: 'space-between' }}
              >
                Select or add areas...
                <ChevronsUpDown size={16} style={{ marginLeft: '0.5rem', opacity: 0.5, flexShrink: 0 }} />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" style={{ width: 'var(--radix-popover-trigger-width)', padding: 0 }}>
              <Command>
                <CommandInput
                  placeholder="Search areas or type new area name..."
                  value={searchValue}
                  onValueChange={setSearchValue}
                />
                <CommandList>
                  <CommandEmpty>
                    {isLoading ? (
                      "Loading areas..."
                    ) : searchValue.trim().length >= 2 ? (
                      <Box style={{ padding: '0.5rem' }}>
                        <Text variant="body-sm" tone="muted">
                          No existing areas found. Please select from available areas only.
                        </Text>
                      </Box>
                    ) : (
                      "Type at least 2 characters to search areas"
                    )}
                  </CommandEmpty>

                  {uniqueAreaNames.length > 0 && (
                    <CommandGroup heading="Existing Areas">
                      {uniqueAreaNames.map((areaName) => {
                        const isSelected = selectedAreas.includes(areaName);
                        const areaUsageCount = availableAreas.filter(
                          area => area.name === areaName
                        ).length;

                        return (
                          <CommandItem
                            key={areaName}
                            value={areaName || ''}
                            onSelect={() => {
                              if (!isSelected) {
                                addArea(areaName);
                                setOpen(false);
                              }
                            }}
                            disabled={isSelected}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              opacity: isSelected ? 0.5 : 1,
                            }}
                          >
                            <Stack direction="horizontal" gap={2} align="center">
                              <Check
                                size={16}
                                style={{ opacity: isSelected ? 1 : 0 }}
                              />
                              <Text as="span" variant="body-sm">{areaName}</Text>
                            </Stack>
                            <Badge variant="outline">
                              {areaUsageCount} pincode{areaUsageCount !== 1 ? 's' : ''}
                            </Badge>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  )}


                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        )}
      </Stack>

      <FormDescription>
        Select from existing areas or type to add new ones. 
        {selectedAreas.length >= maxAreas && (
          <Text as="span" variant="body-sm" tone="warning"> Maximum {maxAreas} areas reached.</Text>
        )}
        {cityId && (
          <Text as="span" variant="body-sm" tone="muted"> Showing areas for selected city.</Text>
        )}
      </FormDescription>
      
      {error && <FormMessage>{error}</FormMessage>}
    </FormItem>
  );
}
