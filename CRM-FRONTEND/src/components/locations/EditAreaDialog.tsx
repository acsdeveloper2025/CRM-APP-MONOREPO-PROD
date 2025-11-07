import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useMutationWithInvalidation } from '@/hooks/useStandardizedMutation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { locationsService } from '@/services/locations';

interface Area {
  id: string;
  name: string;
  usageCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

interface EditAreaDialogProps {
  area: Area;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditAreaDialog({ area, open, onOpenChange }: EditAreaDialogProps) {
  const [name, setName] = useState(area.name);

  // Reset form when area changes
  useEffect(() => {
    setName(area.name);
  }, [area]);

  const updateMutation = useMutationWithInvalidation({
    mutationFn: (data: { name: string }) => locationsService.updateArea(area.id, data),
    invalidateKeys: [['areas'], ['pincodes']],
    successMessage: 'Area updated successfully',
    errorContext: 'Area Update',
    errorFallbackMessage: 'Failed to update area',
    onSuccess: () => {
      onOpenChange(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      return;
    }

    updateMutation.mutate({ name: name.trim() });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Area</DialogTitle>
          <DialogDescription>
            Update the area name. This will affect all pincodes using this area.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Area Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter area name"
                required
              />
            </div>
            {area.usageCount !== undefined && area.usageCount > 0 && (
              <div className="text-sm text-gray-600">
                This area is currently used in {area.usageCount} pincode(s).
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={updateMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Updating...' : 'Update Area'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

