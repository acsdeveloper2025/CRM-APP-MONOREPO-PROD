import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowLeft,
  Save,
  Plus,
  MoreHorizontal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { toast } from 'sonner';
import { useCase, useUpdateCase } from '@/hooks/useCases';
import { useVerificationTasks } from '@/hooks/useVerificationTasks';
import { useClients, useProductsByClient } from '@/hooks/useClients';
import { LoadingState } from '@/components/ui/loading';
import { EditTaskDialog } from '@/components/cases/EditTaskDialog';
import { AddTaskDialog } from '@/components/cases/AddTaskDialog';
import type { VerificationTask } from '@/types/verificationTask';
import type { Client } from '@/types/client';

// Schema for case details
const caseDetailsSchema = z.object({
  customerName: z.string().min(1, 'Customer name is required'),
  customerPhone: z.string().min(10, 'Valid phone number is required'),
  clientId: z.string().min(1, 'Client is required'),
  productId: z.string().min(1, 'Product is required'),
  backendContactNumber: z.string().optional(),
});

type CaseDetailsFormData = z.infer<typeof caseDetailsSchema>;

export const EditCasePage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = React.useState('tasks');
  const [selectedTask, setSelectedTask] = React.useState<VerificationTask | null>(null);
  const [isEditTaskOpen, setIsEditTaskOpen] = React.useState(false);
  const [isAddTaskOpen, setIsAddTaskOpen] = React.useState(false);

  // Data fetching
  const { data: caseData, isLoading: loadingCase } = useCase(id || '');
  const { data: tasksData, isLoading: loadingTasks, refetch: refetchTasks } = useVerificationTasks(id || '');
  const { data: clients } = useClients();
  
    const caseItem = caseData?.data;
    const tasks = tasksData?.tasks || [];

  const { data: products } = useProductsByClient(
    caseItem?.clientId ? caseItem.clientId.toString() : ''
  );

  // Mutations
  const updateCaseMutation = useUpdateCase();

  const form = useForm<CaseDetailsFormData>({
    resolver: zodResolver(caseDetailsSchema),
  });

  // Initialize form with case data
  useEffect(() => {
    if (caseItem) {
      form.reset({
        customerName: caseItem.customerName || '',
        customerPhone: caseItem.customerPhone || '',
        clientId: caseItem.clientId?.toString() || '',
        productId: caseItem.productId?.toString() || '',
        backendContactNumber: caseItem.backendContactNumber || '',
      });
    }
  }, [caseItem, form]);

  const handleSaveCaseDetails = async (data: CaseDetailsFormData) => {
    try {
      await updateCaseMutation.mutateAsync({
        id: id || '',
        data: {
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          clientId: parseInt(data.clientId),
          productId: parseInt(data.productId),
          backendContactNumber: data.backendContactNumber,
        },
      });
      toast.success('Case details updated successfully');
    } catch (_error) {
      toast.error('Failed to update case details');
    }
  };

  const handleEditTask = (task: VerificationTask) => {
    setSelectedTask(task);
    setIsEditTaskOpen(true);
  };

  if (loadingCase || loadingTasks) {
    return <LoadingState message="Loading case details..." />;
  }

  if (!caseItem) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-bold">Case not found</h2>
        <Button onClick={() => navigate('/cases')} className="mt-4">
          Back to Cases
        </Button>
      </div>
    );
  }

  // Prevent editing completed cases ONLY if there are no pending/in-progress tasks
  // This handles cases where the status might be cached but revisit tasks exist
  const hasPendingTasks = (caseItem.pendingTasks || 0) > 0 || (caseItem.inProgressTasks || 0) > 0;
  const isCompleted = caseItem.status === 'COMPLETED' && !hasPendingTasks;
  
  if (isCompleted) {
    return (
      <div className="text-center py-12">
        <div className="max-w-md mx-auto">
          <div className="mb-4">
            <Badge className="bg-green-100 text-green-800 text-lg px-4 py-2">
              COMPLETED
            </Badge>
          </div>
          <h2 className="text-xl font-bold mb-2">Cannot Edit Completed Case</h2>
          <p className="text-gray-600 mb-6">
            This case has been marked as completed and can no longer be edited.
            If you need to make changes, please contact your administrator.
          </p>
          <div className="flex gap-2 justify-center">
            <Button onClick={() => navigate(-1)} variant="outline">
              Go Back
            </Button>
            <Button onClick={() => navigate(`/cases/${id}`)}>
              View Case Details
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Edit Case #{caseItem.caseNumber}</h1>
            <p className="text-sm text-muted-foreground">
              Manage case details and verification tasks
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button onClick={() => setIsAddTaskOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Task
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="details">Case Details</TabsTrigger>
          <TabsTrigger value="tasks">Verification Tasks ({tasks.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <Card>
            <CardHeader>
              <CardTitle>Case Information</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={form.handleSubmit(handleSaveCaseDetails)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Customer Name</Label>
                    <Input {...form.register('customerName')} />
                    {form.formState.errors.customerName && (
                      <p className="text-sm text-red-500">{form.formState.errors.customerName.message}</p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Phone Number</Label>
                    <Input {...form.register('customerPhone')} />
                    {form.formState.errors.customerPhone && (
                      <p className="text-sm text-red-500">{form.formState.errors.customerPhone.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Client</Label>
                    <Select
                      value={form.watch('clientId')}
                      onValueChange={(value) => form.setValue('clientId', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select client" />
                      </SelectTrigger>
                      <SelectContent>
                        {clients?.data?.map((client: Client) => (
                          <SelectItem key={client.id} value={client.id.toString()}>
                            {client.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Product</Label>
                    <Select
                      value={form.watch('productId')}
                      onValueChange={(value) => form.setValue('productId', value)}
                      disabled={!form.watch('clientId')}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select product" />
                      </SelectTrigger>
                      <SelectContent>
                        {products?.data?.map((product) => (
                          <SelectItem key={product.id} value={product.id.toString()}>
                            {product.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Backend Contact Number</Label>
                    <Input {...form.register('backendContactNumber')} />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button type="submit" disabled={form.formState.isSubmitting}>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks">
          <Card>
            <CardHeader>
              <CardTitle>Verification Tasks</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {tasks.map((task: VerificationTask) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium">{task.taskTitle}</span>
                        <Badge variant="outline">{task.verificationTypeName}</Badge>
                        <Badge className={
                          task.priority === 'URGENT' ? 'bg-red-100 text-red-800' :
                          task.priority === 'HIGH' ? 'bg-orange-100 text-orange-800' :
                          'bg-blue-100 text-blue-800'
                        }>
                          {task.priority}
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-500">
                        {task.address || 'No address provided'}
                      </div>
                      <div className="text-xs text-gray-400">
                        Assigned To: {task.assignedToName || 'Unassigned'}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => handleEditTask(task)}>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </div>
                ))}

                {tasks.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No verification tasks found.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {selectedTask && (
        <EditTaskDialog
          isOpen={isEditTaskOpen}
          onClose={() => setIsEditTaskOpen(false)}
          task={selectedTask}
          onSuccess={refetchTasks}
        />
      )}

      <AddTaskDialog
        isOpen={isAddTaskOpen}
        onClose={() => setIsAddTaskOpen(false)}
        caseId={id || ''}
        onSuccess={refetchTasks}
      />
    </div>
  );
};
