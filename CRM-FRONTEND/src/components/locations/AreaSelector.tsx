import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { locationsService } from '@/services/locations';
import { PincodeArea } from '@/types/location';

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
  const { data: areasData, isLoading, error: queryError } = useQuery({
    queryKey: ['areas-for-selection', cityId, searchValue],
    queryFn: () => locationsService.getAreasForSelection({
      cityId,
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

  // Removed addCustomArea and canAddCustomArea functions - only allow selection from existing areas

  return (
    <FormItem className={className}>
      <FormLabel>
        Areas ({selectedAreas.length}/{maxAreas})
      </FormLabel>
      
      <div className="space-y-2">
        {/* Selected Areas */}
        {selectedAreas.length > 0 && (
          <div className="flex flex-wrap gap-2 p-2 border rounded-md bg-muted">
            {selectedAreas.map((areaName, index) => (
              <Badge
                key={`${areaName}-${index}`}
                variant="secondary"
                className="flex items-center gap-1"
              >
                <span className="text-xs font-medium">{index + 1}.</span>
                <span>{areaName}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 hover:bg-red-100"
                  onClick={() => removeArea(areaName)}
                  disabled={disabled || selectedAreas.length <= minAreas}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
          </div>
        )}

        {/* Area Selector */}
        {selectedAreas.length < maxAreas && (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="w-full justify-between"
                disabled={disabled}
              >
                Select or add areas...
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
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
                      <div className="p-2">
                        <p className="text-sm text-muted-foreground">
                          No existing areas found. Please select from available areas only.
                        </p>
                      </div>
                    ) : (
                      "Type at least 2 characters to search areas"
                    )}
                  </CommandEmpty>

                  {uniqueAreaNames.length > 0 && (
                    <CommandGroup heading="Existing Areas">
                      {uniqueAreaNames.map((areaName) => {
                        console.log('AreaSelector - Rendering area:', areaName);
                        const isSelected = selectedAreas.includes(areaName);
                        const areaUsageCount = availableAreas.filter(
                          area => area.name === areaName
                        ).length;

                        return (
                          <CommandItem
                            key={areaName}
                            value={areaName}
                            onSelect={() => {
                              if (!isSelected) {
                                addArea(areaName);
                                setOpen(false);
                              }
                            }}
                            disabled={isSelected}
                            className={cn(
                              "flex items-center justify-between",
                              isSelected && "opacity-50"
                            )}
                          >
                            <div className="flex items-center">
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  isSelected ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <span>{areaName}</span>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {areaUsageCount} pincode{areaUsageCount !== 1 ? 's' : ''}
                            </Badge>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  )}

                  {/* Add custom area option */}
                  {canAddCustomArea() && (
                    <CommandGroup heading="Add New Area">
                      <CommandItem
                        value={`add-${searchValue}`}
                        onSelect={addCustomArea}
                        className="text-blue-600"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add "{searchValue.trim()}"
                      </CommandItem>
                    </CommandGroup>
                  )}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        )}
      </div>

      <FormDescription>
        Select from existing areas or type to add new ones. 
        {selectedAreas.length >= maxAreas && (
          <span className="text-amber-600"> Maximum {maxAreas} areas reached.</span>
        )}
        {cityId && (
          <span className="text-muted-foreground"> Showing areas for selected city.</span>
        )}
      </FormDescription>
      
      {error && <FormMessage>{error}</FormMessage>}
    </FormItem>
  );
}
