import { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, X, AlertCircle, Building2 } from 'lucide-react';
import { Badge } from '@/ui/components/Badge';
import { Button } from '@/ui/components/Button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/ui/components/popover';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/ui/components/AlertDialog';
import { toast } from 'sonner';
import { locationsService } from '@/services/locations';
import { MultiSelectDropdown, MultiSelectOption } from '@/ui/components/MultiSelectDropdown';
import { Box } from '@/ui/primitives/Box';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';
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

  const allAreas = useMemo(() => areasData?.data || [], [areasData?.data]);

  // Convert areas to dropdown options with search filtering
  const areaOptions: MultiSelectOption[] = useMemo(() => {
    if (!allAreas) {return [];}

    // Get current area IDs to filter out already assigned areas
    const currentAreaIds = pincode.areas?.map(area => area.id) || [];

    return allAreas
      .filter(area => {
        // Filter out already assigned areas
        if (currentAreaIds.includes(Number(area.id))) {return false;}

        // Apply search filter
        if (!areaSearchQuery) {return true;}
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
    onError: (error: unknown) => {
      const err = error as import('@/types/api').ApiErrorResponse;
      toast.error(err.response?.data?.message || 'Failed to add areas');
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
    onError: (error: unknown) => {
      const err = error as import('@/types/api').ApiErrorResponse;
      toast.error(err.response?.data?.message || 'Failed to remove area');
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
      removeAreaMutation.mutate(String(areaToRemove.id));
    }
  };

  const handleAreaSelectionChange = (values: (string | number)[]) => {
    setSelectedAreaIds(values);
  };

  return (
    <Box style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', alignItems: 'center' }}>
      {/* Display current areas */}
      {pincode.areas && pincode.areas.length > 0 ? (
        pincode.areas
          .sort((a, b) => a.displayOrder - b.displayOrder)
          .map((area) => (
            <Badge 
              key={area.id} 
              variant="outline" 
              style={className ? undefined : { fontSize: '0.75rem' }}
            >
              {area.name}
              <button
                type="button"
                style={{ marginLeft: '0.25rem', color: 'var(--ui-danger)' }}
                onClick={() => handleRemoveArea(area)}
                disabled={removeAreaMutation.isPending}
              >
                <X size={12} />
              </button>
            </Badge>
          ))
      ) : (
        // Fallback for backward compatibility
        pincode.area && (
          <Badge variant="outline">
            {pincode.area}
          </Badge>
        )
      )}

      {/* Add areas button */}
      <Popover open={showAddPopover} onOpenChange={setShowAddPopover}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            disabled={addAreasMutation.isPending}
            style={{ padding: 0, minWidth: '1.5rem', minHeight: '1.5rem', color: 'var(--ui-text-muted)' }}
          >
            <Plus size={12} />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" style={{ width: '24rem' }}>
          <Stack gap={4}>
            <Stack gap={2}>
              <Text as="h4" variant="label">
                <Stack direction="horizontal" gap={2} align="center">
                  <Building2 size={16} />
                  <span>Add Areas to Pincode {pincode.code}</span>
                </Stack>
              </Text>
              <Text variant="body-sm" tone="muted">
                Select areas to assign to this pincode. Only unassigned areas are shown.
              </Text>
            </Stack>
            
            {areaOptions.length === 0 && !areasLoading ? (
              <Stack gap={2} align="center" style={{ paddingBlock: '2rem', textAlign: 'center' }}>
                <Building2 size={48} style={{ opacity: 0.5, color: 'var(--ui-text-muted)' }} />
                <Text variant="body-sm" tone="muted">No available areas found</Text>
                <Text variant="caption" tone="muted">All areas may already be assigned or none exist.</Text>
              </Stack>
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
              />
            )}

            <Box style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <Button
                variant="outline"
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
                onClick={handleAddAreas}
                disabled={addAreasMutation.isPending || selectedAreaIds.length === 0}
              >
                {addAreasMutation.isPending ? 'Adding...' : `Add ${selectedAreaIds.length} Area${selectedAreaIds.length === 1 ? '' : 's'}`}
              </Button>
            </Box>
          </Stack>
        </PopoverContent>
      </Popover>

      {/* Remove area confirmation dialog */}
      <AlertDialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              <Stack direction="horizontal" gap={2} align="center">
                <AlertCircle size={20} style={{ color: 'var(--ui-danger)' }} />
                <span>Remove Area</span>
              </Stack>
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove &quot;{areaToRemove?.name}&quot; from pincode {pincode.code}?
              {pincode.areas && pincode.areas.length <= 1 && (
                <Box style={{ marginTop: '0.5rem', padding: '0.5rem', border: '1px solid var(--ui-warning)', borderRadius: 'var(--ui-radius-md)', color: 'var(--ui-warning)' }}>
                  <strong>Warning:</strong> This is the last area for this pincode. 
                  Removing it may cause issues.
                </Box>
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
              style={{ background: 'var(--ui-danger)', color: '#fff' }}
            >
              {removeAreaMutation.isPending ? 'Removing...' : 'Remove Area'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Box>
  );
}
