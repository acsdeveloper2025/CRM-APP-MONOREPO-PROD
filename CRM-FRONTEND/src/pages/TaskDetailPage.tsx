import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft,
  User,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  History,
  XCircle,
  Edit,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { apiService } from '@/services/api';
import { LoadingState } from '@/components/ui/loading';
import { EditTaskDetailsModal } from '@/components/verification-tasks/EditTaskDetailsModal';
import { KYCTaskVerificationSection } from '@/components/kyc/KYCTaskVerificationSection';
import { logger } from '@/utils/logger';

interface TaskDetail {
  id: string;
  taskNumber: string;
  caseId: string;
  caseNumber: string;
  customerName: string;
  verificationTypeName: string;
  taskTitle: string;
  taskDescription?: string;
  priority: string;
  status: string;
  assignedToName?: string;
  assignedToEmployeeId?: string;
  assignedByName?: string;
  assignedAt?: string;
  startedAt?: string;
  completedAt?: string;
  estimatedAmount?: number;
  actualAmount?: number;
  address?: string;
  pincode?: string;
  rateTypeName?: string;
  trigger?: string;
  applicantType?: string;
  verificationOutcome?: string;
  commissionStatus?: string;
  calculatedCommission?: number;
  taskType?: 'REVISIT' | 'KYC' | null;
  createdAt: string;
  updatedAt: string;
}

interface AssignmentHistory {
  id: string;
  assignedToName: string;
  assignedByName: string;
  assignedFromName?: string;
  assignedAt: string;
  assignmentReason?: string;
  taskStatusAfter: string;
}

interface TaskHistoryItem {
  id: string;
  details: {
    to?: string;
    from?: string;
    comment?: string;
    status?: string;
  };
  performedBy: {
    name: string;
  };
  timestamp: string;
}

