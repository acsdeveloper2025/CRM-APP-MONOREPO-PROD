import { useState, useEffect } from 'react';
import { Button } from '@/ui/components/Button';
import { useMutationWithInvalidation } from '@/hooks/useStandardizedMutation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/components/Dialog';
import { Input } from '@/ui/components/Input';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';
import { locationsService } from '@/services/locations';

interface Area {
  id: string | number;
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
    mutationFn: (data: { name: string }) => locationsService.updateArea(String(area.id), data),
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
      <DialogContent style={{ width: 'min(95vw, 425px)' }}>
        <DialogHeader>
          <DialogTitle>Edit Area</DialogTitle>
          <DialogDescription>
            Update the area name. This will affect all pincodes using this area.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <Stack gap={4} style={{ paddingBlock: 'var(--ui-gap-4)' }}>
            <Stack gap={2}>
              <Text as="label" htmlFor="name" variant="label">
                Area Name
              </Text>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter area name"
                required
              />
            </Stack>
            {area.usageCount !== undefined && area.usageCount > 0 && (
              <Text variant="body-sm" tone="muted">
                This area is currently used in {area.usageCount} pincode(s).
              </Text>
            )}
          </Stack>
          <DialogFooter style={{ display: 'flex', gap: 'var(--ui-gap-2)', flexWrap: 'wrap' }}>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              fullWidth
              disabled={updateMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" fullWidth disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Updating...' : 'Update Area'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
