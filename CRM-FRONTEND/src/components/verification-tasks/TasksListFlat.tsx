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
import { formatDistanceToNow } from 'date-fns';

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
    <div className="grid grid-cols-1 gap-4">
      {tasks.map((task) => {
        const StatusIcon = getStatusIcon(task.status);
        const statusColor = getStatusColor(task.status);
        const priorityColor = getPriorityColor(task.priority);

        return (
          <Card 
            key={task.id} 
            className="hover:shadow-lg transition-all duration-200 border-l-4"
            style={{
              borderLeftColor: task.priority === 'URGENT' ? '#dc2626' : 
                               task.priority === 'HIGH' ? '#ea580c' : 
                               task.priority === 'MEDIUM' ? '#2563eb' : '#6b7280'
            }}
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-3">
                  {/* Header: Status, Priority, Task Number */}
                  <div className="flex items-center flex-wrap gap-2">
                    <Badge className={`${statusColor} border`}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {getStatusLabel(task.status)}
                    </Badge>
                    <Badge className={`${priorityColor} border`}>
                      {task.priority}
                    </Badge>
                    <span className="text-sm font-semibold text-gray-900 bg-gray-100 px-2 py-1 rounded">
                      {task.taskNumber}
                    </span>
                  </div>

                  {/* Task Title */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {task.taskTitle}
                    </h3>
                    {task.taskDescription && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {task.taskDescription}
                      </p>
                    )}
                  </div>

                  {/* Case Reference */}
                  <div className="flex items-center space-x-4 text-sm">
                    <div className="flex items-center text-muted-foreground">
                      <FileText className="h-4 w-4 mr-1" />
                      <span className="font-medium">Case:</span>
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0 ml-1 text-blue-600 hover:text-blue-800"
                        onClick={() => onViewCase?.(task.caseId)}
                      >
                        {task.caseNumber}
                      </Button>
                    </div>
                    <div className="flex items-center text-muted-foreground">
                      <User className="h-4 w-4 mr-1" />
                      <span className="font-medium">{task.customerName}</span>
                    </div>
                  </div>

                  {/* Task Details Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-2 border-t">
                    {task.verificationTypeName && (
                      <div className="flex items-center text-sm">
                        <Building2 className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">Verification Type</p>
                          <p className="font-medium text-gray-900">{task.verificationTypeName}</p>
                        </div>
                      </div>
                    )}

                    {task.address && (
                      <div className="flex items-center text-sm">
                        <MapPin className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground">Address</p>
                          <p className="font-medium text-gray-900 truncate" title={task.address}>
                            {task.address}
                          </p>
                        </div>
                      </div>
                    )}

                    {task.assignedToName ? (
                      <div className="flex items-center text-sm">
                        <UserCheck className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">Assigned To</p>
                          <p className="font-medium text-gray-900">{task.assignedToName}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center text-sm">
                        <UserCheck className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">Assigned To</p>
                          <p className="font-medium text-orange-600">Unassigned</p>
                        </div>
                      </div>
                    )}

                    {task.estimatedAmount !== undefined && task.estimatedAmount !== null && (
                      <div className="flex items-center text-sm">
                        <DollarSign className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">Estimated Amount</p>
                          <p className="font-medium text-gray-900">₹{task.estimatedAmount.toFixed(2)}</p>
                        </div>
                      </div>
                    )}

                    {task.assignedAt && (
                      <div className="flex items-center text-sm">
                        <Calendar className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">Assigned</p>
                          <p className="font-medium text-gray-900">
                            {formatDistanceToNow(new Date(task.assignedAt), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    )}

                    {task.createdAt && !task.assignedAt && (
                      <div className="flex items-center text-sm">
                        <Calendar className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">Created</p>
                          <p className="font-medium text-gray-900">
                            {formatDistanceToNow(new Date(task.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col space-y-2 ml-6">
                  {!task.assignedTo && task.status === 'PENDING' && (
                    <Button
                      size="sm"
                      onClick={() => onAssignTask(task.id)}
                      className="whitespace-nowrap"
                    >
                      <UserCheck className="h-4 w-4 mr-1" />
                      Assign
                    </Button>
                  )}
                  {onViewTask && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onViewTask(task.id)}
                      className="whitespace-nowrap"
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View Task
                    </Button>
                  )}
                  {onViewCase && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onViewCase(task.caseId)}
                      className="whitespace-nowrap"
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      View Case
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

