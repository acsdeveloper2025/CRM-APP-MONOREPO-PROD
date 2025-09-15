import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

import { commissionManagementService } from '@/services/commissionManagement';
import { rateTypesService } from '@/services/rateTypes';
import { toast } from 'sonner';
import type { CommissionRateType, CommissionFormData } from '@/types/commission';

interface CommissionRateTypeFormProps {
  rateType?: CommissionRateType;
  onSuccess: () => void;
  onCancel: () => void;
}

export const CommissionRateTypeForm: React.FC<CommissionRateTypeFormProps> = ({
  rateType,
  onSuccess,
  onCancel,
}) => {
  const [formData, setFormData] = useState<CommissionFormData>({
    rateTypeId: rateType?.rateTypeId || 0,
    commissionAmount: rateType?.commissionAmount || 0,
    currency: rateType?.currency || 'INR',
    isActive: rateType?.isActive ?? true,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch available rate types
  const { data: rateTypesData } = useQuery({
    queryKey: ['rate-types'],
    queryFn: () => rateTypesService.getRateTypes({ isActive: true }),
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: commissionManagementService.createCommissionRateType,
    onSuccess: () => {
      toast.success('Commission rate type created successfully');
      onSuccess();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create commission rate type');
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      commissionManagementService.updateCommissionRateType(id, data),
    onSuccess: () => {
      toast.success('Commission rate type updated successfully');
      onSuccess();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update commission rate type');
    },
  });

  const rateTypes = rateTypesData?.data || [];
  const isEditing = !!rateType;
  const isLoading = createMutation.isPending || updateMutation.isPending;

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.rateTypeId) {
      newErrors.rateTypeId = 'Rate type is required';
    }

    if (!formData.commissionAmount || formData.commissionAmount <= 0) {
      newErrors.commissionAmount = 'Commission amount must be greater than 0';
    }

    if (!formData.currency) {
      newErrors.currency = 'Currency is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const submitData = {
      rateTypeId: formData.rateTypeId,
      commissionAmount: formData.commissionAmount,
      currency: formData.currency,
      isActive: formData.isActive,
    };

    if (isEditing && rateType) {
      updateMutation.mutate({ id: rateType.id, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };



  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Rate Type Selection */}
      <div className="space-y-2">
        <Label htmlFor="rateTypeId">Rate Type *</Label>
        <Select
          value={formData.rateTypeId.toString()}
          onValueChange={(value) => setFormData(prev => ({ ...prev, rateTypeId: Number(value) }))}
          disabled={isEditing} // Cannot change rate type when editing
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a rate type" />
          </SelectTrigger>
          <SelectContent>
            {rateTypes.map((rateType) => (
              <SelectItem key={rateType.id} value={rateType.id.toString()}>
                {rateType.name}
                {rateType.description && (
                  <span className="text-muted-foreground ml-2">- {rateType.description}</span>
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.rateTypeId && (
          <p className="text-sm text-destructive">{errors.rateTypeId}</p>
        )}
      </div>

      {/* Commission Amount */}
        <div className="space-y-2">
          <Label htmlFor="commissionAmount">Commission Amount *</Label>
          <div className="flex gap-2">
            <Select
              value={formData.currency}
              onValueChange={(value) => setFormData(prev => ({ ...prev, currency: value }))}
            >
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="INR">INR</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
              </SelectContent>
            </Select>
            <Input
              id="commissionAmount"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={formData.commissionAmount || ''}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                commissionAmount: e.target.value ? Number(e.target.value) : 0
              }))}
              className="flex-1"
            />
          </div>
          {errors.commissionAmount && (
            <p className="text-sm text-destructive">{errors.commissionAmount}</p>
          )}
        </div>

      {/* Active Status */}
      <div className="flex items-center space-x-2">
        <Switch
          id="isActive"
          checked={formData.isActive}
          onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
        />
        <Label htmlFor="isActive">Active</Label>
      </div>

      {/* Form Actions */}
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Saving...' : isEditing ? 'Update' : 'Create'}
        </Button>
      </div>
    </form>
  );
};
