import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { reportsService } from '@/services/reports';
import { clientsService } from '@/services/clients';
import { casesService } from '@/services/cases';

const createBankBillSchema = z.object({
  clientId: z.string().min(1, 'Client selection is required'),
  bankName: z.string().min(1, 'Bank name is required'),
  billDate: z.string().min(1, 'Bill date is required'),
  dueDate: z.string().min(1, 'Due date is required'),
  caseIds: z.array(z.string()).min(1, 'At least one case must be selected'),
});

type CreateBankBillFormData = z.infer<typeof createBankBillSchema>;

interface CreateBankBillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateBankBillDialog({ open, onOpenChange }: CreateBankBillDialogProps) {
  const [selectedClient, setSelectedClient] = useState<string>('');
  const queryClient = useQueryClient();

  const form = useForm<CreateBankBillFormData>({
    resolver: zodResolver(createBankBillSchema),
    defaultValues: {
      clientId: '',
      bankName: '',
      billDate: '',
      dueDate: '',
      caseIds: [],
    },
  });

  // Fetch clients for dropdown
  const { data: clientsData } = useQuery({
    queryKey: ['clients'],
    queryFn: () => clientsService.getClients(),
    enabled: open,
  });

  // Fetch completed cases for selected client
  const { data: casesData } = useQuery({
    queryKey: ['completed-cases', selectedClient],
    queryFn: () => casesService.getCases({
      clientId: selectedClient,
      status: 'COMPLETED',
      limit: 100,
    }),
    enabled: open && !!selectedClient,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateBankBillFormData) => reportsService.createBankBill(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-bills'] });
      toast.success('Bank bill created successfully');
      form.reset();
      setSelectedClient('');
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create bank bill');
    },
  });

  const onSubmit = (data: CreateBankBillFormData) => {
    createMutation.mutate(data);
  };

  const handleClientChange = (clientId: string) => {
    setSelectedClient(clientId);
    form.setValue('clientId', clientId);
    form.setValue('caseIds', []); // Reset selected cases when client changes
  };

  const handleCaseSelection = (caseId: string, checked: boolean) => {
    const currentCases = form.getValues('caseIds');
    if (checked) {
      form.setValue('caseIds', [...currentCases, caseId]);
    } else {
      form.setValue('caseIds', currentCases.filter(id => id !== caseId));
    }
  };

  const clients = clientsData?.data || [];
  const cases = casesData?.data || [];
  const selectedCases = form.watch('caseIds');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Bank Bill</DialogTitle>
          <DialogDescription>
            Create a new bank bill for completed cases from a specific client.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="clientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Client</FormLabel>
                  <Select onValueChange={handleClientChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a client" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          <div className="flex flex-col">
                            <span>{client.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {client.code}
                            </span>
                          </div>
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
              name="bankName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bank Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter bank name" {...field} />
                  </FormControl>
                  <FormDescription>
                    The name of the bank this bill is for
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="billDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bill Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {selectedClient && (
              <FormField
                control={form.control}
                name="caseIds"
                render={() => (
                  <FormItem>
                    <FormLabel>Select Cases</FormLabel>
                    <FormDescription>
                      Choose completed cases to include in this bank bill
                    </FormDescription>
                    <div className="max-h-48 overflow-y-auto border rounded-md p-3 space-y-2">
                      {cases.length > 0 ? (
                        cases.map((case_) => (
                          <div key={case_.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={case_.id}
                              checked={selectedCases.includes(case_.id)}
                              onCheckedChange={(checked) => 
                                handleCaseSelection(case_.id, checked as boolean)
                              }
                            />
                            <label
                              htmlFor={case_.id}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex-1"
                            >
                              <div>
                                <div className="font-medium">{case_.title}</div>
                                <div className="text-xs text-muted-foreground">
                                  {case_.customerName} • Completed: {new Date(case_.completedAt || '').toLocaleDateString()}
                                </div>
                              </div>
                            </label>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No completed cases found for this client
                        </p>
                      )}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || !selectedClient}
              >
                {createMutation.isPending ? 'Creating...' : 'Create Bank Bill'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
