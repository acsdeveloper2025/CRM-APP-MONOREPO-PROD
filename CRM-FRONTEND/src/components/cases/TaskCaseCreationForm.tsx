import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { ArrowLeft, Send, Loader2, Building, Settings, Plus, Trash2, AlertCircle, Paperclip, Upload, FileText, Image } from 'lucide-react';
import { useAvailableFieldUsers } from '@/hooks/useUsers';
import { useClients, useVerificationTypes, useProductsByClient } from '@/hooks/useClients';
import { usePincodeSearch } from '@/hooks/useLocations';
import { useAreasByPincode } from '@/hooks/useAreas';
import { useAuth } from '@/hooks/useAuth';
import { isBackendScopedUser } from '@/utils/userPermissionProfiles';
import { SearchableSelect } from '@/components/ui/searchable-select';
import type { CustomerInfoData } from './CustomerInfoStep';
import { rateTypesService } from '@/services/rateTypes';
import { casesService } from '@/services/cases';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { CaseFormAttachment } from '@/components/attachments/CaseFormAttachmentsSection';
import { VerificationType } from '@/types/client';
import { Pincode } from '@/types/location';
import type { CaseConfigValidationResult } from '@/types/rateManagement';
import { logger } from '@/utils/logger';

// Case-level schema (fields filled once)
const caseLevelSchema = z.object({
  clientId: z.string().min(1, 'Client selection is required'),
  productId: z.string().min(1, 'Product selection is required'),
  backendContactNumber: z.string().min(1, 'Backend contact number is required').regex(/^[+]?[\d\s\-()]{10,15}$/, 'Please enter a valid phone number'),
  createdByBackendUser: z.string().min(1, 'Created by backend user is required'),
});

export type CaseLevelFormData = z.infer<typeof caseLevelSchema>;

// Task data interface
export interface TaskFormData {
  id: string;
  applicantType: string;
  verificationTypeId: number | null;
  rateTypeId: string;
  pincodeId: string;
  areaId: string;
  address: string;
  trigger: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  assignedTo: string;
  attachments: CaseFormAttachment[];
}

export type CaseType = 'field' | 'kyc' | 'both';

interface TaskCaseCreationFormProps {
  customerInfo: CustomerInfoData;
  onSubmit: (caseLevelData: CaseLevelFormData, tasks: TaskFormData[]) => void;
  onBack?: () => void;
  isSubmitting?: boolean;
  initialData?: {
    caseLevelData?: CaseLevelFormData;
    tasks?: TaskFormData[];
  };
  editMode?: boolean;
  renderAfterTasks?: React.ReactNode;
  caseType: CaseType;
  onCaseTypeChange?: (caseType: CaseType) => void;
}

interface TaskValidationState {
  isReady: boolean;
  isLoading: boolean;
  isValid: boolean;
  message?: string;
}

