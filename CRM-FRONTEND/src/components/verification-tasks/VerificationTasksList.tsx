import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  MoreHorizontal,
  UserCheck,
  CheckCircle,
  Play,
  X,
  Eye,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { VerificationTask, TaskStatus, TaskPriority } from '@/types/verificationTask';
import { formatDistanceToNow } from 'date-fns';
import {
  getTaskStatusBadgeStyle,
  getTaskPriorityBadgeStyle,
  getStatusLabel,
} from '@/lib/badgeStyles';

interface VerificationTasksListProps {
  tasks: VerificationTask[];
  loading: boolean;
  selectedTasks: string[];
  readonly?: boolean;
  onSelectTask: (taskId: string) => void;
  onSelectAll: () => void;
  onAssignTask: (taskId: string) => void;
  onCompleteTask: (taskId: string) => void;
  onStartTask?: (taskId: string) => void;
  onCancelTask?: (taskId: string) => void;
  onViewTask?: (taskId: string) => void;
}

export const VerificationTasksList: React.FC<VerificationTasksListProps> = ({
  tasks,
  loading,
  selectedTasks,
  readonly = false,
  onSelectTask,
  onSelectAll,
  onAssignTask,
  onCompleteTask,
  onStartTask,
  onCancelTask,
  onViewTask
}) => {
  // Status icon helper
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

  // Format date
  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return 'Invalid date';
    }
  };

  // Check if all tasks are selected
  const allSelected = tasks.length > 0 && tasks.every(task => selectedTasks.includes(task.id));
  const someSelected = selectedTasks.length > 0 && !allSelected;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-2">Loading tasks...</span>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="mb-2">No verification tasks found</div>
        <p className="text-sm text-gray-600">
          Create new tasks to get started with verification workflows
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            {!readonly && (
              <TableHead className="w-12">
                <Checkbox
                  checked={allSelected}
                  {...(someSelected ? { indeterminate: true } : {})}
                  onCheckedChange={onSelectAll}
                />
              </TableHead>
            )}
            <TableHead>Task #</TableHead>
            <TableHead>Case #</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Verification Type</TableHead>
            <TableHead>Trigger</TableHead>
            <TableHead>Pincode</TableHead>
            <TableHead>Address</TableHead>
            <TableHead>Rate Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Assigned To</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="w-12">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => (
            <TableRow key={task.id} className="hover:bg-muted/50">
              {!readonly && (
                <TableCell>
                  <Checkbox
                    checked={selectedTasks.includes(task.id)}
                    onCheckedChange={() => onSelectTask(task.id)}
                  />
                </TableCell>
              )}
              
              {/* Task Number */}
              <TableCell>
                <div className="font-medium">
                  #{task.taskNumber}
                </div>
              </TableCell>

              {/* Case Number */}
              <TableCell>
                <div className="font-medium">
                  {task.caseNumber ? `#${task.caseNumber}` : '-'}
                </div>
              </TableCell>

              {/* Customer Name */}
              <TableCell className="font-medium">
                {task.customerName || '-'}
              </TableCell>

              {/* Verification Type */}
              <TableCell>
                <span className="text-sm text-gray-600">
                  {task.verificationTypeName || '-'}
                </span>
              </TableCell>

              {/* Trigger */}
              <TableCell>
                <div className="max-w-xs truncate text-sm text-gray-600" title={task.trigger}>
                  {task.trigger || '-'}
                </div>
              </TableCell>

              {/* Pincode */}
              <TableCell>
                {task.pincode || '-'}
              </TableCell>

              {/* Address */}
              <TableCell>
                <div className="max-w-xs truncate text-sm text-gray-600" title={task.address}>
                  {task.address || '-'}
                </div>
              </TableCell>

              {/* Rate Type */}
              <TableCell>
                <span className="text-sm text-gray-600">
                  {task.rateTypeName || '-'}
                </span>
              </TableCell>

              <TableCell>
                <Badge className={getTaskStatusBadgeStyle(task.status)}>
                  {React.createElement(getStatusIcon(task.status), { className: 'h-3 w-3 mr-1 inline' })}
                  {getStatusLabel(task.status)}
                </Badge>
              </TableCell>

              <TableCell>
                <Badge className={getTaskPriorityBadgeStyle(task.priority)}>
                  {task.priority}
                </Badge>
              </TableCell>

              <TableCell>
                <div>
                  {task.assignedToName ? (
                    <span>{task.assignedToName}</span>
                  ) : (
                    <span className="text-gray-600 italic">Unassigned</span>
                  )}
                  {task.assignedAt && (
                    <div className="text-xs text-gray-600 mt-1">
                      {formatDate(task.assignedAt)}
                    </div>
                  )}
                </div>
              </TableCell>

              <TableCell>
                <span className="text-sm text-gray-600">
                  {formatDate(task.createdAt)}
                </span>
              </TableCell>
              
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {onViewTask && (
                      <DropdownMenuItem onClick={() => onViewTask(task.id)}>
                        <Eye className="h-4 w-4 mr-2" />
                        View Details
                      </DropdownMenuItem>
                    )}
                    
                    {!readonly && (
                      <>
                        {task.status === 'PENDING' && (
                          <DropdownMenuItem onClick={() => onAssignTask(task.id)}>
                            <UserCheck className="h-4 w-4 mr-2" />
                            Assign Task
                          </DropdownMenuItem>
                        )}
                        
                        {task.status === 'ASSIGNED' && onStartTask && (
                          <DropdownMenuItem onClick={() => onStartTask(task.id)}>
                            <Play className="h-4 w-4 mr-2" />
                            Start Task
                          </DropdownMenuItem>
                        )}
                        
                        {(task.status === 'IN_PROGRESS' || task.status === 'ASSIGNED') && (
                          <DropdownMenuItem onClick={() => onCompleteTask(task.id)}>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Complete Task
                          </DropdownMenuItem>
                        )}
                        
                        {task.status !== 'COMPLETED' && task.status !== 'CANCELLED' && onCancelTask && (
                          <DropdownMenuItem 
                            onClick={() => onCancelTask(task.id)}
                            className="text-red-600"
                          >
                            <X className="h-4 w-4 mr-2" />
                            Cancel Task
                          </DropdownMenuItem>
                        )}
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
