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
import { VerificationTask, TaskStatus } from '@/types/verificationTask';
import {
  getTaskStatusBadgeStyle,
  getTaskPriorityBadgeStyle,
  getStatusLabel,
} from '@/lib/badgeStyles';

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

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4">
        {[1, 2, 3, 4, 5].map(i => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <div className="h-6 bg-gray-200 rounded w-20" />
                  <div className="h-6 bg-gray-200 rounded w-16" />
                  <div className="h-6 bg-gray-200 rounded w-24" />
                </div>
                <div className="h-6 bg-gray-200 rounded w-3/4" />
                <div className="grid grid-cols-2 gap-2">
                  <div className="h-4 bg-gray-200 rounded" />
                  <div className="h-4 bg-gray-200 rounded" />
                  <div className="h-4 bg-gray-200 rounded" />
                  <div className="h-4 bg-gray-200 rounded" />
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
          <Clock className="h-12 w-12 text-gray-600 mx-auto mb-4" />
          <p className="text-lg font-medium text-gray-600">No tasks found</p>
          <p className="text-sm text-gray-600 mt-1">
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
                      <Badge className={getTaskStatusBadgeStyle(task.status)}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {getStatusLabel(task.status)}
                      </Badge>
                      <Badge className={getTaskPriorityBadgeStyle(task.priority)}>
                        {task.priority}
                      </Badge>
                      <Badge className="bg-green-600 text-white hover:bg-green-700 uppercase font-medium text-xs">
                        {task.taskNumber}
                      </Badge>
                    </div>
                  </div>

                  {/* Task Title & Description */}
                  <div>
                    <h3 className="text-base font-semibold text-gray-900 mb-1">
                      {task.taskTitle}
                    </h3>
                    {task.taskDescription && (
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {task.taskDescription}
                      </p>
                    )}
                  </div>

                  {/* Case & Customer Info */}
                  <div className="flex items-center gap-4 text-sm pb-3 border-b">
                    <div className="flex items-center gap-1.5 text-gray-600">
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
                    <div className="flex items-center gap-1.5 text-gray-600">
                      <User className="h-4 w-4" />
                      <span className="font-medium text-gray-900">{task.customerName}</span>
                    </div>
                  </div>

                  {/* Task Details Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {task.verificationTypeName && (
                      <div className="flex items-start gap-2">
                        <Building2 className="h-4 w-4 mt-0.5 text-gray-600 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs text-gray-600">Verification Type</p>
                          <p className="text-sm font-medium text-gray-900">{task.verificationTypeName}</p>
                        </div>
                      </div>
                    )}

                    {task.address && (
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 mt-0.5 text-gray-600 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs text-gray-600">Address</p>
                          <p className="text-sm font-medium text-gray-900 truncate" title={task.address}>
                            {task.address}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Task Status */}
                    <div className="flex items-start gap-2">
                      <Clock className="h-4 w-4 mt-0.5 text-gray-600 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-gray-600">Task Status</p>
                        <p className="text-sm font-medium text-gray-900">{getStatusLabel(task.status)}</p>
                      </div>
                    </div>

                    {/* Assigned To */}
                    {(task.assignedToName || task.status === 'PENDING' || task.status === 'ASSIGNED') && (
                      <div className="flex items-start gap-2">
                        <UserCheck className="h-4 w-4 mt-0.5 text-gray-600 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs text-gray-600">Assigned To</p>
                          {task.assignedToName ? (
                            <p className="text-sm font-medium text-gray-900">{task.assignedToName}</p>
                          ) : (
                            <p className="text-sm font-medium text-yellow-600">Unassigned</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Assigned By */}
                    {task.assignedByName && (
                      <div className="flex items-start gap-2">
                        <User className="h-4 w-4 mt-0.5 text-gray-600 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs text-gray-600">Assigned By</p>
                          <p className="text-sm font-medium text-gray-900">{task.assignedByName}</p>
                        </div>
                      </div>
                    )}

                    {task.estimatedAmount !== undefined && task.estimatedAmount !== null && (
                      <div className="flex items-start gap-2">
                        <DollarSign className="h-4 w-4 mt-0.5 text-gray-600 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs text-gray-600">Estimated Amount</p>
                          <p className="text-sm font-medium text-gray-900">₹{task.estimatedAmount.toFixed(2)}</p>
                        </div>
                      </div>
                    )}

                    {task.assignedAt && (
                      <div className="flex items-start gap-2">
                        <Calendar className="h-4 w-4 mt-0.5 text-gray-600 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs text-gray-600">Assignment Date & Time</p>
                          <p className="text-sm font-medium text-gray-900">
                            {format(new Date(task.assignedAt), 'dd MMM yyyy, hh:mm a')}
                          </p>
                        </div>
                      </div>
                    )}

                    {task.createdAt && !task.assignedAt && (
                      <div className="flex items-start gap-2">
                        <Calendar className="h-4 w-4 mt-0.5 text-gray-600 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs text-gray-600">Created Date & Time</p>
                          <p className="text-sm font-medium text-gray-900">
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

