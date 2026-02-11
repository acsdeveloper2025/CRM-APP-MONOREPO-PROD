import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  ChevronDown,
  ChevronRight,
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
  Package
} from 'lucide-react';
import { VerificationTask, TaskStatus } from '@/types/verificationTask';
import { formatDistanceToNow } from 'date-fns';
import {
  getTaskStatusBadgeStyle,
  getTaskPriorityBadgeStyle,
  getStatusLabel,
} from '@/lib/badgeStyles';

interface TasksGroupedByCaseProps {
  tasks: VerificationTask[];
  loading: boolean;
  onAssignTask: (taskId: string) => void;
  onViewTask?: (taskId: string) => void;
  onViewCase?: (caseId: string) => void;
}

interface GroupedTasks {
  [caseId: string]: {
    caseNumber: string;
    customerName: string;
    tasks: VerificationTask[];
  };
}

export const TasksGroupedByCase: React.FC<TasksGroupedByCaseProps> = ({
  tasks,
  loading,
  onAssignTask,
  onViewTask,
  onViewCase
}) => {
  const [expandedCases, setExpandedCases] = useState<Set<string>>(new Set());

  // Group tasks by case
  const groupedTasks: GroupedTasks = tasks.reduce((acc, task) => {
    if (!acc[task.caseId]) {
      acc[task.caseId] = {
        caseNumber: task.caseNumber || 'N/A',
        customerName: task.customerName || 'Unknown',
        tasks: []
      };
    }
    acc[task.caseId].tasks.push(task);
    return acc;
  }, {} as GroupedTasks);

  const toggleCase = (caseId: string) => {
    setExpandedCases(prev => {
      const newSet = new Set(prev);
      if (newSet.has(caseId)) {
        newSet.delete(caseId);
      } else {
        newSet.add(caseId);
      }
      return newSet;
    });
  };

  const getStatusIcon = (status: TaskStatus) => {
    const icons: Record<TaskStatus, React.ElementType> = {
      PENDING: Clock,
      ASSIGNED: UserCheck,
      IN_PROGRESS: Play,
      COMPLETED: CheckCircle,
      CANCELLED: X,
      ON_HOLD: AlertTriangle,
      REVOKED: X
    };
    return icons[status] || Clock;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-6 bg-gray-200 rounded w-1/3" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded w-full" />
                <div className="h-4 bg-gray-200 rounded w-2/3" />
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
          <p className="text-gray-600">No tasks found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {Object.entries(groupedTasks).map(([caseId, caseData]) => {
        const isExpanded = expandedCases.has(caseId);
        const taskCount = caseData.tasks.length;
        const completedCount = caseData.tasks.filter(t => t.status === 'COMPLETED').length;
        const pendingCount = caseData.tasks.filter(t => t.status === 'PENDING' || t.status === 'ASSIGNED').length;
        const inProgressCount = caseData.tasks.filter(t => t.status === 'IN_PROGRESS').length;

        return (
          <Collapsible
            key={caseId}
            open={isExpanded}
            onOpenChange={() => toggleCase(caseId)}
          >
            <Card className="hover:shadow-md transition-shadow">
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {isExpanded ? (
                        <ChevronDown className="h-5 w-5 text-gray-500" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-gray-500" />
                      )}
                      <div>
                        <CardTitle className="text-lg">
                          Case #{caseData.caseNumber} - {caseData.customerName}
                        </CardTitle>
                        <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
                          <span className="flex items-center">
                            <Package className="h-4 w-4 mr-1" />
                            {taskCount} {taskCount === 1 ? 'Task' : 'Tasks'}
                          </span>
                          {completedCount > 0 && (
                            <span className="flex items-center text-green-600">
                              <CheckCircle className="h-4 w-4 mr-1" />
                              {completedCount} Completed
                            </span>
                          )}
                          {inProgressCount > 0 && (
                            <span className="flex items-center text-green-600">
                              <Play className="h-4 w-4 mr-1" />
                              {inProgressCount} In Progress
                            </span>
                          )}
                          {pendingCount > 0 && (
                            <span className="flex items-center text-yellow-600">
                              <Clock className="h-4 w-4 mr-1" />
                              {pendingCount} Pending
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {onViewCase && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewCase(caseId);
                        }}
                      >
                        View Case
                      </Button>
                    )}
                  </div>
                </CardHeader>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    {caseData.tasks.map((task) => {
                      const StatusIcon = getStatusIcon(task.status);

                      return (
                        <div
                          key={task.id}
                          className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 space-y-2">
                              {/* Task Header */}
                              <div className="flex items-center space-x-2">
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

                              {/* Task Title */}
                              <h4 className="font-medium text-gray-900">
                                {task.taskTitle}
                              </h4>

                              {/* Task Details */}
                              <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                                {task.verificationTypeName && (
                                  <div className="flex items-center">
                                    <Building2 className="h-4 w-4 mr-1" />
                                    {task.verificationTypeName}
                                  </div>
                                )}
                                {task.address && (
                                  <div className="flex items-center">
                                    <MapPin className="h-4 w-4 mr-1" />
                                    {task.address.substring(0, 30)}...
                                  </div>
                                )}
                                {task.assignedToName && (
                                  <div className="flex items-center">
                                    <User className="h-4 w-4 mr-1" />
                                    {task.assignedToName}
                                  </div>
                                )}
                                {task.estimatedAmount && (
                                  <div className="flex items-center">
                                    <DollarSign className="h-4 w-4 mr-1" />
                                    ₹{task.estimatedAmount.toFixed(2)}
                                  </div>
                                )}
                                {task.assignedAt && (
                                  <div className="flex items-center">
                                    <Calendar className="h-4 w-4 mr-1" />
                                    Assigned {formatDistanceToNow(new Date(task.assignedAt), { addSuffix: true })}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center space-x-2 ml-4">
                              {!task.assignedTo && task.status === 'PENDING' && (
                                <Button
                                  size="sm"
                                  onClick={() => onAssignTask(task.id)}
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
                                >
                                  View
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        );
      })}
    </div>
  );
};

