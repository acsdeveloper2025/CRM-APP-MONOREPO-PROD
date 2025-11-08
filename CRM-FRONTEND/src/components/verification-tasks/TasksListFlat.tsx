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
  Eye,
  ExternalLink,
  MoreHorizontal
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import { VerificationTask, TaskStatus } from '@/types/verificationTask';
import {
  getTaskStatusBadgeStyle,
  getTaskPriorityBadgeStyle,
  getStatusLabel,
} from '@/lib/badgeStyles';
import { LoadingState } from '@/components/ui/loading';

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
    return <LoadingState message="Fetching your tasks..." size="lg" />;
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

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) {return '-';}
    try {
      return format(new Date(dateString), 'dd MMM yyyy');
    } catch {
      return '-';
    }
  };

  return (
    <div className="space-y-4">
      {/* Data Table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Task #
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Case #
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Task Title
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Verification Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Address
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Priority
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Assigned To
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Assigned By
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tasks.map((task) => {
                const StatusIcon = getStatusIcon(task.status);

                return (
                  <tr key={task.id} className="hover:bg-green-50 transition-colors">
                    {/* Task Number */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Badge className="bg-green-600 text-white hover:bg-green-700 uppercase font-medium text-xs">
                        {task.taskNumber}
                      </Badge>
                    </td>

                    {/* Case Number */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-primary hover:underline font-medium"
                        onClick={() => onViewCase?.(task.caseId)}
                      >
                        {task.caseNumber}
                      </Button>
                    </td>

                    {/* Customer Name */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {task.customerName}
                      </div>
                    </td>

                    {/* Task Title */}
                    <td className="px-4 py-4">
                      <div className="max-w-[200px]">
                        <div className="text-sm font-medium text-gray-900 truncate" title={task.taskTitle}>
                          {task.taskTitle}
                        </div>
                        {task.taskDescription && (
                          <div className="text-xs text-gray-600 truncate mt-1" title={task.taskDescription}>
                            {task.taskDescription}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Verification Type */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {task.verificationTypeName || '-'}
                      </div>
                    </td>

                    {/* Address */}
                    <td className="px-4 py-4">
                      <div className="text-sm text-gray-900 max-w-[200px] truncate" title={task.address}>
                        {task.address || '-'}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Badge className={getTaskStatusBadgeStyle(task.status)}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {getStatusLabel(task.status)}
                      </Badge>
                    </td>

                    {/* Priority */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Badge className={getTaskPriorityBadgeStyle(task.priority)}>
                        {task.priority}
                      </Badge>
                    </td>

                    {/* Assigned To */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      {task.assignedToName ? (
                        <div className="text-sm text-gray-900">
                          {task.assignedToName}
                          {task.assignedToEmployeeId && (
                            <div className="text-xs text-gray-600">
                              {task.assignedToEmployeeId}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-yellow-600 font-medium">Unassigned</span>
                      )}
                    </td>

                    {/* Assigned By */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {task.assignedByName || '-'}
                      </div>
                    </td>

                    {/* Date */}
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                      {task.assignedAt ? formatDate(task.assignedAt) : formatDate(task.createdAt)}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {!task.assignedTo && task.status === 'PENDING' && (
                            <DropdownMenuItem onClick={() => onAssignTask(task.id)}>
                              <UserCheck className="h-4 w-4 mr-2" />
                              Assign Task
                            </DropdownMenuItem>
                          )}
                          {onViewTask && (
                            <DropdownMenuItem onClick={() => onViewTask(task.id)}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                          )}
                          {onViewCase && (
                            <DropdownMenuItem onClick={() => onViewCase(task.caseId)}>
                              <ExternalLink className="h-4 w-4 mr-2" />
                              View Case
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

