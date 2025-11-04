import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Form,
  FormControl,
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
import { ArrowLeft, Send, Loader2, User, MapPin, Building2, CreditCard, AlertCircle, Plus, Trash2 } from 'lucide-react';
import { useFieldUsers } from '@/hooks/useUsers';
import { useClients, useVerificationTypes, useProductsByClient } from '@/hooks/useClients';
import { usePincodes } from '@/hooks/useLocations';
import { useAreasByPincode } from '@/hooks/useAreas';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { rateTypesService } from '@/services/rateTypes';
import { EnhancedCasesService } from '@/services/verificationTasks';
import type { CustomerInfoData } from './CustomerInfoStep';
import type { CreateCaseWithMultipleTasksRequest, CreateVerificationTaskRequest } from '@/types/verificationTask';
import toast from 'react-hot-toast';

// Task Area Select Component
const TaskAreaSelect: React.FC<{
  task: TaskFormData;
  updateTask: (taskId: string, field: keyof TaskFormData, value: any) => void;
}> = ({ task, updateTask }) => {
  const { data: areasResponse } = useAreasByPincode(task.pincode ? parseInt(task.pincode) : undefined);
  const areas = areasResponse?.data || [];

  return (
    <div>
      <label className="text-sm font-medium">Area *</label>
      <Select
        value={task.areaId || ''}
        onValueChange={(value) => updateTask(task.id, 'areaId', value)}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select area" />
        </SelectTrigger>
        <SelectContent>
          {areas.map((area) => (
            <SelectItem key={area.id} value={area.id.toString()}>
              {area.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {!task.areaId && (
        <p className="text-sm text-red-600 mt-1">
          <AlertCircle className="h-3 w-3 inline mr-1" />
          Area is required
        </p>
      )}
    </div>
  );
};

// Task Rate Type Select Component
const TaskRateTypeSelect: React.FC<{
  task: TaskFormData;
  updateTask: (taskId: string, field: keyof TaskFormData, value: any) => void;
  clientId: string;
  productId: string;
}> = ({ task, updateTask, clientId, productId }) => {
  const { data: rateTypesResponse } = useQuery({
    queryKey: ['availableRateTypes', clientId, productId, task.verificationTypeId],
    queryFn: () => rateTypesService.getAvailableRateTypesForCase(
      parseInt(clientId),
      parseInt(productId),
      task.verificationTypeId!
    ),
    enabled: !!(clientId && productId && task.verificationTypeId),
  });

  const rateTypes = rateTypesResponse?.data || [];

  return (
    <div>
      <label className="text-sm font-medium">Rate Type *</label>
      <Select
        value={task.rateTypeId || ''}
        onValueChange={(value) => updateTask(task.id, 'rateTypeId', value)}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select rate type" />
        </SelectTrigger>
        <SelectContent>
          {rateTypes.map((rateType) => (
            <SelectItem key={rateType.id} value={rateType.id.toString()}>
              {rateType.name} - {rateType.description} ₹{rateType.amount}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {!task.rateTypeId && (
        <p className="text-sm text-red-600 mt-1">
          <AlertCircle className="h-3 w-3 inline mr-1" />
          Rate type is required
        </p>
      )}
      {task.rateTypeId && (
        <p className="text-sm text-green-600 mt-1">
          Rate: ₹{rateTypes.find(rt => rt.id.toString() === task.rateTypeId)?.amount || '0.00'} INR
        </p>
      )}
    </div>
  );
};

// Case details schema
const caseDetailsSchema = z.object({
  // Client Information
  clientId: z.string().min(1, 'Client selection is required'),
  productId: z.string().min(1, 'Product selection is required'),

  // Assignment Information
  createdByBackendUser: z.string().min(1, 'Created by backend user is required'),
  backendContactNumber: z.string().min(1, 'Backend contact number is required').regex(/^[+]?[\d\s\-\(\)]{10,15}$/, 'Please enter a valid phone number'),
});

// Task schema
const taskSchema = z.object({
  verificationTypeId: z.number().min(1, 'Verification type is required'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  assignedTo: z.string().optional(),
  rateTypeId: z.string().min(1, 'Rate type is required'),
  address: z.string().optional(),
  pincode: z.string().min(1, 'Pincode is required'),
  areaId: z.string().min(1, 'Area is required'),
  applicantType: z.string().min(1, 'Applicant type is required'),
  trigger: z.string().min(1, 'Trigger is required'),
  documentType: z.string().optional(),
  documentNumber: z.string().optional(),
});

const formSchema = z.object({
  caseDetails: caseDetailsSchema,
  // verificationTasks are managed separately in state, not in the form
  // verificationTasks: z.array(taskSchema).min(1, 'At least one verification task is required'),
});

type FormData = z.infer<typeof formSchema>;

interface TaskFormData {
  id: string;
  verificationTypeId: number | null;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  assignedTo?: string;
  rateTypeId?: string;
  address?: string;
  pincode?: string;
  areaId?: string;
  applicantType?: string;
  trigger?: string;
  documentType?: string;
  documentNumber?: string;
}

interface CaseWithTasksCreationFormProps {
  customerInfo: CustomerInfoData;
  onSubmit: (caseId: string) => void;
  onBack?: () => void;
  isSubmitting?: boolean;
  initialData?: Partial<FormData>;
}

export const CaseWithTasksCreationForm: React.FC<CaseWithTasksCreationFormProps> = ({
  customerInfo,
  onSubmit,
  onBack,
  isSubmitting = false,
  initialData = {},
}) => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<TaskFormData[]>([
    {
      id: '1',
      verificationTypeId: null,
      priority: 'MEDIUM',
      assignedTo: 'unassigned',
      rateTypeId: '',
      address: '',
      pincode: '',
      areaId: '',
      applicantType: '',
      trigger: '',
      documentType: '',
      documentNumber: '',
    }
  ]);

  // Data hooks
  const { data: fieldUsers, isLoading: loadingUsers } = useFieldUsers();
  const { data: clientsResponse, isLoading: loadingClients } = useClients();
  const { data: verificationTypesResponse, isLoading: loadingVerificationTypes } = useVerificationTypes();
  // Fetch all pincodes for dropdown (high limit to get all)
  const { data: pincodesResponse, isLoading: loadingPincodes } = usePincodes({ limit: 10000 });

  // Form setup
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      caseDetails: {
        clientId: '',
        productId: '',
        createdByBackendUser: user?.id || '',
        backendContactNumber: '',
        ...initialData.caseDetails,
      },
      // verificationTasks are managed separately in the tasks state
    },
  });

  // Watch for client selection to fetch products
  const selectedClientId = form.watch('caseDetails.clientId');
  const selectedProductId = form.watch('caseDetails.productId');
  const { data: productsResponse } = useProductsByClient(selectedClientId ? parseInt(selectedClientId) : undefined);

  // Areas will be loaded dynamically based on task pincode selection

  // Rate types will be loaded per task based on verification type

  // Extract data from responses
  const clients = clientsResponse?.data || [];
  const verificationTypes = verificationTypesResponse?.data || [];
  const products = productsResponse?.data || [];
  const pincodes = pincodesResponse?.data || [];
  const users = fieldUsers || []; // fieldUsers is already the array from the select function

  // Helper function to get user display name
  const getUserDisplayName = (user: any) => {
    if (!user) return '';
    if (user.name && typeof user.name === 'string' && user.name.trim()) {
      return user.name;
    }
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`.trim();
    }
    if (user.firstName) {
      return user.firstName;
    }
    return user.username || user.email || 'Unknown User';
  };

  // Task management functions
  const updateTask = (taskId: string, field: keyof TaskFormData, value: any) => {
    console.log('📝 updateTask called:', {
      taskId,
      field,
      value,
      valueType: typeof value,
      valueRepr: `${typeof value}:${JSON.stringify(value)}`
    });
    setTasks(tasks.map(task => {
      if (task.id === taskId) {
        const updated = { ...task, [field]: value };
        console.log('✅ Task updated:', {
          taskId,
          field,
          oldValue: task[field],
          newValue: value,
          valueType: typeof value,
          valueRepr: `${typeof value}:${JSON.stringify(value)}`,
          updatedPincode: updated.pincode,
          updatedPincodeType: typeof updated.pincode
        });
        return updated;
      }
      return task;
    }));
  };

  const addTask = () => {
    const newTask: TaskFormData = {
      id: Date.now().toString(),
      verificationTypeId: null,
      priority: 'MEDIUM',
      assignedTo: 'unassigned',
      rateTypeId: '',
      address: '',
      pincode: '',
      areaId: '',
      applicantType: '',
      trigger: '',
      documentType: '',
      documentNumber: '',
    };
    setTasks([...tasks, newTask]);
  };

  const removeTask = (taskId: string) => {
    if (tasks.length > 1) {
      setTasks(tasks.filter(task => task.id !== taskId));
    }
  };

  // Form submission
  const handleSubmit = async (data: FormData) => {
    try {
      // Validate tasks
      const validTasks = tasks.filter(task =>
        task.verificationTypeId &&
        task.rateTypeId &&
        task.pincode &&
        task.areaId &&
        task.applicantType &&
        task.trigger
      );

      if (validTasks.length === 0) {
        toast.error('Please fill in all required fields for at least one task');
        return;
      }

      // Prepare case data
      const caseData: CreateCaseWithMultipleTasksRequest = {
        case_details: {
          customerName: customerInfo.customerName,
          customerPhone: customerInfo.customerPhone,
          customerCallingCode: customerInfo.customerCallingCode,
          customerEmail: customerInfo.customerEmail,
          clientId: parseInt(data.caseDetails.clientId),
          productId: parseInt(data.caseDetails.productId),
          backendContactNumber: data.caseDetails.backendContactNumber,
        },
        verification_tasks: validTasks.map((task, index) => {
          // Get verification type name for task title
          const verificationType = verificationTypes.find(vt => vt.id === task.verificationTypeId);
          const taskTitle = `${verificationType?.name || 'Verification'} - Task ${index + 1}`;

          return {
            verification_type_id: task.verificationTypeId!,
            task_title: taskTitle,
            priority: task.priority,
            assigned_to: task.assignedTo && task.assignedTo !== 'unassigned' ? task.assignedTo : undefined,
            rate_type_id: parseInt(task.rateTypeId!),
            address: task.address || undefined,
            pincode: task.pincode!,
            area_id: parseInt(task.areaId!),
            applicant_type: task.applicantType!,
            trigger: task.trigger!,
            document_type: task.documentType || undefined,
            document_number: task.documentNumber || undefined,
          };
        }),
      };

      // Create case with tasks
      const result = await EnhancedCasesService.createCaseWithMultipleTasks(caseData);

      if (result.success) {
        toast.success(`Case created successfully with ${validTasks.length} verification task${validTasks.length > 1 ? 's' : ''}`);
        onSubmit(result.data.case.id);
      }
    } catch (error: any) {
      console.error('Error creating case with tasks:', error);
      toast.error(error.response?.data?.message || 'Failed to create case with tasks');
    }
  };

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          {/* Case Details Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Case Details
              </CardTitle>
              <CardDescription>
                Basic information about the case and customer
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Customer Info Display */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-sm font-medium">Customer Name</p>
                  <p className="text-sm text-gray-600">{customerInfo.customerName}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Phone</p>
                  <p className="text-sm text-gray-600">
                    {customerInfo.customerCallingCode} {customerInfo.customerPhone}
                  </p>
                </div>
                {customerInfo.customerEmail && (
                  <div>
                    <p className="text-sm font-medium">Email</p>
                    <p className="text-sm text-gray-600">{customerInfo.customerEmail}</p>
                  </div>
                )}
              </div>

              {/* Case Form Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Client Selection */}
                <FormField
                  control={form.control}
                  name="caseDetails.clientId"
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
                          {clients.map((client) => (
                            <SelectItem key={client.id} value={client.id.toString()}>
                              {client.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Product Selection */}
                <FormField
                  control={form.control}
                  name="caseDetails.productId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Product *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select product" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {products.map((product) => (
                            <SelectItem key={product.id} value={product.id.toString()}>
                              {product.name}
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
                name="caseDetails.backendContactNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Backend Contact Number *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter contact number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Verification Tasks Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Verification Tasks
                <Badge variant="secondary">{tasks.length}</Badge>
              </CardTitle>
              <CardDescription>
                Define the verification tasks that need to be completed for this case
              </CardDescription>
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addTask}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Task
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {tasks.map((task, index) => (
                <Card key={task.id} className="border-l-4 border-l-blue-500">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">Task {index + 1}</CardTitle>
                      {tasks.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeTask(task.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Task Fields in Required Order: Applicant Type, Verification Type, Rate Type, Pincode, Area, Trigger, Priority */}

                    {/* Row 1: Applicant Type & Verification Type */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium">Applicant Type *</label>
                        <Select
                          value={task.applicantType || ''}
                          onValueChange={(value) => updateTask(task.id, 'applicantType', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select applicant type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="APPLICANT">Applicant</SelectItem>
                            <SelectItem value="REFERENCE">Reference</SelectItem>
                            <SelectItem value="GUARANTOR">Guarantor</SelectItem>
                          </SelectContent>
                        </Select>
                        {!task.applicantType && (
                          <p className="text-sm text-red-600 mt-1">
                            <AlertCircle className="h-3 w-3 inline mr-1" />
                            Applicant type is required
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="text-sm font-medium">Verification Type *</label>
                        <Select
                          value={task.verificationTypeId?.toString() || ''}
                          onValueChange={(value) => updateTask(task.id, 'verificationTypeId', parseInt(value))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select verification type" />
                          </SelectTrigger>
                          <SelectContent>
                            {verificationTypes.map((type) => (
                              <SelectItem key={type.id} value={type.id.toString()}>
                                {type.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {!task.verificationTypeId && (
                          <p className="text-sm text-red-600 mt-1">
                            <AlertCircle className="h-3 w-3 inline mr-1" />
                            Verification type is required
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Row 2: Rate Type */}
                    <TaskRateTypeSelect
                      task={task}
                      updateTask={updateTask}
                      clientId={selectedClientId}
                      productId={selectedProductId}
                    />

                    {/* Row 3: Pincode & Area */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium">Pincode *</label>
                        <Select
                          value={task.pincode || ''}
                          onValueChange={(value) => {
                            console.log('🔍 Pincode onValueChange called:', { taskId: task.id, value, valueType: typeof value, currentPincode: task.pincode });
                            // Force state update by creating new tasks array
                            setTasks(prevTasks => prevTasks.map(t =>
                              t.id === task.id
                                ? { ...t, pincode: String(value), areaId: '' }
                                : t
                            ));
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select pincode">
                              {task.pincode ? pincodes.find(p => p.id.toString() === task.pincode)?.code : 'Select pincode'}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {pincodes.map((pincode) => (
                              <SelectItem key={pincode.id} value={pincode.id.toString()}>
                                {pincode.code}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {!task.pincode && (
                          <p className="text-sm text-red-600 mt-1">
                            <AlertCircle className="h-3 w-3 inline mr-1" />
                            Pincode is required
                          </p>
                        )}
                      </div>

                      <TaskAreaSelect
                        task={task}
                        updateTask={updateTask}
                      />
                    </div>

                    {/* Row 4: Trigger & Priority */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium">Trigger *</label>
                        <Input
                          placeholder="Enter trigger"
                          value={task.trigger || ''}
                          onChange={(e) => updateTask(task.id, 'trigger', e.target.value)}
                        />
                        {!task.trigger && (
                          <p className="text-sm text-red-600 mt-1">
                            <AlertCircle className="h-3 w-3 inline mr-1" />
                            Trigger is required
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="text-sm font-medium">Priority *</label>
                        <Select
                          value={task.priority}
                          onValueChange={(value) => updateTask(task.id, 'priority', value as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT')}
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
                    </div>

                    {/* Optional Fields */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium">Assign To</label>
                        <Select
                          value={task.assignedTo || 'unassigned'}
                          onValueChange={(value) => updateTask(task.id, 'assignedTo', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select field user" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unassigned">Unassigned</SelectItem>
                            {users.map((user) => (
                              <SelectItem key={user.id} value={user.id}>
                                {getUserDisplayName(user)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <label className="text-sm font-medium">Document Type</label>
                        <Input
                          placeholder="Enter document type (e.g., Aadhaar Card, PAN Card)"
                          value={task.documentType || ''}
                          onChange={(e) => updateTask(task.id, 'documentType', e.target.value)}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium">Task Address</label>
                      <Textarea
                        placeholder="Enter task-specific address (if different from case address)"
                        value={task.address || ''}
                        onChange={(e) => updateTask(task.id, 'address', e.target.value)}
                        className="min-h-[60px]"
                      />
                    </div>


                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>

          {/* Form Actions */}
          <div className="flex items-center justify-between">
            {onBack && (
              <Button type="button" variant="outline" onClick={onBack}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            )}

            <Button
              type="submit"
              disabled={isSubmitting}
              className="ml-auto"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating Case...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Create Case with Tasks
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};
