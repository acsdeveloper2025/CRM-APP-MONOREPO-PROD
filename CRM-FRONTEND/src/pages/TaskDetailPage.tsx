import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft,
  Calendar,
  User,
  MapPin,
  FileText,
  DollarSign,
  Clock,
  CheckCircle2,
  AlertCircle,
  History,
  Edit,
  XCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import { apiService } from '@/services/api';

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

export const TaskDetailPage: React.FC = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [assignmentHistory, setAssignmentHistory] = useState<AssignmentHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (taskId) {
      fetchTaskDetails();
      fetchAssignmentHistory();
    }
  }, [taskId]);

  const fetchTaskDetails = async () => {
    try {
      setLoading(true);
      const response = await apiService.get(`/verification-tasks/${taskId}`);
      
      if (response.success) {
        // Transform snake_case to camelCase
        const taskData = response.data;
        setTask({
          id: taskData.id,
          taskNumber: taskData.task_number,
          caseId: taskData.case_id,
          caseNumber: taskData.case_number,
          customerName: taskData.customer_name,
          verificationTypeName: taskData.verification_type_name,
          taskTitle: taskData.task_title,
          taskDescription: taskData.task_description,
          priority: taskData.priority,
          status: taskData.status,
          assignedToName: taskData.assigned_to_name,
          assignedToEmployeeId: taskData.assigned_to_employee_id,
          assignedByName: taskData.assigned_by_name,
          assignedAt: taskData.assigned_at,
          startedAt: taskData.started_at,
          completedAt: taskData.completed_at,
          estimatedAmount: taskData.estimated_amount,
          actualAmount: taskData.actual_amount,
          address: taskData.address,
          pincode: taskData.pincode,
          rateTypeName: taskData.rate_type_name,
          trigger: taskData.trigger,
          applicantType: taskData.applicant_type,
          verificationOutcome: taskData.verification_outcome,
          commissionStatus: taskData.commission_status,
          calculatedCommission: taskData.calculated_commission,
          createdAt: taskData.created_at,
          updatedAt: taskData.updated_at,
        });
      }
      setLoading(false);
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to fetch task details';
      setError(errorMessage);
      setLoading(false);
      toast.error(errorMessage);
    }
  };

  const fetchAssignmentHistory = async () => {
    try {
      const response = await apiService.get(`/verification-tasks/${taskId}/assignment-history`);
      
      if (response.success) {
        const history = response.data.map((item: any) => ({
          id: item.id,
          assignedToName: item.assigned_to_name,
          assignedByName: item.assigned_by_name,
          assignedFromName: item.assigned_from_name,
          assignedAt: item.assigned_at,
          assignmentReason: item.assignment_reason,
          taskStatusAfter: item.task_status_after,
        }));
        setAssignmentHistory(history);
      }
    } catch (err: any) {
      console.error('Failed to fetch assignment history:', err);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: any; label: string; icon: any }> = {
      PENDING: { variant: 'secondary', label: 'Pending', icon: Clock },
      ASSIGNED: { variant: 'default', label: 'Assigned', icon: User },
      IN_PROGRESS: { variant: 'default', label: 'In Progress', icon: Clock },
      COMPLETED: { variant: 'default', label: 'Completed', icon: CheckCircle2 },
      CANCELLED: { variant: 'destructive', label: 'Cancelled', icon: XCircle },
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

    return (
      <Badge className={config.className}>
        {config.label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="container mx-auto py-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-6">
            <p className="text-red-600">{error || 'Task not found'}</p>
            <Button onClick={() => navigate('/tasks')} className="mt-4">
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
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{task.taskNumber}</h1>
            <p className="text-gray-600 mt-1">{task.taskTitle}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {getStatusBadge(task.status)}
          {getPriorityBadge(task.priority)}
        </div>
      </div>

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
                    onClick={() => navigate(`/cases/${task.caseId}`)}
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
                    {task.pincode && <p className="text-sm text-gray-600">Pincode: {task.pincode}</p>}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

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
                  {assignmentHistory.map((item, index) => (
                    <div key={item.id} className="flex items-start space-x-4">
                      <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-primary"></div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          Assigned to {item.assignedToName}
                          {item.assignedFromName && ` (from ${item.assignedFromName})`}
                        </p>
                        <p className="text-xs text-gray-600">
                          By {item.assignedByName} • {format(new Date(item.assignedAt), 'dd MMM yyyy, hh:mm a')}
                        </p>
                        <p className="text-xs text-gray-600">
                          Status: {item.taskStatusAfter}
                        </p>
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
                <div className="mt-1">
                  {getStatusBadge(task.status)}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Priority</p>
                <div className="mt-1">
                  {getPriorityBadge(task.priority)}
                </div>
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
                      <p className="text-sm">{format(new Date(task.assignedAt), 'dd MMM yyyy, hh:mm a')}</p>
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
                <p className="text-sm">{format(new Date(task.createdAt), 'dd MMM yyyy, hh:mm a')}</p>
              </div>
              {task.assignedAt && (
                <div>
                  <p className="text-sm font-medium text-gray-600">Assigned</p>
                  <p className="text-sm">{format(new Date(task.assignedAt), 'dd MMM yyyy, hh:mm a')}</p>
                </div>
              )}
              {task.startedAt && (
                <div>
                  <p className="text-sm font-medium text-gray-600">Started</p>
                  <p className="text-sm">{format(new Date(task.startedAt), 'dd MMM yyyy, hh:mm a')}</p>
                </div>
              )}
              {task.completedAt && (
                <div>
                  <p className="text-sm font-medium text-gray-600">Completed</p>
                  <p className="text-sm">{format(new Date(task.completedAt), 'dd MMM yyyy, hh:mm a')}</p>
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-gray-600">Last Updated</p>
                <p className="text-sm">{format(new Date(task.updatedAt), 'dd MMM yyyy, hh:mm a')}</p>
              </div>
            </CardContent>
          </Card>

          {/* Financial - Only show if there's actual financial data */}
          {((task.estimatedAmount !== undefined && task.estimatedAmount !== null && task.estimatedAmount > 0) ||
            (task.actualAmount !== undefined && task.actualAmount !== null && task.actualAmount > 0) ||
            (task.calculatedCommission !== undefined && task.calculatedCommission !== null && task.calculatedCommission > 0)) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Financial</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {task.estimatedAmount !== undefined && task.estimatedAmount !== null && task.estimatedAmount > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-600">Estimated Amount</p>
                    <p className="text-sm">₹{task.estimatedAmount.toFixed(2)}</p>
                  </div>
                )}
                {task.actualAmount !== undefined && task.actualAmount !== null && task.actualAmount > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-600">Actual Amount</p>
                    <p className="text-sm">₹{task.actualAmount.toFixed(2)}</p>
                  </div>
                )}
                {task.calculatedCommission !== undefined && task.calculatedCommission !== null && task.calculatedCommission > 0 && (
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

