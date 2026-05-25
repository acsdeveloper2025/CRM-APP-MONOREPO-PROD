import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertCircle, Edit } from 'lucide-react';
import { TaskPriority, UpdateVerificationTaskRequest } from '@/types/verificationTask';
import { logger } from '@/utils/logger';

// KYC vs field verification — the dialog must render a different field
// set per `task.taskType`. KYC tasks (verification_tasks rows with
// taskType='KYC') have documentType + documentNumber populated and do
// NOT carry an address/pincode; field tasks are the inverse. Wiring the
// discriminator through the prop boundary lets the caller stay
// type-agnostic. The kyc_document_verifications table is a separate
// concept (KYCTaskVerificationSection) and does NOT use this modal.
type TaskType = 'REVISIT' | 'KYC' | null | undefined;

interface EditTaskDetailsModalProps {
  task: {
    id: string;
    taskTitle: string;
    taskDescription?: string;
    priority: string;
    address?: string;
    pincode?: string;
    taskType?: TaskType;
    documentType?: string;
    documentNumber?: string;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (taskId: string, data: UpdateVerificationTaskRequest) => Promise<void>;
}

export const EditTaskDetailsModal: React.FC<EditTaskDetailsModalProps> = ({
  task,
  open,
  onOpenChange,
  onSubmit,
}) => {
  const isKyc = task.taskType === 'KYC';
  const [loading, setLoading] = useState(false);
  // B3 fix: lazy init from task prop so first render shows correct values
  // (no empty-form flash on every reopen before useEffect catches up).
  const [formData, setFormData] = useState(() => ({
    taskTitle: task.taskTitle || '',
    taskDescription: task.taskDescription || '',
    priority: (task.priority as TaskPriority) || 'MEDIUM',
    address: task.address || '',
    pincode: task.pincode || '',
    documentType: task.documentType || '',
    documentNumber: task.documentNumber || '',
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (task && open) {
      setFormData({
        taskTitle: task.taskTitle || '',
        taskDescription: task.taskDescription || '',
        priority: (task.priority as TaskPriority) || 'MEDIUM',
        address: task.address || '',
        pincode: task.pincode || '',
        documentType: task.documentType || '',
        documentNumber: task.documentNumber || '',
      });
      setErrors({});
    }
  }, [task, open]);

  // B4 fix: route every close path (Cancel, Esc, click-outside, submit
  // success) through this wrapper so dirty formData doesn't persist between
  // close and reopen. The useEffect above also resets on next open, but
  // resetting immediately on close prevents the brief stale-state render.
  const handleOpenChange = (next: boolean) => {
    if (!next && !loading) {
      setFormData({
        taskTitle: task.taskTitle || '',
        taskDescription: task.taskDescription || '',
        priority: (task.priority as TaskPriority) || 'MEDIUM',
        address: task.address || '',
        pincode: task.pincode || '',
        documentType: task.documentType || '',
        documentNumber: task.documentNumber || '',
      });
      setErrors({});
    }
    onOpenChange(next);
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.taskTitle.trim()) {
      newErrors.taskTitle = 'Task title is required';
    }
    // Branch validation by taskType — KYC tasks don't carry a physical
    // address; field tasks don't carry a document identifier.
    if (isKyc) {
      if (!formData.documentType.trim()) {
        newErrors.documentType = 'Document type is required';
      }
      if (!formData.documentNumber.trim()) {
        newErrors.documentNumber = 'Document number is required';
      }
    } else {
      if (!formData.address.trim()) {
        newErrors.address = 'Address is required';
      }
      if (!formData.pincode.trim()) {
        newErrors.pincode = 'Pincode is required';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      return;
    }

    try {
      setLoading(true);
      // Only send the fields that apply to this task type. The BE
      // updateTask handler builds a dynamic UPDATE from whichever
      // camelCase keys arrive (verificationTasksController.ts:1763),
      // so an undefined field is simply skipped — no need to clear
      // the other axis explicitly.
      const updateData: UpdateVerificationTaskRequest = isKyc
        ? {
            taskTitle: formData.taskTitle,
            taskDescription: formData.taskDescription,
            priority: formData.priority,
            documentType: formData.documentType,
            documentNumber: formData.documentNumber,
          }
        : {
            taskTitle: formData.taskTitle,
            taskDescription: formData.taskDescription,
            priority: formData.priority,
            address: formData.address,
            pincode: formData.pincode,
          };

      await onSubmit(task.id, updateData);
      handleOpenChange(false);
    } catch (error) {
      logger.error('Failed to update task:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Edit className="h-5 w-5" />
            <span>Edit {isKyc ? 'KYC ' : ''}Task Details</span>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="taskTitle">
              Task Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="taskTitle"
              value={formData.taskTitle}
              onChange={(e) => handleChange('taskTitle', e.target.value)}
              className={errors.taskTitle ? 'border-destructive' : ''}
              placeholder="Enter task title"
            />
            {errors.taskTitle && (
              <p className="text-sm text-destructive flex items-center mt-1">
                <AlertCircle className="h-4 w-4 mr-1" />
                {errors.taskTitle}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(value) => handleChange('priority', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="URGENT">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isKyc ? (
              <div className="space-y-2">
                <Label htmlFor="documentType">
                  Document Type <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="documentType"
                  value={formData.documentType}
                  onChange={(e) => handleChange('documentType', e.target.value)}
                  className={errors.documentType ? 'border-destructive' : ''}
                  placeholder="e.g. PAN, Aadhaar, Passport"
                />
                {errors.documentType && (
                  <p className="text-sm text-destructive flex items-center mt-1">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    {errors.documentType}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="pincode">
                  Pincode <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="pincode"
                  value={formData.pincode}
                  onChange={(e) => handleChange('pincode', e.target.value)}
                  className={errors.pincode ? 'border-destructive' : ''}
                  placeholder="Enter pincode"
                />
                {errors.pincode && (
                  <p className="text-sm text-destructive flex items-center mt-1">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    {errors.pincode}
                  </p>
                )}
              </div>
            )}
          </div>

          {isKyc ? (
            <div className="space-y-2">
              <Label htmlFor="documentNumber">
                Document Number <span className="text-destructive">*</span>
              </Label>
              <Input
                id="documentNumber"
                value={formData.documentNumber}
                onChange={(e) => handleChange('documentNumber', e.target.value)}
                className={errors.documentNumber ? 'border-destructive' : ''}
                placeholder="Enter document number"
              />
              {errors.documentNumber && (
                <p className="text-sm text-destructive flex items-center mt-1">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  {errors.documentNumber}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="address">
                Address <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="address"
                value={formData.address}
                onChange={(e) => handleChange('address', e.target.value)}
                className={errors.address ? 'border-destructive' : ''}
                placeholder="Enter full address"
                rows={3}
              />
              {errors.address && (
                <p className="text-sm text-destructive flex items-center mt-1">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  {errors.address}
                </p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="taskDescription">Description</Label>
            <Textarea
              id="taskDescription"
              value={formData.taskDescription}
              onChange={(e) => handleChange('taskDescription', e.target.value)}
              placeholder="Enter task description"
              rows={3}
            />
          </div>

          <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={loading}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="w-full sm:w-auto">
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
