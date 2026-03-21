import React from 'react';
import { addDays } from 'date-fns';
import { AxiosError } from 'axios';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { clientsService } from '@/services/clients';
import { reportsService } from '@/services/reports';
import { Button } from '@/ui/components/Button';
import { DatePickerWithRange } from '@/ui/components/DateRangePicker';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/ui/components/Dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/ui/components/Form';
import { Input } from '@/ui/components/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/components/Select';
import { Textarea } from '@/ui/components/Textarea';
import { Box } from '@/ui/primitives/Box';
import { Stack } from '@/ui/primitives/Stack';

const generateReportSchema = z.object({
  reportType: z.string().min(1, 'Report type is required'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  format: z.enum(['PDF', 'EXCEL', 'CSV']),
  clientId: z.string().optional(),
  userId: z.string().optional(),
});

type GenerateReportFormData = z.infer<typeof generateReportSchema>;

interface GenerateReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GenerateReportDialog({ open, onOpenChange }: GenerateReportDialogProps) {
  const [dateRange, setDateRange] = React.useState<{ from: Date; to: Date }>({
    from: addDays(new Date(), -30),
    to: new Date(),
  });
  const queryClient = useQueryClient();

  const form = useForm<GenerateReportFormData>({
    resolver: zodResolver(generateReportSchema),
    defaultValues: {
      reportType: '',
      title: '',
      description: '',
      format: 'PDF',
      clientId: 'all',
      userId: 'all',
    },
  });

  const { data: clientsData } = useQuery({
    queryKey: ['clients'],
    queryFn: () => clientsService.getClients(),
    enabled: open,
  });

  const generateMutation = useMutation({
    mutationFn: (data: GenerateReportFormData) => {
      const reportData = {
        ...data,
        filters: {
          dateFrom: dateRange.from.toISOString().split('T')[0],
          dateTo: dateRange.to.toISOString().split('T')[0],
          clientId: data.clientId || undefined,
          userId: data.userId || undefined,
        },
      };
      return reportsService.generateMISReport(reportData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mis-reports'] });
      toast.success('Report generated successfully');
      form.reset();
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      const message =
        error instanceof AxiosError
          ? error.response?.data?.message || error.message
          : 'Failed to generate report';
      toast.error(message);
    },
  });

  const reportTypes = [
    { value: 'TURNAROUND_TIME', label: 'Turnaround Time Report' },
    { value: 'COMPLETION_RATE', label: 'Completion Rate Report' },
    { value: 'PRODUCTIVITY', label: 'Productivity Report' },
    { value: 'QUALITY', label: 'Quality Report' },
    { value: 'FINANCIAL', label: 'Financial Report' },
  ];

  const clients = clientsData?.data || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ width: 'min(95vw, 32rem)' }}>
        <DialogHeader>
          <DialogTitle>Generate MIS Report</DialogTitle>
          <DialogDescription>
            Generate a comprehensive MIS report with custom filters and parameters.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => generateMutation.mutate(data))}>
            <Stack gap={4}>
              <FormField
                control={form.control}
                name="reportType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Report Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select report type" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {reportTypes.map((type) => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Report Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter report title" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Enter report description" style={{ resize: 'vertical' }} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Stack gap={2}>
                <FormLabel>Date Range</FormLabel>
                <DatePickerWithRange date={dateRange} onDateChange={setDateRange} />
              </Stack>

              <FormField
                control={form.control}
                name="clientId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client Filter (Optional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="All clients" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="all">All Clients</SelectItem>
                        {clients.map((client) => <SelectItem key={client.id} value={client.id.toString()}>{client.name} ({client.code})</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="format"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Output Format</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select format" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="PDF">PDF</SelectItem>
                        <SelectItem value="EXCEL">Excel</SelectItem>
                        <SelectItem value="CSV">CSV</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>Choose the format for the generated report</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Box style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', flexWrap: 'wrap', paddingTop: '0.5rem' }}>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={generateMutation.isPending}>
                  Cancel
                </Button>
                <Button type="submit" disabled={generateMutation.isPending}>
                  {generateMutation.isPending ? 'Generating...' : 'Generate Report'}
                </Button>
              </Box>
            </Stack>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
