import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useFieldUsers } from '@/hooks/useUsers';
import { useClients, useVerificationTypes } from '@/hooks/useClients';
import { Save, Send, Loader2 } from 'lucide-react';
import type { CreateCaseData } from '@/services/cases';

const newCaseSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be less than 200 characters'),
  description: z.string().min(1, 'Description is required').max(1000, 'Description must be less than 1000 characters'),
  customerName: z.string().min(1, 'Customer name is required').max(100, 'Customer name must be less than 100 characters'),
  customerPhone: z.string().optional(),
  customerEmail: z.string().email('Invalid email format').optional().or(z.literal('')),
  addressStreet: z.string().min(1, 'Street address is required').max(200, 'Street address must be less than 200 characters'),
  addressCity: z.string().min(1, 'City is required').max(100, 'City must be less than 100 characters'),
  addressState: z.string().min(1, 'State is required').max(100, 'State must be less than 100 characters'),
  addressPincode: z.string().min(1, 'Pincode is required').regex(/^\d{6}$/, 'Pincode must be 6 digits'),
  verificationType: z.string().min(1, 'Verification type is required'),
  verificationTypeId: z.string().optional(),
  assignedToId: z.string().min(1, 'Field user assignment is required'),
  clientId: z.string().min(1, 'Client selection is required'),
  priority: z.number().min(1).max(5).default(2),
  notes: z.string().optional(),
});

type NewCaseFormData = z.infer<typeof newCaseSchema>;

interface NewCaseFormProps {
  onSubmit: (data: CreateCaseData) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export const NewCaseForm: React.FC<NewCaseFormProps> = ({
  onSubmit,
  onCancel,
  isSubmitting = false,
}) => {
  const { data: fieldUsers, isLoading: loadingUsers } = useFieldUsers();
  const { data: clientsData, isLoading: loadingClients } = useClients();
  const { data: verificationTypesData, isLoading: loadingVerificationTypes } = useVerificationTypes();

  const clients = clientsData?.data || [];
  const verificationTypes = verificationTypesData?.data || [];

  const form = useForm<NewCaseFormData>({
    resolver: zodResolver(newCaseSchema),
    defaultValues: {
      title: '',
      description: '',
      customerName: '',
      customerPhone: '',
      customerEmail: '',
      addressStreet: '',
      addressCity: '',
      addressState: '',
      addressPincode: '',
      verificationType: undefined,
      verificationTypeId: undefined,
      assignedToId: undefined,
      clientId: undefined,
      priority: 2,
      notes: '',
    },
  });

  const handleSubmit = (data: NewCaseFormData) => {
    onSubmit(data);
  };

  const verificationTypeOptions = [
    { value: 'RESIDENCE', label: 'Residence Verification' },
    { value: 'OFFICE', label: 'Office Verification' },
    { value: 'BUSINESS', label: 'Business Verification' },
    { value: 'OTHER', label: 'Other Verification' },
  ];

  const priorityOptions = [
    { value: 1, label: 'Low (1)' },
    { value: 2, label: 'Normal (2)' },
    { value: 3, label: 'Medium (3)' },
    { value: 4, label: 'High (4)' },
    { value: 5, label: 'Critical (5)' },
  ];

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* Case Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-foreground">Case Information</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Case Title *</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter case title" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="verificationType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Verification Type *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select verification type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {verificationTypeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
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
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description *</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="Enter case description and requirements"
                    className="min-h-[100px]"
                    {...field} 
                  />
                </FormControl>
                <FormDescription>
                  Provide detailed information about what needs to be verified
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Customer Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-foreground">Customer Information</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField
              control={form.control}
              name="customerName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter customer name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="customerPhone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter phone number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="customerEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter email address" type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Address Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-foreground">Address Information</h3>
          
          <FormField
            control={form.control}
            name="addressStreet"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Street Address *</FormLabel>
                <FormControl>
                  <Input placeholder="Enter street address" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField
              control={form.control}
              name="addressCity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>City *</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter city" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="addressState"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>State *</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter state" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="addressPincode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pincode *</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter 6-digit pincode" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Assignment Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-foreground">Assignment Information</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField
              control={form.control}
              name="assignedToId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assign to Field User *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select field user" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {loadingUsers ? (
                        <SelectItem value="loading" disabled>Loading users...</SelectItem>
                      ) : (
                        fieldUsers?.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.name} ({user.username})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="clientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Client *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select client" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {loadingClients ? (
                        <SelectItem value="loading" disabled>Loading clients...</SelectItem>
                      ) : (
                        clients.map((client) => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.name} ({client.code})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Priority Level</FormLabel>
                  <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value.toString()}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {priorityOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value.toString()}>
                          {option.label}
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
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Special Instructions / Notes</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="Enter any special instructions or notes for the field user"
                    className="min-h-[80px]"
                    {...field} 
                  />
                </FormControl>
                <FormDescription>
                  Optional: Add any specific instructions or important notes for the field user
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Form Actions */}
        <div className="flex items-center justify-end space-x-4 pt-6 border-t">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating Case...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Create & Assign Case
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
};
