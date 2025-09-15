import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X, AlertCircle } from 'lucide-react';
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
import { AreasMultiSelect } from './AreasMultiSelect';
import type { Pincode, PincodeArea } from '@/types/location';

interface InlineAreaManagerProps {
  pincode: Pincode;
  className?: string;
}

export function InlineAreaManager({ pincode, className }: InlineAreaManagerProps) {
  const [showAddPopover, setShowAddPopover] = useState(false);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [areaToRemove, setAreaToRemove] = useState<PincodeArea | null>(null);
  const [selectedAreaIds, setSelectedAreaIds] = useState<string[]>([]);

  const queryClient = useQueryClient();

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

  // Get current area IDs to filter out from selection
  const currentAreaIds = pincode.areas?.map(area => area.id) || [];
  const availableAreaIds = selectedAreaIds.filter(id => !currentAreaIds.includes(id));

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
        <PopoverContent className="w-80" align="start">
          <div className="space-y-4">
            <div>
              <h4 className="font-medium">Add Areas</h4>
              <p className="text-sm text-muted-foreground">
                Select additional areas for pincode {pincode.code}
              </p>
            </div>
            
            <AreasMultiSelect
              selectedAreaIds={selectedAreaIds}
              onAreasChange={setSelectedAreaIds}
              disabled={addAreasMutation.isPending}
            />

            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddPopover(false)}
                disabled={addAreasMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleAddAreas}
                disabled={addAreasMutation.isPending || selectedAreaIds.length === 0}
              >
                {addAreasMutation.isPending ? 'Adding...' : 'Add Areas'}
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
