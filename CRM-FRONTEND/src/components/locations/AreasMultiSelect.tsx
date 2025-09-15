import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown, X } from 'lucide-react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { locationsService } from '@/services/locations';

interface Area {
  id: string;
  name: string;
}

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

  const allAreas = areasData?.data || [];

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

  // Debug logging (reduced)
  React.useEffect(() => {
    if (queryError) {
      console.error('AreasMultiSelect Error:', queryError);
    }
  }, [queryError]);

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
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full justify-between",
              selectedAreaIds.length === 0 && "text-muted-foreground",
              error && "border-red-500"
            )}
            disabled={disabled}
          >
            {selectedAreaIds.length === 0
              ? "Select areas..."
              : `${selectedAreaIds.length} area${selectedAreaIds.length === 1 ? '' : 's'} selected${selectedAreaIds.length >= 15 ? ' (max)' : ''}`
            }
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command shouldFilter={false}>
            <div className="flex items-center border-b px-3">
              <CommandInput
                placeholder="Search areas..."
                value={searchValue}
                onValueChange={setSearchValue}
                className="flex-1"
              />
              {searchValue && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-transparent"
                  onClick={() => setSearchValue('')}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <CommandList className="max-h-64">
              <CommandEmpty>
                {isLoading ? "Loading areas..." : queryError ? `Error: ${queryError.message}` : searchValue ? `No areas found matching "${searchValue}"` : "No areas found"}
              </CommandEmpty>
              <CommandGroup>
                {!isLoading && areas.length > 0 && (
                  <div className="text-xs text-muted-foreground px-2 py-1 border-b">
                    {areas.length} area{areas.length === 1 ? '' : 's'} {searchValue ? `matching "${searchValue}"` : 'available'}
                  </div>
                )}
                {areas.map((area) => {
                  const isSelected = selectedAreaIds.includes(area.id);
                  return (
                    <CommandItem
                      key={area.id}
                      value={area.name}
                      className="cursor-pointer"
                      onSelect={() => {
                        handleSelect(area.id);
                        // Keep the popover open for multi-selection
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          isSelected ? "opacity-100" : "opacity-0"
                        )}
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
        <div className="flex flex-wrap gap-1">
          {selectedAreas.map((area) => (
            <Badge
              key={area.id}
              variant="secondary"
              className="text-xs"
            >
              {area.name}
              {!disabled && (
                <button
                  type="button"
                  className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
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
                  <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      <p className="text-xs text-muted-foreground">
        Select areas from the available list. Areas must be created in the Areas management tab first.
      </p>
    </div>
  );
}
