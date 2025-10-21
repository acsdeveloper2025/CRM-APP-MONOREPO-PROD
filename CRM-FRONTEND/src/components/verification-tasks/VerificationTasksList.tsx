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
  AlertTriangle,
  DollarSign
} from 'lucide-react';
import { VerificationTask, TaskStatus, TaskPriority } from '@/types/verificationTask';
import { formatDistanceToNow } from 'date-fns';

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
  // Status badge styling
  const getStatusBadge = (status: TaskStatus) => {
    const statusConfig = {
      PENDING: { variant: 'secondary' as const, icon: Clock, color: 'text-yellow-600' },
      ASSIGNED: { variant: 'outline' as const, icon: UserCheck, color: 'text-blue-600' },
      IN_PROGRESS: { variant: 'default' as const, icon: Play, color: 'text-green-600' },
      COMPLETED: { variant: 'default' as const, icon: CheckCircle, color: 'text-green-700' },
      CANCELLED: { variant: 'destructive' as const, icon: X, color: 'text-red-600' },
      ON_HOLD: { variant: 'secondary' as const, icon: AlertTriangle, color: 'text-orange-600' }
    };

    const config = statusConfig[status];
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center space-x-1">
        <Icon className="h-3 w-3" />
        <span>{status.replace('_', ' ')}</span>
      </Badge>
    );
  };

  // Priority badge styling
  const getPriorityBadge = (priority: TaskPriority) => {
    const priorityConfig = {
      LOW: { variant: 'outline' as const, color: 'text-gray-600' },
      MEDIUM: { variant: 'secondary' as const, color: 'text-blue-600' },
      HIGH: { variant: 'default' as const, color: 'text-orange-600' },
      URGENT: { variant: 'destructive' as const, color: 'text-red-600' }
    };

    const config = priorityConfig[priority];

    return (
      <Badge variant={config.variant} className={config.color}>
        {priority}
      </Badge>
    );
  };

  // Format currency
  const formatCurrency = (amount?: number) => {
    if (!amount) return '-';
    return `₹${amount.toLocaleString('en-IN')}`;
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading tasks...</span>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-gray-500 mb-2">No verification tasks found</div>
        <p className="text-sm text-gray-400">
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
                  indeterminate={someSelected}
                  onCheckedChange={onSelectAll}
                />
              </TableHead>
            )}
            <TableHead>Task</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Assigned To</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="w-12">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => (
            <TableRow key={task.id} className="hover:bg-gray-50">
              {!readonly && (
                <TableCell>
                  <Checkbox
                    checked={selectedTasks.includes(task.id)}
                    onCheckedChange={() => onSelectTask(task.id)}
                  />
                </TableCell>
              )}
              
              <TableCell>
                <div>
                  <div className="font-medium text-gray-900">
                    {task.taskTitle}
                  </div>
                  <div className="text-sm text-gray-500">
                    #{task.taskNumber}
                  </div>
                  {task.taskDescription && (
                    <div className="text-xs text-gray-400 mt-1 max-w-xs truncate">
                      {task.taskDescription}
                    </div>
                  )}
                </div>
              </TableCell>
              
              <TableCell>
                <span className="text-sm text-gray-600">
                  {task.verificationTypeName || 'Unknown Type'}
                </span>
              </TableCell>
              
              <TableCell>
                {getStatusBadge(task.status)}
              </TableCell>
              
              <TableCell>
                {getPriorityBadge(task.priority)}
              </TableCell>
              
              <TableCell>
                <div className="text-sm">
                  {task.assignedToName ? (
                    <span className="text-gray-900">{task.assignedToName}</span>
                  ) : (
                    <span className="text-gray-400 italic">Unassigned</span>
                  )}
                  {task.assignedAt && (
                    <div className="text-xs text-gray-500">
                      {formatDate(task.assignedAt)}
                    </div>
                  )}
                </div>
              </TableCell>
              
              <TableCell>
                <div className="text-sm">
                  <div className="flex items-center space-x-1">
                    <DollarSign className="h-3 w-3 text-gray-400" />
                    <span className="text-gray-600">
                      {formatCurrency(task.estimatedAmount)}
                    </span>
                  </div>
                  {task.actualAmount && (
                    <div className="text-xs text-green-600 mt-1">
                      Actual: {formatCurrency(task.actualAmount)}
                    </div>
                  )}
                </div>
              </TableCell>
              
              <TableCell>
                <div className="text-sm text-gray-600">
                  {formatDate(task.createdAt)}
                </div>
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
