import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UserCheck, AlertCircle, User, Loader2 } from 'lucide-react';
import {
  AssignVerificationTaskRequest,
  TaskPriority,
  VerificationTask,
} from '@/types/verificationTask';
import { useFieldUsersByPincode } from '@/hooks/useUsers';
import { useVerificationTask, useAssignVerificationTask } from '@/hooks/useVerificationTasks';
import { logger } from '@/utils/logger';

interface TaskAssignmentModalProps {
  taskId: string;
  isOpen?: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const TaskAssignmentModal: React.FC<TaskAssignmentModalProps> = ({
  taskId,
  isOpen = true,
  onClose,
  onSuccess,
}) => {
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [assignmentReason, setAssignmentReason] = useState<string>('');
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Fetch task details using useVerificationTask
  const { data: rawTaskData, isLoading: _loadingTask } = useVerificationTask(taskId);
  const task = (Array.isArray(rawTaskData) ? rawTaskData[0] : rawTaskData) as
    | VerificationTask
    | undefined;

  // Fetch field users filtered by the task's pincode
  const { data: fieldUsers = [], isLoading: loadingUsers } = useFieldUsersByPincode(task?.pincode);

  // Mutation for assigning task
  const { mutateAsync: assignTask, isPending: isAssigning } = useAssignVerificationTask();
  const requiresRevokeFirst = task?.status === 'IN_PROGRESS';

  // Synchronize local priority with task priority when task data is loaded
  useEffect(() => {
    if (task) {
      setPriority(task.priority);
      if (task.assignedTo) {
        setAssignedTo(task.assignedTo.id);
      }
    }
  }, [task]);

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
    if (requiresRevokeFirst) {
      setSubmitError('This task is already in progress. Revoke it first, then reassign it.');
      return;
    }

    if (!validateForm()) {
      return;
    }

    setSubmitError(null);

    const assignmentData: AssignVerificationTaskRequest = {
      assignedTo,
      assignmentReason,
      priority,
    };

    try {
      await assignTask({ taskId, data: assignmentData });
      if (onSuccess) {
        onSuccess();
      } else {
        onClose();
      }
    } catch (error) {
      logger.error('Failed to assign task:', error);
      const apiCode =
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof (error as { response?: unknown }).response === 'object' &&
        (error as { response?: { data?: { error?: { code?: string } } } }).response?.data?.error
          ?.code;

      if (apiCode === 'MUST_REVOKE_TASK_FIRST') {
        setSubmitError('This task is already in progress. Revoke it first, then reassign it.');
        return;
      }

      setSubmitError('Failed to assign task. Please try again.');
    }
  };

  const clearError = (field: string) => {
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
    setSubmitError(null);
  };

  const getPriorityColor = (priority: TaskPriority) => {
    const colors = {
      LOW: 'bg-gray-100 text-gray-800',
      MEDIUM: 'bg-green-100 text-green-800',
      HIGH: 'bg-yellow-100 text-orange-800',
      URGENT: 'bg-red-100 text-red-800',
    };
    return colors[priority];
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
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
                <div className="space-y-1">
                  <span className="text-sm font-medium text-gray-900 block">
                    Task ID: {taskId.slice(0, 8)}...
                  </span>
                  <span className="text-xs text-gray-600 block">
                    {task?.pincode ? `Pincode: ${task.pincode}` : 'Assigning task to field user'}
                  </span>
                </div>
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getPriorityColor(priority)}`}
                >
                  {priority}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Global Error */}
          {submitError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative text-sm">
              <span className="block sm:inline">{submitError}</span>
            </div>
          )}

          {requiresRevokeFirst && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded text-sm">
              This task is already in progress. Revoke it from the task actions menu before
              assigning it to a different field executive.
            </div>
          )}

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
                disabled={loadingUsers || !task || isAssigning || requiresRevokeFirst}
              >
                <SelectTrigger className={errors.assignedTo ? 'border-red-500' : ''}>
                  <SelectValue
                    placeholder={loadingUsers ? 'Loading field users...' : 'Select a field user'}
                  >
                    {assignedTo && (
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4" />
                        <span>
                          {
                            fieldUsers.find(
                              (user) =>
                                (typeof user.id === 'string' ? user.id : String(user.id)) ===
                                assignedTo
                            )?.name
                          }
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
                disabled={isAssigning || requiresRevokeFirst}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">
                    <Badge className="bg-gray-100 text-gray-800">Low</Badge>
                  </SelectItem>
                  <SelectItem value="MEDIUM">
                    <Badge className="bg-green-100 text-green-800">Medium</Badge>
                  </SelectItem>
                  <SelectItem value="HIGH">
                    <Badge className="bg-yellow-100 text-orange-800">High</Badge>
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
                disabled={isAssigning || requiresRevokeFirst}
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
            <Card className="bg-green-50 border-green-200">
              <CardContent className="p-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-green-900">Assignment Summary</p>
                  <div className="text-sm text-green-800">
                    <p>
                      <span className="font-medium">Assignee:</span>{' '}
                      {
                        fieldUsers.find(
                          (user) =>
                            (typeof user.id === 'string' ? user.id : String(user.id)) === assignedTo
                        )?.name
                      }
                    </p>
                    <div className="flex items-center gap-1">
                      <span className="font-medium">Priority:</span>
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getPriorityColor(priority)}`}
                      >
                        {priority}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex justify-end space-x-3">
            <Button onClick={onClose} variant="outline" disabled={isAssigning}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isAssigning || !assignedTo || requiresRevokeFirst}
            >
              {isAssigning ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Assigning...
                </>
              ) : requiresRevokeFirst ? (
                'Revoke First'
              ) : (
                'Assign Task'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
