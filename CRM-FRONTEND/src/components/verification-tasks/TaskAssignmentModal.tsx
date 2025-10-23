import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UserCheck, AlertCircle, User, Loader2 } from 'lucide-react';
import { AssignVerificationTaskRequest, TaskPriority, VerificationTask } from '@/types/verificationTask';
import { useFieldUsersByPincode } from '@/hooks/useUsers';
import { useVerificationTasks } from '@/hooks/useVerificationTasks';

interface TaskAssignmentModalProps {
  taskId: string;
  onClose: () => void;
  onSubmit: (assignmentData: AssignVerificationTaskRequest) => void;
}

export const TaskAssignmentModal: React.FC<TaskAssignmentModalProps> = ({
  taskId,
  onClose,
  onSubmit
}) => {
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [assignmentReason, setAssignmentReason] = useState<string>('');
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [task, setTask] = useState<VerificationTask | null>(null);

  const { fetchTaskById } = useVerificationTasks();

  // Fetch field users filtered by the task's pincode
  const { data: fieldUsers = [], isLoading: loadingUsers } = useFieldUsersByPincode(task?.pincode);

  // Fetch task details
  useEffect(() => {
    const loadTaskDetails = async () => {
      const taskData = await fetchTaskById(taskId);
      if (taskData) {
        setTask(taskData);
        setPriority(taskData.priority);
        if (taskData.assignedTo) {
          setAssignedTo(taskData.assignedTo);
        }
      }
    };

    loadTaskDetails();
  }, [taskId, fetchTaskById]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!assignedTo) {
      newErrors.assignedTo = 'Please select a field user to assign the task';
    }

    if (!assignmentReason.trim()) {
      newErrors.assignmentReason = 'Please provide a reason for assignment';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    const assignmentData: AssignVerificationTaskRequest = {
      assignedTo: assignedTo,
      assignmentReason: assignmentReason,
      priority
    };

    try {
      await onSubmit(assignmentData);
    } finally {
      setLoading(false);
    }
  };

  const clearError = (field: string) => {
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const getPriorityColor = (priority: TaskPriority) => {
    const colors = {
      LOW: 'bg-gray-100 text-gray-800',
      MEDIUM: 'bg-blue-100 text-blue-800',
      HIGH: 'bg-orange-100 text-orange-800',
      URGENT: 'bg-red-100 text-red-800'
    };
    return colors[priority];
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <UserCheck className="h-5 w-5" />
            <span>Assign Verification Task</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Task Info */}
          <Card className="bg-gray-50 border-gray-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    Task ID: {taskId.slice(0, 8)}...
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    {task?.pincode ? `Pincode: ${task.pincode}` : 'Assigning task to field user'}
                  </p>
                </div>
                <Badge className={getPriorityColor(priority)}>
                  {priority}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Assignment Form */}
          <div className="space-y-4">
            {/* Field User Selection */}
            <div className="space-y-2">
              <Label htmlFor="assignedTo">
                Assign To <span className="text-red-500">*</span>
                {task?.pincode && (
                  <span className="text-xs text-gray-500 ml-2">
                    (Showing users assigned to pincode {task.pincode})
                  </span>
                )}
              </Label>
              <Select
                value={assignedTo}
                onValueChange={(value) => {
                  setAssignedTo(value);
                  clearError('assignedTo');
                }}
                disabled={loadingUsers || !task}
              >
                <SelectTrigger className={errors.assignedTo ? 'border-red-500' : ''}>
                  <SelectValue placeholder={loadingUsers ? "Loading field users..." : "Select a field user"}>
                    {assignedTo && (
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4" />
                        <span>
                          {fieldUsers.find(user => user.id === assignedTo)?.name}
                        </span>
                      </div>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {loadingUsers ? (
                    <div className="p-4 text-center">
                      <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                      <p className="text-sm text-gray-500">Loading field users...</p>
                    </div>
                  ) : fieldUsers.length === 0 ? (
                    <div className="p-4 text-center">
                      <AlertCircle className="h-4 w-4 text-yellow-500 mx-auto mb-2" />
                      <p className="text-sm text-gray-900 font-medium">No field users available</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {task?.pincode
                          ? `No field users are assigned to pincode ${task.pincode}`
                          : 'No pincode specified for this task'}
                      </p>
                    </div>
                  ) : (
                    fieldUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        <div className="flex items-center space-x-2">
                          <User className="h-4 w-4" />
                          <div>
                            <div className="font-medium">{user.name}</div>
                            {user.employeeId && (
                              <div className="text-xs text-gray-500">ID: {user.employeeId}</div>
                            )}
                          </div>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {errors.assignedTo && (
                <p className="text-sm text-red-600 flex items-center space-x-1">
                  <AlertCircle className="h-4 w-4" />
                  <span>{errors.assignedTo}</span>
                </p>
              )}
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={priority}
                onValueChange={(value: TaskPriority) => setPriority(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">
                    <Badge className="bg-gray-100 text-gray-800">Low</Badge>
                  </SelectItem>
                  <SelectItem value="MEDIUM">
                    <Badge className="bg-blue-100 text-blue-800">Medium</Badge>
                  </SelectItem>
                  <SelectItem value="HIGH">
                    <Badge className="bg-orange-100 text-orange-800">High</Badge>
                  </SelectItem>
                  <SelectItem value="URGENT">
                    <Badge className="bg-red-100 text-red-800">Urgent</Badge>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Assignment Reason */}
            <div className="space-y-2">
              <Label htmlFor="assignmentReason">
                Assignment Reason <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="assignmentReason"
                value={assignmentReason}
                onChange={(e) => {
                  setAssignmentReason(e.target.value);
                  clearError('assignmentReason');
                }}
                placeholder="Explain why this task is being assigned to this user..."
                rows={3}
                className={errors.assignmentReason ? 'border-red-500' : ''}
              />
              {errors.assignmentReason && (
                <p className="text-sm text-red-600 flex items-center space-x-1">
                  <AlertCircle className="h-4 w-4" />
                  <span>{errors.assignmentReason}</span>
                </p>
              )}
              <p className="text-xs text-gray-500">
                This reason will be visible to the assigned user and in audit logs.
              </p>
            </div>
          </div>

          {/* Assignment Summary */}
          {assignedTo && (
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-blue-900">
                    Assignment Summary
                  </p>
                  <div className="text-sm text-blue-800">
                    <p>
                      <span className="font-medium">Assignee:</span>{' '}
                      {fieldUsers.find(user => user.id === assignedTo)?.name}
                    </p>
                    <p>
                      <span className="font-medium">Priority:</span>{' '}
                      <Badge className={getPriorityColor(priority)} size="sm">
                        {priority}
                      </Badge>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex justify-end space-x-3">
            <Button onClick={onClose} variant="outline">
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={loading || !assignedTo}
            >
              {loading ? 'Assigning...' : 'Assign Task'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