export const TaskCaseCreationForm: React.FC<TaskCaseCreationFormProps> = ({
  customerInfo,
  onSubmit,
  onBack,
  isSubmitting = false,
  initialData,
  editMode = false,
  renderAfterTasks,
  caseType,
  onCaseTypeChange,
}) => {
  const { user } = useAuth();
  
  // Case-level form
  const form = useForm<CaseLevelFormData>({
    resolver: zodResolver(caseLevelSchema),
    defaultValues: {
      clientId: '',
      productId: '',
      backendContactNumber: '',
      createdByBackendUser: user?.name || '',
    },
  });

  // Task-level state (starts with 1 task)
  const [tasks, setTasks] = useState<TaskFormData[]>([
    {
      id: '1',
      applicantType: '',
      verificationTypeId: null,
      rateTypeId: '',
      pincodeId: '',
      areaId: '',
      address: '',
      trigger: '',
      priority: 'MEDIUM',
      assignedTo: '',
      attachments: [],
    },
  ]);
  const [taskValidationState, setTaskValidationState] = useState<Record<string, TaskValidationState>>({});

  // Populate form with initial data
  useEffect(() => {
    if (initialData) {
      logger.warn('📝 TaskCaseCreationForm - Populating form with initialData', initialData);
      
      if (initialData.caseLevelData) {
        form.reset({
          clientId: initialData.caseLevelData.clientId,
          productId: initialData.caseLevelData.productId,
          backendContactNumber: initialData.caseLevelData.backendContactNumber,
          createdByBackendUser: initialData.caseLevelData.createdByBackendUser,
        });
      }
      if (initialData.tasks && initialData.tasks.length > 0) {
        logger.warn('📝 TaskCaseCreationForm - Setting tasks', initialData.tasks);
        setTasks(initialData.tasks);
        
        // Verify state was set correctly
        setTimeout(() => {
          logger.warn('📝 TaskCaseCreationForm - Tasks state after setTasks', {
            tasksLength: initialData.tasks?.length,
            firstTask: initialData.tasks?.[0],
            rateTypeId: initialData.tasks?.[0]?.rateTypeId,
            assignedTo: initialData.tasks?.[0]?.assignedTo,
          });
        }, 100);
      }
    }
  }, [initialData, form]);

  // Fetch data
  const { data: clientsResponse } = useClients();
  const { data: verificationTypesResponse } = useVerificationTypes();
  // Server-side pincode search (replaces bulk client-side load)
  const { pincodes, setSearchTerm: setPincodeSearch } = usePincodeSearch();

  const allClients = useMemo(() => clientsResponse?.data || [], [clientsResponse?.data]);
  const verificationTypes = useMemo(() => verificationTypesResponse?.data || [], [verificationTypesResponse?.data]);

  // Watch for client selection to fetch products
  const selectedClientId = form.watch('clientId');
  const { data: productsResponse } = useProductsByClient(selectedClientId);
  const allProducts = useMemo(() => productsResponse?.data || [], [productsResponse?.data]);
  const didInitializeClientRef = useRef(false);
  const previousClientIdRef = useRef<string>('');

  // Filter clients and products based on user role and assignments
  const clients = useMemo(() => {
    if (isBackendScopedUser(user) && Array.isArray(user?.assignedClients)) {
      return allClients.filter(client => user.assignedClients?.includes(client.id));
    }
    return allClients;
  }, [allClients, user]);

  const products = useMemo(() => {
    if (isBackendScopedUser(user) && Array.isArray(user?.assignedProducts)) {
      return allProducts.filter(product => user.assignedProducts?.includes(product.id));
    }
    return allProducts;
  }, [allProducts, user]);

  // Reset product when client changes
  useEffect(() => {
    if (!didInitializeClientRef.current) {
      didInitializeClientRef.current = true;
      previousClientIdRef.current = selectedClientId;
      return;
    }
    if (previousClientIdRef.current && selectedClientId !== previousClientIdRef.current) {
      form.setValue('productId', '');
    }
    previousClientIdRef.current = selectedClientId;
  }, [selectedClientId, form]);

  // Add task
  const addTask = () => {
    const newTask: TaskFormData = {
      id: Date.now().toString(),
      applicantType: '',
      verificationTypeId: null,
      rateTypeId: '',
      pincodeId: '',
      areaId: '',
      address: '',
      trigger: '',
      priority: 'MEDIUM',
      assignedTo: '',
      attachments: [],
    };
    setTasks([...tasks, newTask]);
  };

  // Remove task (minimum 1 task)
  const removeTask = (taskId: string) => {
    if (tasks.length <= 1) {
      toast.error('At least 1 task is required');
      return;
    }
    setTasks(tasks.filter(t => t.id !== taskId));
    setTaskValidationState((prev) => {
      const next = { ...prev };
      delete next[taskId];
      return next;
    });
  };

  // Update task field
  const updateTask = (taskId: string, field: keyof TaskFormData, value: unknown) => {
    setTasks(prevTasks =>
      prevTasks.map(t =>
        t.id === taskId ? { ...t, [field]: value } : t
      )
    );
  };

  const updateTaskValidationState = useCallback((taskId: string, nextState: TaskValidationState) => {
    setTaskValidationState((prev) => {
      const current = prev[taskId];
      if (
        current?.isReady === nextState.isReady &&
        current?.isLoading === nextState.isLoading &&
        current?.isValid === nextState.isValid &&
        current?.message === nextState.message
      ) {
        return prev;
      }

      return {
        ...prev,
        [taskId]: nextState,
      };
    });
  }, []);

  const hasBlockingConfigurationState = tasks.some((task) => {
    const state = taskValidationState[task.id];
    return state?.isReady && (state.isLoading || !state.isValid);
  });

  // Handle form submission
  const handleSubmit = (caseLevelData: CaseLevelFormData) => {
    // Only validate field tasks when caseType includes field verification
    if (caseType === 'field' || caseType === 'both') {
      const invalidTasks = tasks.filter(task =>
        !task.applicantType ||
        !task.verificationTypeId ||
        !task.pincodeId ||
        !task.areaId ||
        !task.address ||
        !task.trigger ||
        !task.rateTypeId ||
        !task.assignedTo
      );

      if (invalidTasks.length > 0) {
        toast.error(`Please fill all required fields for all ${tasks.length} tasks`);
        return;
      }

      const firstConfigError = tasks
        .map((task) => taskValidationState[task.id])
        .find((state) => state?.isReady && !state.isValid);

      if (firstConfigError) {
        toast.error(firstConfigError.message || 'Complete pricing configuration for all tasks before submitting');
        return;
      }
    }

    // Pass empty tasks array for KYC-only cases
    onSubmit(caseLevelData, caseType === 'kyc' ? [] : tasks);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">Create Case with Tasks</h2>
        <p className="text-gray-600">
          {editMode ? 'Update case details and verification tasks' : 'Fill in case details once, then configure verification tasks'}
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          
          {/* CASE-LEVEL SECTION */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b">
              <Building className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Case Information (Shared Across All Tasks)</h3>
            </div>

            {/* Customer Info Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Customer Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-100/70 dark:bg-slate-800/50 rounded-lg">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Customer Name</label>
                    <p className="text-base font-medium">{customerInfo.customerName}</p>
                  </div>
                  {customerInfo.panNumber && (
                    <div>
                      <label className="text-sm font-medium text-gray-600">PAN</label>
                      <p className="text-base font-mono">{customerInfo.panNumber}</p>
                    </div>
                  )}
                  {customerInfo.mobileNumber && (
                    <div>
                      <label className="text-sm font-medium text-gray-600">Mobile</label>
                      <p className="text-base">{customerInfo.mobileNumber}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Client & Product Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Client & Product</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="clientId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Client *</FormLabel>
                        <Select onValueChange={(value) => {
                          field.onChange(value);
                          form.setValue('productId', '');
                        }} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select client" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {clients.length === 0 ? (
                              <SelectItem value="no-clients" disabled>
                                No clients assigned to your account
                              </SelectItem>
                            ) : (
                              clients.map((client) => (
                                <SelectItem key={client.id} value={String(client.id)}>
                                  {client.name}
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
                    name="productId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Product *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={!selectedClientId}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={selectedClientId ? "Select product" : "Select client first"} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {products.length === 0 && selectedClientId ? (
                              <SelectItem value="no-products" disabled>
                                No products assigned to your account for this client
                              </SelectItem>
                            ) : (
                              products.map((product) => (
                                <SelectItem key={product.id} value={product.id.toString()}>
                                  {product.name} ({product.code})
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="createdByBackendUser"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Created By *</FormLabel>
                        <FormControl>
                          <Input {...field} disabled className="bg-slate-100 dark:bg-slate-800/60 text-black dark:text-slate-100" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="backendContactNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Backend Contact Number *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Enter contact number" type="tel" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* CASE TYPE SELECTOR */}
          {!editMode && onCaseTypeChange && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Settings className="h-4 w-4 text-primary" />
                  Task Type
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3">
                  {([
                    { value: 'field' as CaseType, label: 'Field Verification', desc: 'Physical site visit by field agent' },
                    { value: 'kyc' as CaseType, label: 'KYC Verification', desc: 'Document verification by central team' },
                    { value: 'both' as CaseType, label: 'Both', desc: 'Field visit + document verification' },
                  ]).map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => onCaseTypeChange(option.value)}
                      className={`p-3 rounded-lg border-2 text-left transition-colors ${
                        caseType === option.value
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/40'
                      }`}
                    >
                      <p className={`text-sm font-medium ${caseType === option.value ? 'text-primary' : ''}`}>
                        {option.label}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{option.desc}</p>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* TASK-LEVEL SECTION — only for field or both */}
          {(caseType === 'field' || caseType === 'both') && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b">
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">Verification Tasks</h3>
              </div>
              <Button type="button" onClick={addTask} variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Task
              </Button>
            </div>

            {/* Render task cards */}
            {tasks.map((task, index) => (
              <TaskCard
                key={task.id}
                task={task}
                index={index}
                updateTask={updateTask}
                onValidationStateChange={updateTaskValidationState}
                removeTask={removeTask}
                canRemove={tasks.length > 1}
                clientId={selectedClientId}
                productId={form.watch('productId')}
                verificationTypes={verificationTypes}
                pincodes={pincodes}
                setPincodeSearch={setPincodeSearch}
              />
            ))}
          </div>
          )}

          {hasBlockingConfigurationState && (
            <Alert variant="destructive">
              <AlertDescription>
                Resolve rate type or billing configuration errors in the task cards before creating the case.
              </AlertDescription>
            </Alert>
          )}

          {/* KYC / Extra content injected by parent */}
          {renderAfterTasks}

          {/* Form Actions */}
          <div className={`flex items-center ${onBack ? 'justify-between' : 'justify-end'} pt-6 border-t`}>
            {onBack && (
              <Button type="button" variant="outline" onClick={onBack} disabled={isSubmitting}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            )}

            <Button type="submit" disabled={isSubmitting || hasBlockingConfigurationState}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating Case...
                </>
              ) : hasBlockingConfigurationState ? (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Fix Configuration
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  {editMode ? 'Update Case' : caseType === 'kyc' ? 'Create Case with KYC Tasks' : `Create Case with ${tasks.length} ${tasks.length === 1 ? 'Task' : 'Tasks'}${caseType === 'both' ? ' + KYC' : ''}`}
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};

// TaskCard Component
interface TaskCardProps {
  task: TaskFormData;
  index: number;
  updateTask: (taskId: string, field: keyof TaskFormData, value: unknown) => void;
  onValidationStateChange: (taskId: string, state: TaskValidationState) => void;
  removeTask: (taskId: string) => void;
  canRemove: boolean;
  clientId: string;
  productId: string;
  verificationTypes: VerificationType[];
  pincodes: Pincode[];
  setPincodeSearch: (term: string) => void;
}

const TaskCard: React.FC<TaskCardProps> = ({
  task,
  index,
  updateTask,
  onValidationStateChange,
  removeTask,
  canRemove,
  clientId,
  productId,
  verificationTypes,
  pincodes,
  setPincodeSearch,
}) => {
  const selectedPincodeNumber = task.pincodeId ? parseInt(task.pincodeId, 10) : undefined;
  const selectedAreaNumber = task.areaId ? parseInt(task.areaId, 10) : undefined;
  const { data: availableFieldUsers = [], isLoading: loadingFieldUsers } = useAvailableFieldUsers(
    selectedPincodeNumber,
    selectedAreaNumber
  );
  // Fetch areas based on selected pincode
  const { data: areasResponse } = useAreasByPincode(task.pincodeId ? parseInt(task.pincodeId) : undefined);
  const areas = useMemo(() => areasResponse?.data || [], [areasResponse?.data]);
  const areaIds = useMemo(() => areas.map((area) => area.id.toString()), [areas]);

  // Operational area policy:
  // 1) Auto-select only when pincode maps to exactly one area
  // 2) Clear stale area if it is not valid for the selected pincode
  useEffect(() => {
    if (!task.pincodeId) {
      if (task.areaId) {
        updateTask(task.id, 'areaId', '');
      }
      return;
    }

    if (areas.length === 1) {
      const onlyAreaId = areas[0].id.toString();
      if (task.areaId !== onlyAreaId) {
        updateTask(task.id, 'areaId', onlyAreaId);
      }
      return;
    }

    if (task.areaId && !areaIds.includes(task.areaId)) {
      updateTask(task.id, 'areaId', '');
    }
  }, [task.id, task.pincodeId, task.areaId, areas, areaIds, updateTask]);

  // Fetch rate types based on client, product, and verification type
  const { data: rateTypesResponse } = useQuery({
    queryKey: ['availableRateTypes', clientId, productId, task.verificationTypeId],
    queryFn: () => rateTypesService.getAvailableRateTypesForCase(
      parseInt(clientId || '0'),
      parseInt(productId || '0'),
      task.verificationTypeId || 0
    ),
    enabled: !!(clientId && productId && task.verificationTypeId),
  });
  const rateTypes = rateTypesResponse?.data || [];
  const shouldValidateConfiguration = Boolean(
    clientId &&
      productId &&
      task.verificationTypeId &&
      task.pincodeId &&
      task.areaId
  );
  const {
    data: configValidationResponse,
    isLoading: validatingConfiguration,
  } = useQuery({
    queryKey: [
      'task-case-config-validation',
      task.id,
      clientId,
      productId,
      task.verificationTypeId,
      task.pincodeId,
      task.areaId,
      task.rateTypeId,
    ],
    queryFn: () =>
      casesService.validateConfiguration({
        clientId: Number(clientId),
        productId: Number(productId),
        verificationTypeId: Number(task.verificationTypeId),
        pincodeId: Number(task.pincodeId),
        areaId: Number(task.areaId),
        rateTypeId: task.rateTypeId ? Number(task.rateTypeId) : undefined,
      }),
    enabled: shouldValidateConfiguration,
  });
  const configValidation: CaseConfigValidationResult | undefined = configValidationResponse?.data;

  useEffect(() => {
    if (!shouldValidateConfiguration) {
      onValidationStateChange(task.id, {
        isReady: false,
        isLoading: false,
        isValid: true,
      });
      return;
    }

    onValidationStateChange(task.id, {
      isReady: true,
      isLoading: validatingConfiguration,
      isValid: configValidation?.isValid ?? false,
      message: configValidation?.errorMessage,
    });
  }, [
    configValidation?.errorMessage,
    configValidation?.isValid,
    onValidationStateChange,
    shouldValidateConfiguration,
    task.id,
    validatingConfiguration,
  ]);

  // Note: We removed the auto-reset logic for rateTypeId and areaId
  // because it was clearing pre-filled values from Revisit tasks.
  // Users can manually change these values if needed.

  // Debug logging to verify task prop values
  logger.warn(`🎯 TaskCard ${index + 1} - Rendering with task:`, {
    taskId: task.id,
    rateTypeId: task.rateTypeId,
    assignedTo: task.assignedTo,
    verificationTypeId: task.verificationTypeId,
    pincodeId: task.pincodeId,
    areaId: task.areaId,
  });

  return (
    <Card className="relative">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Task {index + 1}</CardTitle>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => removeTask(task.id)}
            className="text-destructive hover:text-destructive"
            disabled={!canRemove}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Row 1: Applicant Type & Verification Type */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Applicant Type *</label>
            <Select
              value={task.applicantType}
              onValueChange={(value) => updateTask(task.id, 'applicantType', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select applicant type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="APPLICANT">APPLICANT</SelectItem>
                <SelectItem value="CO-APPLICANT">CO-APPLICANT</SelectItem>
                <SelectItem value="CO-APPLICANT 1">CO-APPLICANT 1</SelectItem>
                <SelectItem value="CO-APPLICANT 2">CO-APPLICANT 2</SelectItem>
                <SelectItem value="CO-APPLICANT 3">CO-APPLICANT 3</SelectItem>
                <SelectItem value="GUARANTOR">GUARANTOR</SelectItem>
                <SelectItem value="SELLER">SELLER</SelectItem>
                <SelectItem value="PROPRIETOR">PROPRIETOR</SelectItem>
                <SelectItem value="PARTNER">PARTNER</SelectItem>
                <SelectItem value="DIRECTOR">DIRECTOR</SelectItem>
                <SelectItem value="REFERENCE PERSON">REFERENCE PERSON</SelectItem>
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
        <div>
          <label className="text-sm font-medium">Rate Type *</label>
          <Select
            value={task.rateTypeId}
            onValueChange={(value) => updateTask(task.id, 'rateTypeId', value)}
            disabled={!clientId || !productId || !task.verificationTypeId}
          >
            <SelectTrigger>
              <SelectValue placeholder={
                !clientId || !productId || !task.verificationTypeId
                  ? "Select client, product & verification type first"
                  : rateTypes.length === 0
                  ? "No rate types available"
                  : "Select rate type"
              } />
            </SelectTrigger>
            <SelectContent>
              {rateTypes.map((rateType) => (
                <SelectItem key={rateType.id} value={rateType.id.toString()}>
                  {rateType.name} - {rateType.description} ₹{rateType.amount}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {task.rateTypeId && rateTypes.length > 0 ? (
            <p className="text-sm text-green-600 mt-1">
              Rate: ₹{rateTypes.find(rt => rt.id.toString() === task.rateTypeId)?.amount || '0.00'} INR
            </p>
          ) : (
            <p className="text-sm text-red-600 mt-1">
              <AlertCircle className="h-3 w-3 inline mr-1" />
              Rate type is required
            </p>
          )}
        </div>

        {shouldValidateConfiguration && (
          <Alert
            variant={configValidation?.isValid === false ? 'destructive' : 'default'}
            className={configValidation?.isValid ? 'border-green-200 bg-green-50 text-green-900' : undefined}
          >
            <AlertDescription>
              {validatingConfiguration
                ? 'Checking rate type, billing rule, and amount configuration...'
                : configValidation?.isValid === false
                  ? configValidation.errorMessage
                  : configValidation?.resolved.amount !== null &&
                      configValidation?.resolved.amount !== undefined
                    ? `Configuration ready. Amount available for this task: ₹${Number(configValidation.resolved.amount).toFixed(2)}`
                    : 'Configuration ready for this task.'}
            </AlertDescription>
          </Alert>
        )}

        {/* Row 3: Pincode & Area */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Pincode *</label>
            <SearchableSelect
                options={pincodes.map((pincode) => ({
                value: pincode.id.toString(),
                label: pincode.code,
                description: pincode.cityName || pincode.city?.name
              }))}
              value={task.pincodeId}
              onValueChange={(value) => updateTask(task.id, 'pincodeId', value)}
              placeholder="Select pincode"
              searchPlaceholder="Search pincode..."
              emptyMessage="No pincodes found"
              onSearchChange={setPincodeSearch}
            />
            {!task.pincodeId && (
              <p className="text-sm text-red-600 mt-1">
                <AlertCircle className="h-3 w-3 inline mr-1" />
                Pincode is required
              </p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium">Area *</label>
            <Select
              value={task.areaId}
              onValueChange={(value) => updateTask(task.id, 'areaId', value)}
              disabled={!task.pincodeId}
            >
            <SelectTrigger>
                <SelectValue
                  placeholder={
                    !task.pincodeId
                      ? "Select pincode first"
                      : areas.length === 1
                        ? "Auto-selected area"
                        : "Select area"
                  }
                />
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
        </div>

        {/* Row 4: Address */}
        <div>
          <label className="text-sm font-medium">Address *</label>
          <Textarea
            value={task.address}
            onChange={(e) => updateTask(task.id, 'address', e.target.value)}
            placeholder="Enter complete address"
            rows={2}
          />
          {!task.address && (
            <p className="text-sm text-red-600 mt-1">
              <AlertCircle className="h-3 w-3 inline mr-1" />
              Address is required
            </p>
          )}
        </div>

        {/* Row 5: Trigger */}
        <div>
          <label className="text-sm font-medium">TRIGGER *</label>
          <Textarea
            value={task.trigger}
            onChange={(e) => updateTask(task.id, 'trigger', e.target.value)}
            placeholder="Enter trigger or special instructions"
            rows={2}
          />
          {!task.trigger && (
            <p className="text-sm text-red-600 mt-1">
              <AlertCircle className="h-3 w-3 inline mr-1" />
              Trigger is required
            </p>
          )}
        </div>

        {/* Row 6: Priority & Assign To */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Priority *</label>
            <Select
              value={task.priority}
              onValueChange={(value: unknown) => updateTask(task.id, 'priority', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="LOW">Low</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="URGENT">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium">Assign To *</label>
            <Select
              value={task.assignedTo}
              onValueChange={(value) => updateTask(task.id, 'assignedTo', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder={
                  !task.pincodeId || !task.areaId
                    ? "Select pincode and area first"
                    : availableFieldUsers.length === 0
                      ? "No field users available"
                      : "Select field user"
                } />
              </SelectTrigger>
              <SelectContent>
                {loadingFieldUsers ? (
                  <SelectItem value="loading" disabled>
                    Loading users...
                  </SelectItem>
                ) : availableFieldUsers.length === 0 ? (
                  <SelectItem value="no-users" disabled>
                    {!task.pincodeId || !task.areaId
                      ? "Please select pincode and area first"
                      : "No field users have access to this pincode and area"}
                  </SelectItem>
                ) : (
                  availableFieldUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {!task.assignedTo && (
              <p className="text-sm text-red-600 mt-1">
                <AlertCircle className="h-3 w-3 inline mr-1" />
                Field user assignment is required
              </p>
            )}
            {task.pincodeId &&
              task.areaId &&
              availableFieldUsers.length === 0 &&
              !loadingFieldUsers && (
              <p className="text-sm text-amber-600 mt-1">
                <AlertCircle className="h-3 w-3 inline mr-1" />
                No field users have access to the selected pincode and area
              </p>
              )}
          </div>
        </div>

        {/* Row 7: Attachments */}
        <div className="border-t pt-4">
          <TaskAttachmentsSection
            taskId={task.id}
            attachments={task.attachments}
            onAttachmentsChange={(attachments) => updateTask(task.id, 'attachments', attachments)}
          />
        </div>
      </CardContent>
    </Card>
  );
};

// TaskAttachmentsSection Component
interface TaskAttachmentsSectionProps {
  taskId: string;
  attachments: CaseFormAttachment[];
  onAttachmentsChange: (attachments: CaseFormAttachment[]) => void;
}

const TaskAttachmentsSection: React.FC<TaskAttachmentsSectionProps> = ({
  taskId,
  attachments,
  onAttachmentsChange,
}) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_FILES = 10;
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  const ALLOWED_TYPES = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return `${file.name}: Only PDF, image files (JPG, PNG, GIF), and Word documents (DOC, DOCX) are allowed`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `${file.name}: File size must be less than 10MB`;
    }
    return null;
  };

  const handleFileSelect = (files: FileList | null) => {
    if (!files) {return;}

    const fileArray = Array.from(files);
    const errors: string[] = [];
    const validFiles: File[] = [];

    if (attachments.length + fileArray.length > MAX_FILES) {
      toast.error(`Maximum ${MAX_FILES} files allowed per task`);
      return;
    }

    fileArray.forEach(file => {
      const error = validateFile(file);
      if (error) {
        errors.push(error);
      } else {
        validFiles.push(file);
      }
    });

    if (errors.length > 0) {
      toast.error(errors.join('\n'));
    }

    if (validFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...validFiles]);
    }
  };

  const addFiles = async () => {
    if (selectedFiles.length === 0) {return;}

    const newAttachments: CaseFormAttachment[] = [];

    for (const file of selectedFiles) {
      const getFileType = (mimeType: string): 'pdf' | 'image' => {
        if (mimeType.startsWith('image/')) {return 'image';}
        return 'pdf';
      };

      const attachment: CaseFormAttachment = {
        id: `temp-${taskId}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        file,
        name: file.name,
        size: file.size,
        type: getFileType(file.type),
        mimeType: file.type,
      };

      if (file.type.startsWith('image/')) {
        try {
          const preview = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
          attachment.preview = preview;
        } catch (error) {
          logger.error('Failed to generate preview:', error);
        }
      }

      newAttachments.push(attachment);
    }

    onAttachmentsChange([...attachments, ...newAttachments]);
    setSelectedFiles([]);
    toast.success(`${newAttachments.length} file(s) added to task`);
  };

  const removeAttachment = (id: string) => {
    const updatedAttachments = attachments.filter(att => att.id !== id);
    onAttachmentsChange(updatedAttachments);
    toast.success('File removed');
  };

  const removeSelectedFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) {return '0 Bytes';}
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))  } ${  sizes[i]}`;
  };

  const getFileIcon = (type: string) => {
    if (type === 'image') {
      return <Image className="h-4 w-4 text-green-500" />;
    }
    return <FileText className="h-4 w-4 text-red-500" />;
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    handleFileSelect(files);
  };

  const handleBrowseClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium flex items-center gap-2">
          <Paperclip className="h-4 w-4" />
          Task Attachments
          {attachments.length > 0 && (
            <Badge variant="secondary" className="text-xs">{attachments.length}</Badge>
          )}
        </label>
      </div>

      {/* File Upload Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
          isDragging ? 'border-green-500 bg-green-50' : 'border-gray-300'
        }`}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <Upload className="h-6 w-6 text-gray-600 mx-auto mb-2" />
        <p className="text-xs text-gray-600 mb-1">
          <button
            type="button"
            className="text-green-600 hover:text-green-700 underline cursor-pointer"
            onClick={handleBrowseClick}
            disabled={attachments.length >= MAX_FILES}
          >
            Browse files
          </button>
          {' '}or drag and drop
        </p>
        <p className="text-xs text-gray-600">
          PDF, images, Word docs • Max 10MB • {MAX_FILES} files total
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.gif,.doc,.docx"
          onChange={(e) => {
            handleFileSelect(e.target.files);
            // Reset the input value to allow selecting the same file again
            e.target.value = '';
          }}
          className="hidden"
          disabled={attachments.length >= MAX_FILES}
        />
      </div>

      {/* Selected Files (pending) */}
      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-yellow-700">Selected ({selectedFiles.length})</span>
            <div className="space-x-2">
              <Button
                type="button"
                size="sm"
                onClick={addFiles}
                className="h-7 text-xs bg-green-600 hover:bg-green-700"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Files
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedFiles([])}
                className="h-7 text-xs"
              >
                Clear
              </Button>
            </div>
          </div>
          {selectedFiles.map((file, index) => (
            <div key={index} className="flex items-center gap-2 p-2 border border-yellow-300 rounded bg-yellow-50 text-xs">
              {getFileIcon(file.type.startsWith('image/') ? 'image' : 'pdf')}
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{file.name}</div>
                <div className="text-yellow-600">{formatFileSize(file.size)}</div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeSelectedFile(index)}
                className="h-6 w-6 p-0 text-red-500"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Attached Files */}
      {attachments.length > 0 && (
        <div className="space-y-2">
          <span className="text-xs font-medium text-green-700">Attached ({attachments.length})</span>
          {attachments.map((attachment) => (
            <div key={attachment.id} className="flex items-center gap-2 p-2 border border-green-200 rounded bg-green-50 text-xs">
              {getFileIcon(attachment.type)}
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{attachment.name}</div>
                <div className="text-green-600">{formatFileSize(attachment.size)}</div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeAttachment(attachment.id)}
                className="h-6 w-6 p-0 text-red-500"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