export const TaskDetailPage: React.FC = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [assignmentHistory, setAssignmentHistory] = useState<AssignmentHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  useEffect(() => {
    if (taskId) {
      fetchTaskDetails();
      fetchAssignmentHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  const fetchTaskDetails = async () => {
    try {
      setLoading(true);
      const response = await apiService.get(`/verification-tasks/${taskId}`);

      if (response.success) {
        // Transform snakeCase to camelCase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const taskData = response.data as any;
        setTask({
          id: taskData.id,
          taskNumber: taskData.taskNumber,
          caseId: taskData.caseId,
          caseNumber: taskData.caseNumber,
          customerName: taskData.customerName,
          verificationTypeName: taskData.verificationTypeName,
          taskTitle: taskData.taskTitle,
          taskDescription: taskData.taskDescription,
          priority: taskData.priority,
          status: taskData.status,
          assignedToName: taskData.assignedToName,
          assignedToEmployeeId: taskData.assignedToEmployeeId,
          assignedByName: taskData.assignedByName,
          assignedAt: taskData.assignedAt,
          startedAt: taskData.startedAt,
          completedAt: taskData.completedAt,
          estimatedAmount: taskData.estimatedAmount,
          actualAmount: taskData.actualAmount,
          address: taskData.address,
          pincode: taskData.pincode,
          rateTypeName: taskData.rateTypeName,
          trigger: taskData.trigger,
          applicantType: taskData.applicantType,
          verificationOutcome: taskData.verificationOutcome,
          commissionStatus: taskData.commissionStatus,
          calculatedCommission: taskData.calculatedCommission,
          taskType: taskData.taskType || null,
          createdAt: taskData.createdAt,
          updatedAt: taskData.updatedAt,
        });
      }
      setLoading(false);
    } catch (err) {
      const errorMessage =
        (err as { response?: { data?: { message?: string } } }).response?.data?.message ||
        'Failed to fetch task details';
      setError(errorMessage);
      setLoading(false);
      toast.error(errorMessage);
    }
  };

  const fetchAssignmentHistory = async () => {
    try {
      const response = await apiService.get(`/verification-tasks/${taskId}/assignment-history`);

      if (response.success) {
        const history = (response.data as TaskHistoryItem[]).map((item: TaskHistoryItem) => ({
          id: item.id,
          assignedToName: item.details.to || 'N/A', // Assuming 'to' in details is the assignedToName
          assignedByName: item.performedBy.name,
          assignedFromName: item.details.from, // Assuming 'from' in details is the assignedFromName
          assignedAt: item.timestamp,
          assignmentReason: item.details.comment,
          taskStatusAfter: item.details.status || 'N/A', // Assuming status is in details
        }));
        setAssignmentHistory(history);
      }
    } catch (err) {
      logger.error('Failed to fetch assignment history:', err);
    }
  };

  const handleUpdateTask = async (
    taskId: string,
    updateData: import('@/types/verificationTask').UpdateVerificationTaskRequest
  ) => {
    try {
      const response = await apiService.put(`/verification-tasks/${taskId}`, updateData);
      if (response.success) {
        toast.success('Task details updated successfully');
        fetchTaskDetails(); // Refresh data
      } else {
        toast.error(response.message || 'Failed to update task');
      }
    } catch (error) {
      logger.error('Failed to update task:', error);
      const errorMessage =
        (error as { response?: { data?: { message?: string } } }).response?.data?.message ||
        'Failed to update task';
      toast.error(errorMessage);
    }
  };

  const getStatusBadge = (status: string) => {
    type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';
    type IconComponent =
      | typeof Clock
      | typeof User
      | typeof CheckCircle2
      | typeof XCircle
      | typeof AlertCircle;

    const statusConfig: Record<
      string,
      { variant: BadgeVariant; label: string; icon: IconComponent }
    > = {
      PENDING: { variant: 'secondary', label: 'Pending', icon: Clock },
      ASSIGNED: { variant: 'default', label: 'Assigned', icon: User },
      IN_PROGRESS: { variant: 'default', label: 'In Progress', icon: Clock },
      COMPLETED: { variant: 'default', label: 'Completed', icon: CheckCircle2 },
      REVOKED: { variant: 'destructive', label: 'Revoked', icon: XCircle },
      ON_HOLD: { variant: 'secondary', label: 'On Hold', icon: AlertCircle },
    };

    const config = statusConfig[status] || statusConfig.PENDING;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const priorityConfig: Record<string, { className: string; label: string }> = {
      URGENT: { className: 'bg-red-100 text-red-800 border-red-200', label: 'Urgent' },
      HIGH: { className: 'bg-yellow-100 text-orange-800 border-orange-200', label: 'High' },
      MEDIUM: { className: 'bg-green-100 text-green-800 border-green-200', label: 'Medium' },
      LOW: { className: 'bg-gray-100 text-gray-800 border-gray-200', label: 'Low' },
    };

    const config = priorityConfig[priority] || priorityConfig.MEDIUM;

    return <Badge className={config.className}>{config.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <LoadingState message="Fetching task details..." size="lg" />
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="container mx-auto py-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-6">
            <p className="text-red-600">{error || 'Task not found'}</p>
            <Button onClick={() => navigate('/task-management/all-tasks')} className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Tasks
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/task-management/all-tasks')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Tasks
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{task.taskNumber}</h1>
            <p className="text-gray-600 mt-1">{task.taskTitle}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={() => setIsEditModalOpen(true)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit Task
          </Button>
          {task.taskType && (
            <Badge
              className={
                task.taskType === 'KYC'
                  ? 'bg-amber-100 text-amber-800 border-amber-200'
                  : task.taskType === 'REVISIT'
                    ? 'bg-purple-100 text-purple-800 border-purple-200'
                    : 'bg-blue-100 text-blue-800 border-blue-200'
              }
            >
              {task.taskType}
            </Badge>
          )}
          {getStatusBadge(task.status)}
          {getPriorityBadge(task.priority)}
        </div>
      </div>

      <EditTaskDetailsModal
        open={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        task={{
          id: task.id,
          taskTitle: task.taskTitle,
          taskDescription: task.taskDescription,
          priority: task.priority,
          address: task.address,
          pincode: task.pincode,
        }}
        onSubmit={handleUpdateTask}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Task Information */}
          <Card>
            <CardHeader>
              <CardTitle>Task Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-600">Case Number</p>
                  <Button
                    variant="link"
                    className="p-0 h-auto"
                    onClick={() => navigate(`/case-management/${task.caseId}`)}
                  >
                    {task.caseNumber}
                  </Button>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Customer Name</p>
                  <p className="text-sm">{task.customerName}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Verification Type</p>
                  <p className="text-sm">{task.verificationTypeName}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Rate Type</p>
                  <p className="text-sm">{task.rateTypeName || 'N/A'}</p>
                </div>
                {task.applicantType && (
                  <div>
                    <p className="text-sm font-medium text-gray-600">Applicant Type</p>
                    <p className="text-sm">{task.applicantType}</p>
                  </div>
                )}
                {task.trigger && (
                  <div>
                    <p className="text-sm font-medium text-gray-600">Trigger</p>
                    <p className="text-sm">{task.trigger}</p>
                  </div>
                )}
              </div>

              {task.taskDescription && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-2">Description</p>
                    <p className="text-sm">{task.taskDescription}</p>
                  </div>
                </>
              )}

              {task.address && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-2 flex items-center">
                      <MapPin className="h-4 w-4 mr-1" />
                      Address
                    </p>
                    <p className="text-sm">{task.address}</p>
                    {task.pincode && (
                      <p className="text-sm text-gray-600">Pincode: {task.pincode}</p>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* KYC Document Verification (only for KYC tasks) */}
          {task.taskType === 'KYC' && (
            <KYCTaskVerificationSection caseId={task.caseId} taskId={task.id} />
          )}

          {/* Assignment History */}
          {assignmentHistory.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <History className="h-5 w-5 mr-2" />
                  Assignment History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {assignmentHistory.map((item) => (
                    <div key={item.id} className="flex items-start space-x-4">
                      <div className="shrink-0 w-2 h-2 mt-2 rounded-full bg-primary" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          Assigned to {item.assignedToName}
                          {item.assignedFromName && ` (from ${item.assignedFromName})`}
                        </p>
                        <p className="text-xs text-gray-600">
                          By {item.assignedByName} •{' '}
                          {format(new Date(item.assignedAt), 'dd MMM yyyy, hh:mm a')}
                        </p>
                        <p className="text-xs text-gray-600">Status: {item.taskStatusAfter}</p>
                        {item.assignmentReason && (
                          <p className="text-xs text-gray-600 mt-1">
                            Reason: {item.assignmentReason}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Task Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Task Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm font-medium text-gray-600">Current Status</p>
                <div className="mt-1">{getStatusBadge(task.status)}</div>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Priority</p>
                <div className="mt-1">{getPriorityBadge(task.priority)}</div>
              </div>
            </CardContent>
          </Card>

          {/* Assignment Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Assignment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {task.assignedToName ? (
                <>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Assigned To</p>
                    <p className="text-sm">{task.assignedToName}</p>
                    {task.assignedToEmployeeId && (
                      <p className="text-xs text-gray-600">ID: {task.assignedToEmployeeId}</p>
                    )}
                  </div>
                  {task.assignedByName && (
                    <div>
                      <p className="text-sm font-medium text-gray-600">Assigned By</p>
                      <p className="text-sm">{task.assignedByName}</p>
                    </div>
                  )}
                  {task.assignedAt && (
                    <div>
                      <p className="text-sm font-medium text-gray-600">Assignment Date & Time</p>
                      <p className="text-sm">
                        {format(new Date(task.assignedAt), 'dd MMM yyyy, hh:mm a')}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-gray-600">Not assigned yet</p>
              )}
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm font-medium text-gray-600">Created</p>
                <p className="text-sm">
                  {format(new Date(task.createdAt), 'dd MMM yyyy, hh:mm a')}
                </p>
              </div>
              {task.assignedAt && (
                <div>
                  <p className="text-sm font-medium text-gray-600">Assigned</p>
                  <p className="text-sm">
                    {format(new Date(task.assignedAt), 'dd MMM yyyy, hh:mm a')}
                  </p>
                </div>
              )}
              {task.startedAt && (
                <div>
                  <p className="text-sm font-medium text-gray-600">Started</p>
                  <p className="text-sm">
                    {format(new Date(task.startedAt), 'dd MMM yyyy, hh:mm a')}
                  </p>
                </div>
              )}
              {task.completedAt && (
                <div>
                  <p className="text-sm font-medium text-gray-600">Completed</p>
                  <p className="text-sm">
                    {format(new Date(task.completedAt), 'dd MMM yyyy, hh:mm a')}
                  </p>
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-gray-600">Last Updated</p>
                <p className="text-sm">
                  {format(new Date(task.updatedAt), 'dd MMM yyyy, hh:mm a')}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Financial - Only show if there's actual financial data */}
          {((task.estimatedAmount !== undefined &&
            task.estimatedAmount !== null &&
            task.estimatedAmount > 0) ||
            (task.actualAmount !== undefined &&
              task.actualAmount !== null &&
              task.actualAmount > 0) ||
            (task.calculatedCommission !== undefined &&
              task.calculatedCommission !== null &&
              task.calculatedCommission > 0)) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Financial</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {task.estimatedAmount !== undefined &&
                  task.estimatedAmount !== null &&
                  task.estimatedAmount > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-600">Estimated Amount</p>
                      <p className="text-sm">₹{task.estimatedAmount.toFixed(2)}</p>
                    </div>
                  )}
                {task.actualAmount !== undefined &&
                  task.actualAmount !== null &&
                  task.actualAmount > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-600">Actual Amount</p>
                      <p className="text-sm">₹{task.actualAmount.toFixed(2)}</p>
                    </div>
                  )}
                {task.calculatedCommission !== undefined &&
                  task.calculatedCommission !== null &&
                  task.calculatedCommission > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-600">Commission</p>
                      <p className="text-sm">₹{task.calculatedCommission.toFixed(2)}</p>
                      {task.commissionStatus && (
                        <Badge variant="secondary" className="mt-1">
                          {task.commissionStatus}
                        </Badge>
                      )}
                    </div>
                  )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
