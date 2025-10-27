import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  UserCheck,
  CheckCircle,
  Clock,
  AlertTriangle,
  X,
  Play,
  MapPin,
  User,
  Calendar,
  DollarSign,
  Building2,
  FileText,
  Eye,
  ExternalLink
} from 'lucide-react';
import { VerificationTask, TaskStatus, TaskPriority } from '@/types/verificationTask';
import { format } from 'date-fns';

interface TasksListFlatProps {
  tasks: VerificationTask[];
  loading: boolean;
  onAssignTask: (taskId: string) => void;
  onViewTask?: (taskId: string) => void;
  onViewCase?: (caseId: string) => void;
}

export const TasksListFlat: React.FC<TasksListFlatProps> = ({
  tasks,
  loading,
  onAssignTask,
  onViewTask,
  onViewCase
}) => {
  const getStatusIcon = (status: TaskStatus) => {
    const icons = {
      PENDING: Clock,
      ASSIGNED: UserCheck,
      IN_PROGRESS: Play,
      COMPLETED: CheckCircle,
      CANCELLED: X,
      ON_HOLD: AlertTriangle
    };
    return icons[status] || Clock;
  };

  const getStatusColor = (status: TaskStatus) => {
    const colors = {
      PENDING: 'text-yellow-600 bg-yellow-50 border-yellow-200',
      ASSIGNED: 'text-blue-600 bg-blue-50 border-blue-200',
      IN_PROGRESS: 'text-green-600 bg-green-50 border-green-200',
      COMPLETED: 'text-emerald-600 bg-emerald-50 border-emerald-200',
      CANCELLED: 'text-red-600 bg-red-50 border-red-200',
      ON_HOLD: 'text-orange-600 bg-orange-50 border-orange-200'
    };
    return colors[status] || 'text-gray-600 bg-gray-50 border-gray-200';
  };

  const getPriorityColor = (priority: TaskPriority) => {
    const colors = {
      LOW: 'text-gray-600 bg-gray-100 border-gray-200',
      MEDIUM: 'text-blue-600 bg-blue-100 border-blue-200',
      HIGH: 'text-orange-600 bg-orange-100 border-orange-200',
      URGENT: 'text-red-600 bg-red-100 border-red-200'
    };
    return colors[priority] || 'text-gray-600 bg-gray-100 border-gray-200';
  };

  const getStatusLabel = (status: TaskStatus) => {
    const labels = {
      PENDING: 'Pending',
      ASSIGNED: 'Assigned',
      IN_PROGRESS: 'In Progress',
      COMPLETED: 'Completed',
      CANCELLED: 'Cancelled',
      ON_HOLD: 'On Hold'
    };
    return labels[status] || status;
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4">
        {[1, 2, 3, 4, 5].map(i => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <div className="h-6 bg-gray-200 rounded w-20"></div>
                  <div className="h-6 bg-gray-200 rounded w-16"></div>
                  <div className="h-6 bg-gray-200 rounded w-24"></div>
                </div>
                <div className="h-6 bg-gray-200 rounded w-3/4"></div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="h-4 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded"></div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-lg font-medium text-muted-foreground">No tasks found</p>
          <p className="text-sm text-muted-foreground mt-1">
            Try adjusting your filters or search criteria
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {tasks.map((task) => {
        const StatusIcon = getStatusIcon(task.status);
        const statusColor = getStatusColor(task.status);
        const priorityColor = getPriorityColor(task.priority);

        return (
          <Card
            key={task.id}
            className="hover:shadow-md transition-shadow duration-200"
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-4">
                  {/* Header Row */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center flex-wrap gap-2">
                      <Badge className={`${statusColor} border`}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {getStatusLabel(task.status)}
                      </Badge>
                      <Badge className={`${priorityColor} border`}>
                        {task.priority}
                      </Badge>
                      <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded">
                        {task.taskNumber}
                      </span>
                    </div>
                  </div>

                  {/* Task Title & Description */}
                  <div>
                    <h3 className="text-base font-semibold text-foreground mb-1">
                      {task.taskTitle}
                    </h3>
                    {task.taskDescription && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {task.taskDescription}
                      </p>
                    )}
                  </div>

                  {/* Case & Customer Info */}
                  <div className="flex items-center gap-4 text-sm pb-3 border-b">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <FileText className="h-4 w-4" />
                      <span>Case:</span>
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-primary hover:underline"
                        onClick={() => onViewCase?.(task.caseId)}
                      >
                        {task.caseNumber}
                      </Button>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <User className="h-4 w-4" />
                      <span className="font-medium text-foreground">{task.customerName}</span>
                    </div>
                  </div>

                  {/* Task Details Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {task.verificationTypeName && (
                      <div className="flex items-start gap-2">
                        <Building2 className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground">Verification Type</p>
                          <p className="text-sm font-medium text-foreground">{task.verificationTypeName}</p>
                        </div>
                      </div>
                    )}

                    {task.address && (
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground">Address</p>
                          <p className="text-sm font-medium text-foreground truncate" title={task.address}>
                            {task.address}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Task Status */}
                    <div className="flex items-start gap-2">
                      <Clock className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Task Status</p>
                        <p className="text-sm font-medium text-foreground">{getStatusLabel(task.status)}</p>
                      </div>
                    </div>

                    {/* Assigned To */}
                    {(task.assignedToName || task.status === 'PENDING' || task.status === 'ASSIGNED') && (
                      <div className="flex items-start gap-2">
                        <UserCheck className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground">Assigned To</p>
                          {task.assignedToName ? (
                            <p className="text-sm font-medium text-foreground">{task.assignedToName}</p>
                          ) : (
                            <p className="text-sm font-medium text-orange-600">Unassigned</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Assigned By */}
                    {task.assignedByName && (
                      <div className="flex items-start gap-2">
                        <User className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground">Assigned By</p>
                          <p className="text-sm font-medium text-foreground">{task.assignedByName}</p>
                        </div>
                      </div>
                    )}

                    {task.estimatedAmount !== undefined && task.estimatedAmount !== null && (
                      <div className="flex items-start gap-2">
                        <DollarSign className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground">Estimated Amount</p>
                          <p className="text-sm font-medium text-foreground">₹{task.estimatedAmount.toFixed(2)}</p>
                        </div>
                      </div>
                    )}

                    {task.assignedAt && (
                      <div className="flex items-start gap-2">
                        <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground">Assignment Date & Time</p>
                          <p className="text-sm font-medium text-foreground">
                            {format(new Date(task.assignedAt), 'dd MMM yyyy, hh:mm a')}
                          </p>
                        </div>
                      </div>
                    )}

                    {task.createdAt && !task.assignedAt && (
                      <div className="flex items-start gap-2">
                        <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground">Created Date & Time</p>
                          <p className="text-sm font-medium text-foreground">
                            {format(new Date(task.createdAt), 'dd MMM yyyy, hh:mm a')}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col gap-2 shrink-0">
                  {!task.assignedTo && task.status === 'PENDING' && (
                    <Button
                      size="sm"
                      onClick={() => onAssignTask(task.id)}
                    >
                      <UserCheck className="h-4 w-4 mr-2" />
                      Assign
                    </Button>
                  )}
                  {onViewTask && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onViewTask(task.id)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View
                    </Button>
                  )}
                  {onViewCase && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onViewCase(task.caseId)}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Case
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

