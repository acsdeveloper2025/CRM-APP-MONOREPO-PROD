import React from 'react';
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
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateVerificationTasks } from '@/hooks/useVerificationTasks';
import { useVerificationTypes } from '@/hooks/useClients';
import { toast } from 'sonner';

const addTaskSchema = z.object({
  verification_type_id: z.string().min(1, 'Verification type is required'),
  task_title: z.string().min(1, 'Task title is required'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  address: z.string().min(1, 'Address is required'),
  pincode: z.string().min(1, 'Pincode is required'),
  trigger: z.string().optional(),
  applicant_type: z.string().optional(),
});

type AddTaskFormData = z.infer<typeof addTaskSchema>;

interface AddTaskDialogProps {
  isOpen: boolean;
  onClose: () => void;
  caseId: string;
  onSuccess: () => void;
}

export const AddTaskDialog: React.FC<AddTaskDialogProps> = ({
  isOpen,
  onClose,
  caseId,
  onSuccess,
}) => {
  const createTasksMutation = useCreateVerificationTasks(caseId);
  const { data: verificationTypesResponse } = useVerificationTypes();
  const verificationTypes = verificationTypesResponse?.data || [];

  const form = useForm<AddTaskFormData>({
    resolver: zodResolver(addTaskSchema),
    defaultValues: {
      verification_type_id: '',
      task_title: '',
      priority: 'MEDIUM',
      address: '',
      pincode: '',
      trigger: '',
      applicant_type: 'APPLICANT',
    },
  });

  const handleSubmit = async (data: AddTaskFormData) => {
    try {
      // The API expects an array of tasks
      await createTasksMutation.mutateAsync({
        tasks: [{
          ...data,
          verification_type_id: parseInt(data.verification_type_id),
        }]
      });
      toast.success('Task added successfully');
      form.reset();
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Failed to add task:', error);
      toast.error('Failed to add task');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Add New Verification Task</DialogTitle>
          <DialogDescription>
            Add a new verification task to this case.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="verification_type_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Verification Type *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {verificationTypes.map((type) => (
                        <SelectItem key={type.id} value={type.id.toString()}>
                          {type.name}
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
              name="task_title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Task Title *</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g. Office Verification" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                name="applicant_type"
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
              <Button type="submit" disabled={createTasksMutation.isPending}>
                {createTasksMutation.isPending ? 'Adding...' : 'Add Task'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
