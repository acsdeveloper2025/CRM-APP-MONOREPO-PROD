import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/components/Dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/ui/components/Form';
import { Input } from '@/ui/components/Input';
import { Button } from '@/ui/components/Button';
import { Textarea } from '@/ui/components/Textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/components/Select';
import { VerificationTask, TaskPriority } from '@/types/verificationTask';
import { User } from '@/types/user';
import { useUpdateVerificationTask } from '@/hooks/useVerificationTasks';
import { useFieldUsers } from '@/hooks/useUsers';
import { useRateTypes } from '@/hooks/useRateTypes';
import { toast } from 'sonner';

const editTaskSchema = z.object({
  taskTitle: z.string().min(1, 'Task title is required'),
  taskDescription: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  assignedTo: z.string().optional(), // Add assignedTo field
  rateTypeId: z.number().optional(), // Add rateTypeId field
  address: z.string().min(1, 'Address is required'),
  pincode: z.string().min(1, 'Pincode is required'),
  trigger: z.string().optional(),
  applicantType: z.string().optional(),
});

type EditTaskFormData = z.infer<typeof editTaskSchema>;

interface EditTaskDialogProps {
  isOpen: boolean;
  onClose: () => void;
  task: VerificationTask;
  onSuccess: () => void;
}

export const EditTaskDialog: React.FC<EditTaskDialogProps> = ({
  isOpen,
  onClose,
  task,
  onSuccess,
}) => {
  const updateTaskMutation = useUpdateVerificationTask();
  const { data: fieldUsers = [] } = useFieldUsers();
  const { data: rateTypesData } = useRateTypes();
  const rateTypes = rateTypesData?.data || [];

  const form = useForm<EditTaskFormData>({
    resolver: zodResolver(editTaskSchema),
    defaultValues: {
      taskTitle: '',
      taskDescription: '',
      priority: 'MEDIUM',
      assignedTo: '',
      rateTypeId: undefined,
      address: '',
      pincode: '',
      trigger: '',
      applicantType: '',
    },
  });

  useEffect(() => {
    if (task && isOpen) {
      form.reset({
        taskTitle: task.taskTitle || '',
        taskDescription: task.taskDescription || '',
        priority: task.priority || 'MEDIUM',
        assignedTo: (task.assignedTo && typeof task.assignedTo === 'object') ? task.assignedTo.id : (typeof task.assignedTo === 'string' ? task.assignedTo : ''),
        rateTypeId: task.rateTypeId || undefined,
        address: task.address || '',
        pincode: task.pincode || '',
        trigger: task.trigger || '',
        applicantType: task.applicantType || '',
      });
    }
  }, [task, isOpen, form]);

  const handleSubmit = async (data: EditTaskFormData) => {
    try {
      console.warn('🔍 EditTaskDialog - handleSubmit START', {
        taskId: task.id,
        taskStatus: task.status,
        currentAssignedTo: task.assignedTo,
        formData: data,
      });

      // Build submission data, only including assignedTo if actually assigned
      const submissionData: {
        taskTitle: string;
        taskDescription?: string;
        priority: TaskPriority;
        address: string;
        pincode: string;
        trigger?: string;
        applicantType?: string;
        rateTypeId?: number;
        caseId: string;
        assignedTo?: string | null;
      } = {
        taskTitle: data.taskTitle,
        taskDescription: data.taskDescription,
        priority: data.priority,
        address: data.address,
        pincode: data.pincode,
        trigger: data.trigger,
        applicantType: data.applicantType,
        rateTypeId: data.rateTypeId || task.rateTypeId, // Preserve existing if not changed
        caseId: task.caseId, // Preserve case association
      };

      // Only include assignedTo if it has changed
      const currentAssignedToId = (task.assignedTo && typeof task.assignedTo === 'object') 
        ? task.assignedTo.id 
        : (typeof task.assignedTo === 'string' ? task.assignedTo : undefined);

      console.warn('🔍 Assignment Logic Check', {
        'data.assignedTo': data.assignedTo,
        currentAssignedToId,
        'task.assignedTo (raw)': task.assignedTo,
        'typeof task.assignedTo': typeof task.assignedTo,
        'data.assignedTo !== currentAssignedToId': data.assignedTo !== currentAssignedToId,
      });

      if (data.assignedTo && data.assignedTo !== 'unassigned') {
        if (data.assignedTo !== currentAssignedToId) {
          submissionData.assignedTo = data.assignedTo;
          console.warn('✅ Including assignedTo in submission:', data.assignedTo);
        } else {
          console.warn('⏭️ Skipping assignedTo (no change)');
        }
      } else if (data.assignedTo === 'unassigned' && currentAssignedToId) {
        // Explicitly unassign if it was previously assigned
        submissionData.assignedTo = null;
        console.warn('🗑️ Unassigning task');
      } else {
        console.warn('⚠️ No assignment action taken', {
          'data.assignedTo': data.assignedTo,
          currentAssignedToId,
        });
      }

      console.warn('📤 Final submission data:', submissionData);

      // Debug: Show what we're submitting
      toast.success(`Submitting: Assigned To = ${submissionData.assignedTo || 'NOT SET'}, Rate Type = ${submissionData.rateTypeId || 'NOT SET'}`);

      await updateTaskMutation.mutateAsync({
        id: task.id,
        data: submissionData,
      });
      toast.success('Task updated successfully');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Failed to update task:', error);
      toast.error('Failed to update task');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent {...{ className: "sm:max-w-[600px]" }}>
        <DialogHeader>
          <DialogTitle>Edit Verification Task</DialogTitle>
          <DialogDescription>
            Update the details for this verification task.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} {...{ className: "space-y-4" }}>
            <FormField
              control={form.control}
              name="taskTitle"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Task Title *</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g. Home Verification" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div {...{ className: "grid grid-cols-1 md:grid-cols-2 gap-4" }}>
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="LOW">Low</SelectItem>
                        <SelectItem value="MEDIUM">Medium</SelectItem>
                        <SelectItem value="HIGH">High</SelectItem>
                        <SelectItem value="URGENT">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="applicantType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Applicant Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="APPLICANT">APPLICANT</SelectItem>
                        <SelectItem value="CO-APPLICANT">CO-APPLICANT</SelectItem>
                        <SelectItem value="GUARANTOR">GUARANTOR</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div {...{ className: "grid grid-cols-1 md:grid-cols-2 gap-4" }}>
              <FormField
                control={form.control}
                name="rateTypeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rate Type</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(value ? parseInt(value) : undefined)}
                      value={field.value?.toString() || ''}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select rate type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {rateTypes.map((rateType: { id: number; name: string; description?: string; isActive: boolean }) => (
                          <SelectItem key={rateType.id} value={rateType.id.toString()}>
                            {rateType.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="assignedTo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assign To</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || 'unassigned'}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select field agent" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {fieldUsers.map((user: User) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address *</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Enter complete address" rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="pincode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pincode *</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Enter pincode" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="trigger"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Trigger / Instructions</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Special instructions or trigger" rows={2} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateTaskMutation.isPending}>
                {updateTaskMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
