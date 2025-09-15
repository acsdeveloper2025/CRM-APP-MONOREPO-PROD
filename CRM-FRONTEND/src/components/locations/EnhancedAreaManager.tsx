import React, { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, X, AlertCircle, Building2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { locationsService } from '@/services/locations';
import { MultiSelectDropdown, MultiSelectOption } from '@/components/ui/multi-select-dropdown';
import type { Pincode, PincodeArea } from '@/types/location';

interface EnhancedAreaManagerProps {
  pincode: Pincode;
  className?: string;
}

export function EnhancedAreaManager({ pincode, className }: EnhancedAreaManagerProps) {
  const [showAddPopover, setShowAddPopover] = useState(false);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [areaToRemove, setAreaToRemove] = useState<PincodeArea | null>(null);
  const [selectedAreaIds, setSelectedAreaIds] = useState<(string | number)[]>([]);
  const [areaSearchQuery, setAreaSearchQuery] = useState('');

  const queryClient = useQueryClient();

  // Fetch all available areas for selection
  const { data: areasData, isLoading: areasLoading } = useQuery({
    queryKey: ['standalone-areas', areaSearchQuery],
    queryFn: () => locationsService.getStandaloneAreas(),
    enabled: showAddPopover, // Only fetch when popover is open
  });

  const allAreas = areasData?.data || [];

  // Convert areas to dropdown options with search filtering
  const areaOptions: MultiSelectOption[] = useMemo(() => {
    if (!allAreas) return [];

    // Get current area IDs to filter out already assigned areas
    const currentAreaIds = pincode.areas?.map(area => area.id) || [];

    return allAreas
      .filter(area => {
        // Filter out already assigned areas
        if (currentAreaIds.includes(area.id)) return false;

        // Apply search filter
        if (!areaSearchQuery) return true;
        const query = areaSearchQuery.toLowerCase();
        return area.name.toLowerCase().includes(query);
      })
      .map(area => ({
        id: area.id,
        label: area.name
        // Removed description to show only area names
      }));
  }, [allAreas, pincode.areas, areaSearchQuery]);

  // Add areas mutation
  const addAreasMutation = useMutation({
    mutationFn: (areaIds: number[]) =>
      locationsService.addPincodeAreas(pincode.id, { areaIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pincodes'] });
      queryClient.invalidateQueries({ queryKey: ['areas'] });
      toast.success('Areas added successfully');
      setSelectedAreaIds([]);
      setShowAddPopover(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to add areas');
    },
  });

  // Remove area mutation
  const removeAreaMutation = useMutation({
    mutationFn: (areaId: string) => 
      locationsService.removePincodeArea(pincode.id, areaId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pincodes'] });
      queryClient.invalidateQueries({ queryKey: ['areas'] });
      toast.success('Area removed successfully');
      setShowRemoveDialog(false);
      setAreaToRemove(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to remove area');
      setShowRemoveDialog(false);
      setAreaToRemove(null);
    },
  });

  const handleAddAreas = () => {
    if (selectedAreaIds.length === 0) {
      toast.error('Please select at least one area');
      return;
    }
    addAreasMutation.mutate(selectedAreaIds.map(id => Number(id)));
  };

  const handleRemoveArea = (area: PincodeArea) => {
    setAreaToRemove(area);
    setShowRemoveDialog(true);
  };

  const confirmRemoveArea = () => {
    if (areaToRemove) {
      removeAreaMutation.mutate(areaToRemove.id);
    }
  };

  const handleAreaSelectionChange = (values: (string | number)[]) => {
    setSelectedAreaIds(values);
  };

  return (
    <div className={`flex flex-wrap gap-1 items-center ${className}`}>
      {/* Display current areas */}
      {pincode.areas && pincode.areas.length > 0 ? (
        pincode.areas
          .sort((a, b) => a.displayOrder - b.displayOrder)
          .map((area) => (
            <Badge 
              key={area.id} 
              variant="outline" 
              className="text-xs group hover:bg-destructive/10 transition-colors"
            >
              {area.name}
              <button
                type="button"
                className="ml-1 opacity-0 group-hover:opacity-100 hover:text-destructive transition-all"
                onClick={() => handleRemoveArea(area)}
                disabled={removeAreaMutation.isPending}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))
      ) : (
        // Fallback for backward compatibility
        pincode.area && (
          <Badge variant="outline" className="text-xs">
            {pincode.area}
          </Badge>
        )
      )}

      {/* Add areas button */}
      <Popover open={showAddPopover} onOpenChange={setShowAddPopover}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-muted-foreground hover:text-primary"
            disabled={addAreasMutation.isPending}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-96" align="start">
          <div className="space-y-4">
            <div>
              <h4 className="font-medium flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Add Areas to Pincode {pincode.code}
              </h4>
              <p className="text-sm text-muted-foreground">
                Select areas to assign to this pincode. Only unassigned areas are shown.
              </p>
            </div>
            
            {areaOptions.length === 0 && !areasLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-sm">No available areas found</p>
                <p className="text-xs">All areas may already be assigned or none exist.</p>
              </div>
            ) : (
              <MultiSelectDropdown
                options={areaOptions}
                selectedValues={selectedAreaIds}
                onSelectionChange={handleAreaSelectionChange}
                placeholder="Select areas to add..."
                searchPlaceholder="Search available areas..."
                onSearch={setAreaSearchQuery}
                searchQuery={areaSearchQuery}
                isLoading={areasLoading}
                maxDisplayItems={50}
                emptyMessage="No areas found matching your search"
                className="w-full"
              />
            )}

            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowAddPopover(false);
                  setSelectedAreaIds([]);
                  setAreaSearchQuery('');
                }}
                disabled={addAreasMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleAddAreas}
                disabled={addAreasMutation.isPending || selectedAreaIds.length === 0}
              >
                {addAreasMutation.isPending ? 'Adding...' : `Add ${selectedAreaIds.length} Area${selectedAreaIds.length === 1 ? '' : 's'}`}
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Remove area confirmation dialog */}
      <AlertDialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Remove Area
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove "{areaToRemove?.name}" from pincode {pincode.code}?
              {pincode.areas && pincode.areas.length <= 1 && (
                <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-amber-800 text-sm">
                  <strong>Warning:</strong> This is the last area for this pincode. 
                  Removing it may cause issues.
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeAreaMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRemoveArea}
              disabled={removeAreaMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removeAreaMutation.isPending ? 'Removing...' : 'Remove Area'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
