import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, AlertCircle, Settings } from 'lucide-react';
import { CreateVerificationTaskRequest, TaskPriority } from '@/types/verificationTask';
import { useVerificationTypes } from '@/hooks/useClients';
import { useFieldUsers } from '@/hooks/useUsers';
import { usePincodes } from '@/hooks/useLocations';
import { useAreasByPincode } from '@/hooks/useAreas';
import { useQuery } from '@tanstack/react-query';
import { rateTypesService } from '@/services/rateTypes';
import { casesService } from '@/services/cases';

interface CreateTaskModalProps {
  caseId: string;
  onClose: () => void;
  onSubmit: (tasks: CreateVerificationTaskRequest[]) => void;
}

interface TaskFormData {
  id: string;
  verificationTypeId: number | null;
  taskTitle: string;
  taskDescription: string;
  priority: TaskPriority;
  assignedTo?: string;
  rateTypeId?: string;
  address?: string;
  pincode?: string;
  areaId?: string;
  documentType?: string;
  documentNumber?: string;
}

// Component to handle area selection per task
interface TaskAreaSelectProps {
  taskId: string;
  pincodeId: number | undefined;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  error?: string;
}

const TaskAreaSelect: React.FC<TaskAreaSelectProps> = ({ taskId, pincodeId, value, onChange, error }) => {
  const { data: areasData } = useAreasByPincode(pincodeId);
  const areas = areasData?.data || [];

  return (
    <div className="space-y-2">
      <Label htmlFor={`area-${taskId}`}>Area *</Label>
      <Select
        value={value || ''}
        onValueChange={(value) => onChange(value || undefined)}
        disabled={!pincodeId}
      >
        <SelectTrigger className={error ? 'border-red-500' : ''}>
          <SelectValue placeholder={pincodeId ? "Select area" : "Select pincode first"} />
        </SelectTrigger>
        <SelectContent>
          {areas.map((area) => (
            <SelectItem key={area.id} value={area.id.toString()}>
              {area.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && (
        <div className="flex items-center gap-1 text-sm text-red-600">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}
    </div>
  );
};

export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({
  caseId,
  onClose,
  onSubmit
}) => {
  const [tasks, setTasks] = useState<TaskFormData[]>([
    {
      id: '1',
      verificationTypeId: null,
      taskTitle: '',
      taskDescription: '',
      priority: 'MEDIUM',
      assignedTo: undefined,
      rateTypeId: undefined,
      address: undefined,
      pincode: undefined,
      areaId: undefined,
      documentType: undefined,
      documentNumber: undefined
    }
  ]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: verificationTypesData } = useVerificationTypes();
  const { data: fieldUsers = [] } = useFieldUsers();

  // Fetch case details to get client, product, and verification type for rate lookup
  const { data: caseData } = useQuery({
    queryKey: ['case', caseId],
    queryFn: () => casesService.getCaseById(caseId),
    enabled: !!caseId,
  });

  const caseDetails = caseData?.data;
  const verificationTypes = verificationTypesData?.data || [];

  // Fetch available rate types for the case's client/product/verification type combination
  const { data: availableRateTypesData } = useQuery({
    queryKey: ['available-rate-types-for-case', caseDetails?.clientId, caseDetails?.productId, caseDetails?.verificationTypeId],
    queryFn: () => rateTypesService.getAvailableRateTypesForCase(
      caseDetails!.clientId,
      caseDetails!.productId,
      caseDetails!.verificationTypeId
    ),
    enabled: !!(caseDetails?.clientId && caseDetails?.productId && caseDetails?.verificationTypeId),
  });

  const availableRateTypes = availableRateTypesData?.data || [];

  // Fetch pincodes and areas for location selection
  const { data: pincodesData } = usePincodes();
  const pincodes = pincodesData?.data || [];

  // For areas, we'll fetch them dynamically per task when pincode is selected
  // This is a placeholder - we'll handle areas per task in the component

  const addTask = () => {
    const newTask: TaskFormData = {
      id: Date.now().toString(),
      verificationTypeId: null,
      taskTitle: '',
      taskDescription: '',
      priority: 'MEDIUM',
      assignedTo: undefined,
      rateTypeId: undefined,
      address: undefined,
      pincode: undefined,
      areaId: undefined,
      documentType: undefined,
      documentNumber: undefined
    };
    setTasks([...tasks, newTask]);
  };

  const removeTask = (taskId: string) => {
    if (tasks.length > 1) {
      setTasks(tasks.filter(task => task.id !== taskId));
    }
  };

  const updateTask = (taskId: string, field: keyof TaskFormData, value: any) => {
    console.log('updateTask called:', { taskId, field, value });
    setTasks(tasks.map(task => {
      if (task.id === taskId) {
        const updatedTask = { ...task, [field]: value };
        console.log('Updated task:', updatedTask);
        return updatedTask;
      }
      return task;
    }));

    // Clear error for this field
    const errorKey = `${taskId}.${field}`;
    if (errors[errorKey]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[errorKey];
        return newErrors;
      });
    }
  };

  const validateTasks = (): boolean => {
    const newErrors: Record<string, string> = {};

    tasks.forEach((task, index) => {
      if (!task.taskTitle.trim()) {
        newErrors[`${task.id}.taskTitle`] = 'Task title is required';
      }
      if (!task.verificationTypeId) {
        newErrors[`${task.id}.verificationTypeId`] = 'Verification type is required';
      }
      if (!task.rateTypeId) {
        newErrors[`${task.id}.rateTypeId`] = 'Rate type is required';
      }
      if (!task.taskDescription?.trim()) {
        newErrors[`${task.id}.taskDescription`] = 'Task description is required';
      }
      if (!task.address?.trim()) {
        newErrors[`${task.id}.address`] = 'Address is required';
      }
      if (!task.pincode?.trim()) {
        newErrors[`${task.id}.pincode`] = 'Pincode is required';
      }
      if (!task.areaId?.trim()) {
        newErrors[`${task.id}.areaId`] = 'Area is required';
      }
      if (!task.documentType?.trim()) {
        newErrors[`${task.id}.documentType`] = 'Document type is required';
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateTasks()) {
      return;
    }

    setLoading(true);
    
    const taskRequests: CreateVerificationTaskRequest[] = tasks.map(task => ({
      verification_type_id: task.verificationTypeId!,
      task_title: task.taskTitle,
      task_description: task.taskDescription || undefined,
      priority: task.priority,
      assigned_to: task.assignedTo && task.assignedTo !== 'unassigned' ? task.assignedTo : undefined,
      rate_type_id: task.rateTypeId ? parseInt(task.rateTypeId) : undefined,
      address: task.address || undefined,
      pincode: task.pincode || undefined,
      area_id: task.areaId ? parseInt(task.areaId) : undefined,
      document_type: task.documentType || undefined,
      document_number: task.documentNumber || undefined
    }));

    try {
      await onSubmit(taskRequests);
    } finally {
      setLoading(false);
    }
  };

  const getFieldError = (taskId: string, field: string) => {
    return errors[`${taskId}.${field}`];
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Plus className="h-5 w-5" />
            <span>Create Verification Tasks</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Tasks List */}
          <div className="space-y-4">
            {tasks.map((task, index) => (
              <Card key={task.id} className="border-gray-200">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">
                      Task {index + 1}
                    </CardTitle>
                    {tasks.length > 1 && (
                      <Button
                        onClick={() => removeTask(task.id)}
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Task Title */}
                    <div className="space-y-2">
                      <Label htmlFor={`title-${task.id}`}>
                        Task Title <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id={`title-${task.id}`}
                        value={task.taskTitle}
                        onChange={(e) => updateTask(task.id, 'taskTitle', e.target.value)}
                        placeholder="Enter task title"
                        className={getFieldError(task.id, 'taskTitle') ? 'border-red-500' : ''}
                      />
                      {getFieldError(task.id, 'taskTitle') && (
                        <p className="text-sm text-red-600 flex items-center space-x-1">
                          <AlertCircle className="h-4 w-4" />
                          <span>{getFieldError(task.id, 'taskTitle')}</span>
                        </p>
                      )}
                    </div>

                    {/* Verification Type */}
                    <div className="space-y-2">
                      <Label htmlFor={`type-${task.id}`}>
                        Verification Type <span className="text-red-500">*</span>
                      </Label>
                      <Select
                        value={task.verificationTypeId?.toString() || ''}
                        onValueChange={(value) => updateTask(task.id, 'verificationTypeId', parseInt(value))}
                      >
                        <SelectTrigger className={getFieldError(task.id, 'verificationTypeId') ? 'border-red-500' : ''}>
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
                      {getFieldError(task.id, 'verificationTypeId') && (
                        <p className="text-sm text-red-600 flex items-center space-x-1">
                          <AlertCircle className="h-4 w-4" />
                          <span>{getFieldError(task.id, 'verificationTypeId')}</span>
                        </p>
                      )}
                    </div>

                    {/* Priority */}
                    <div className="space-y-2">
                      <Label htmlFor={`priority-${task.id}`}>Priority</Label>
                      <Select
                        value={task.priority}
                        onValueChange={(value: TaskPriority) => updateTask(task.id, 'priority', value)}
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

                    {/* Assigned To */}
                    <div className="space-y-2">
                      <Label htmlFor={`assignee-${task.id}`}>Assign To (Optional)</Label>
                      <Select
                        value={task.assignedTo || ''}
                        onValueChange={(value) => updateTask(task.id, 'assignedTo', value || undefined)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select field user" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {fieldUsers.map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Rate Type */}
                    <div className="space-y-2">
                      <Label htmlFor={`ratetype-${task.id}`}>Rate Type *</Label>
                      <Select
                        value={task.rateTypeId || ''}
                        onValueChange={(value) => updateTask(task.id, 'rateTypeId', value || undefined)}
                        disabled={!caseDetails?.clientId || !caseDetails?.productId || !caseDetails?.verificationTypeId}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={
                            !caseDetails?.clientId || !caseDetails?.productId || !caseDetails?.verificationTypeId
                              ? "Loading case details..."
                              : availableRateTypes.length === 0
                              ? "No rate types available"
                              : "Select rate type"
                          } />
                        </SelectTrigger>
                        <SelectContent>
                          {availableRateTypes.map((rateType) => (
                            <SelectItem key={rateType.id} value={rateType.id.toString()}>
                              <div className="flex items-center justify-between w-full py-2">
                                <div className="flex flex-col">
                                  <span className="font-medium text-gray-900">{rateType.name}</span>
                                  {rateType.description && (
                                    <span className="text-xs text-gray-600 mt-1">{rateType.description}</span>
                                  )}
                                </div>
                                {rateType.hasRate && rateType.amount && (
                                  <span className="text-sm font-semibold text-green-600 ml-4">
                                    ₹{rateType.amount}
                                  </span>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {task.rateTypeId && (() => {
                        const selectedRateType = availableRateTypes.find(rt => rt.id.toString() === task.rateTypeId);
                        return selectedRateType && selectedRateType.hasRate && selectedRateType.amount ? (
                          <div className="text-sm text-green-600 font-medium">
                            Rate: ₹{selectedRateType.amount} {selectedRateType.currency || 'INR'}
                          </div>
                        ) : selectedRateType && !selectedRateType.hasRate ? (
                          <div className="text-sm text-amber-600">
                            Rate not configured for this type
                          </div>
                        ) : null;
                      })()}
                      {getFieldError(task.id, 'rateTypeId') && (
                        <p className="text-sm text-red-600 flex items-center space-x-1">
                          <AlertCircle className="h-4 w-4" />
                          <span>{getFieldError(task.id, 'rateTypeId')}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Task Description */}
                  <div className="space-y-2">
                    <Label htmlFor={`description-${task.id}`}>Description *</Label>
                    <Textarea
                      id={`description-${task.id}`}
                      value={task.taskDescription}
                      onChange={(e) => updateTask(task.id, 'taskDescription', e.target.value)}
                      placeholder="Enter task description..."
                      rows={3}
                      className={getFieldError(task.id, 'taskDescription') ? 'border-red-500' : ''}
                    />
                    {getFieldError(task.id, 'taskDescription') && (
                      <p className="text-sm text-red-600 flex items-center space-x-1">
                        <AlertCircle className="h-4 w-4" />
                        <span>{getFieldError(task.id, 'taskDescription')}</span>
                      </p>
                    )}
                  </div>


                  {/* Assignment & Location Section */}
                  <div className="border-t pt-4 mt-4">
                    <h4 className="text-sm font-medium text-gray-900 mb-4 flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      Assignment & Location
                    </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Pincode */}
                    <div className="space-y-2">
                      <Label htmlFor={`pincode-${task.id}`}>Pincode *</Label>
                      <Select
                        value={task.pincode || ''}
                        onValueChange={(value) => {
                          console.log('Pincode selection changed:', value, 'for task:', task.id);
                          console.log('Current task pincode before update:', task.pincode);
                          // Update both pincode and reset area in a single state update
                          setTasks(tasks.map(t =>
                            t.id === task.id
                              ? { ...t, pincode: value || undefined, areaId: undefined }
                              : t
                          ));
                        }}
                      >
                        <SelectTrigger className={getFieldError(task.id, 'pincode') ? 'border-red-500' : ''}>
                          <SelectValue placeholder="Select pincode" />
                        </SelectTrigger>
                        <SelectContent>
                          {pincodes.map((pincode) => (
                            <SelectItem key={pincode.id} value={pincode.id.toString()}>
                              {pincode.code}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {getFieldError(task.id, 'pincode') && (
                        <p className="text-sm text-red-600 flex items-center space-x-1">
                          <AlertCircle className="h-4 w-4" />
                          <span>{getFieldError(task.id, 'pincode')}</span>
                        </p>
                      )}
                    </div>

                    {/* Area */}
                    <TaskAreaSelect
                      taskId={task.id}
                      pincodeId={task.pincode ? parseInt(task.pincode) : undefined}
                      value={task.areaId}
                      onChange={(value) => updateTask(task.id, 'areaId', value)}
                      error={getFieldError(task.id, 'areaId')}
                    />

                    {/* Assign to Field User */}
                    <div className="space-y-2">
                      <Label htmlFor={`assignee-${task.id}`}>Assign to Field User</Label>
                      <Select
                        value={task.assignedTo || ''}
                        onValueChange={(value) => updateTask(task.id, 'assignedTo', value || undefined)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select field user" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {fieldUsers.map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.name} ({user.email})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Address */}
                    <div className="space-y-2">
                      <Label htmlFor={`address-${task.id}`}>Address *</Label>
                      <Input
                        id={`address-${task.id}`}
                        value={task.address || ''}
                        onChange={(e) => updateTask(task.id, 'address', e.target.value || undefined)}
                        placeholder="Verification address"
                        className={getFieldError(task.id, 'address') ? 'border-red-500' : ''}
                      />
                      {getFieldError(task.id, 'address') && (
                        <p className="text-sm text-red-600 flex items-center space-x-1">
                          <AlertCircle className="h-4 w-4" />
                          <span>{getFieldError(task.id, 'address')}</span>
                        </p>
                      )}
                    </div>

                    {/* Document Type */}
                    <div className="space-y-2">
                      <Label htmlFor={`doctype-${task.id}`}>Document Type *</Label>
                      <Input
                        id={`doctype-${task.id}`}
                        value={task.documentType || ''}
                        onChange={(e) => updateTask(task.id, 'documentType', e.target.value || undefined)}
                        placeholder="e.g., Aadhaar, PAN"
                        className={getFieldError(task.id, 'documentType') ? 'border-red-500' : ''}
                      />
                      {getFieldError(task.id, 'documentType') && (
                        <p className="text-sm text-red-600 flex items-center space-x-1">
                          <AlertCircle className="h-4 w-4" />
                          <span>{getFieldError(task.id, 'documentType')}</span>
                        </p>
                      )}
                    </div>

                    {/* Document Number */}
                    <div className="space-y-2">
                      <Label htmlFor={`docnumber-${task.id}`}>Document Number</Label>
                      <Input
                        id={`docnumber-${task.id}`}
                        value={task.documentNumber || ''}
                        onChange={(e) => updateTask(task.id, 'documentNumber', e.target.value || undefined)}
                        placeholder="Document number (optional)"
                      />
                    </div>
                  </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Add Task Button */}
          <Button
            onClick={addTask}
            variant="outline"
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Another Task
          </Button>

          {/* Summary */}
          <Card className="bg-green-50 border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-green-900">
                    Creating {tasks.length} verification task{tasks.length !== 1 ? 's' : ''}
                  </p>
                  <p className="text-sm text-green-700">
                    Total estimated amount: ₹{tasks.reduce((sum, task) => {
                      if (task.rateTypeId) {
                        const selectedRateType = availableRateTypes.find(rt => rt.id.toString() === task.rateTypeId);
                        return sum + (selectedRateType?.amount || 0);
                      }
                      return sum;
                    }, 0).toLocaleString('en-IN')}
                  </p>
                </div>
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  {tasks.length} Task{tasks.length !== 1 ? 's' : ''}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end space-x-3">
            <Button onClick={onClose} variant="outline">
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? 'Creating...' : 'Create Tasks'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
