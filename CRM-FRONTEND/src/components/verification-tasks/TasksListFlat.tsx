import React, { useState } from 'react';
import {
  UserCheck,
  CheckCircle,
  Clock,
  AlertTriangle,
  X,
  Play,
  Eye,
  ExternalLink,
  MoreHorizontal,
  Copy,
  Edit
} from 'lucide-react';
import { format } from 'date-fns';
import { VerificationTask, TaskStatus } from '@/types/verificationTask';
import { Card } from '@/ui/components/Card';
import { Button } from '@/ui/components/Button';
import { Badge } from '@/ui/components/Badge';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';
import { Skeleton } from '@/ui/components/Skeleton';

interface TasksListFlatProps {
  tasks: VerificationTask[];
  loading: boolean;
  onAssignTask: (taskId: string) => void;
  onViewTask?: (taskId: string) => void;
  onViewCase?: (caseId: string) => void;
  onRevisitTask?: (taskId: string) => void;
  onEditCase?: (caseId: string, taskId?: string) => void;
}

export const TasksListFlat: React.FC<TasksListFlatProps> = ({
  tasks,
  loading,
  onAssignTask,
  onViewTask,
  onViewCase,
  onRevisitTask,
  onEditCase
}) => {
  const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable');

  const getStatusIcon = (status: TaskStatus) => {
    const icons = {
      PENDING: Clock,
      ASSIGNED: UserCheck,
      IN_PROGRESS: Play,
      COMPLETED: CheckCircle,
      ON_HOLD: AlertTriangle,
      REVOKED: X,
      SAVED: Clock
    };
    return icons[status] || Clock;
  };

  const getStatusVariant = (status: TaskStatus) => {
    switch (status) {
      case 'COMPLETED':
        return 'status-completed' as const;
      case 'IN_PROGRESS':
        return 'status-progress' as const;
      case 'REVOKED':
        return 'status-revoked' as const;
      default:
        return 'status-pending' as const;
    }
  };

  const getStatusDot = (status: TaskStatus) => {
    switch (status) {
      case 'COMPLETED':
        return 'completed';
      case 'IN_PROGRESS':
        return 'progress';
      case 'REVOKED':
        return 'danger';
      default:
        return 'pending';
    }
  };

  const getPriorityVariant = (priority: string) => {
    switch (priority) {
      case 'URGENT':
        return 'danger' as const;
      case 'HIGH':
        return 'warning' as const;
      case 'MEDIUM':
        return 'accent' as const;
      default:
        return 'neutral' as const;
    }
  };

  if (loading) {
    return (
      <Card staticCard>
        <Stack gap={3}>
          {Array.from({ length: 6 }).map((_, index) => (
            <Stack key={index} direction="horizontal" gap={3} align="center">
              <Skeleton style={{ width: 120, height: 18, borderRadius: 999 }} />
              <Skeleton style={{ width: '100%', height: 18, borderRadius: 12 }} />
              <Skeleton style={{ width: 90, height: 18, borderRadius: 999 }} />
            </Stack>
          ))}
        </Stack>
      </Card>
    );
  }

  if (tasks.length === 0) {
    return (
      <Card staticCard>
        <div {...{ className: "ui-empty-state" }}>
          <Clock size={36} />
          <Text variant="headline">No tasks found</Text>
          <Text variant="body-sm" tone="muted">
            Try adjusting filters or search terms to surface the work you need.
          </Text>
          {onViewCase ? <Button variant="secondary">Refresh queue context</Button> : null}
        </div>
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

  const formatTime = (dateString: string | null | undefined) => {
    if (!dateString) {return '-';}
    try {
      return format(new Date(dateString), 'hh:mm a');
    } catch {
      return '-';
    }
  };

  return (
    <div {...{ className: "ui-operational-table" }} data-density={density}>
      <div {...{ className: "ui-operational-table__toolbar" }}>
        <Stack gap={1}>
          <Text as="h3" variant="title">Task queue</Text>
          <Text variant="body-sm" tone="muted">Open details with one click and use row actions only when needed.</Text>
        </Stack>
        <Stack direction="horizontal" gap={2} align="center">
          <Badge variant="neutral">{tasks.length} tasks</Badge>
          <Button
            variant={density === 'compact' ? 'primary' : 'secondary'}
            onClick={() => setDensity((current) => (current === 'comfortable' ? 'compact' : 'comfortable'))}
          >
            {density === 'comfortable' ? 'Compact density' : 'Comfortable density'}
          </Button>
        </Stack>
      </div>

      <div {...{ className: "ui-operational-table__scroll" }}>
        <table>
          <thead>
              <tr>
                <th>Task</th>
                <th>Case</th>
                <th>Customer</th>
                <th>Verification</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Assignment</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
          </thead>
          <tbody>
              {tasks.map((task, _index) => {
                const StatusIcon = getStatusIcon(task.status);
                const highRisk = task.priority === 'URGENT' || task.status === 'REVOKED';

                return (
                  <tr
                    key={task.id}
                    {...{ className: "ui-operational-row" }}
                    data-risk={highRisk}
                    onClick={() => onViewTask?.(task.id)}
                  >
                    <td>
                      <Stack gap={1}>
                        <Badge variant="accent">
                          <span {...{ className: "ui-status-dot" }} data-variant={getStatusDot(task.status)} data-pulse={task.priority === 'URGENT'} />
                          {task.taskNumber}
                        </Badge>
                        <Text variant="body-sm">{task.taskTitle}</Text>
                        {task.taskDescription ? <Text variant="caption" tone="muted">{task.taskDescription}</Text> : null}
                      </Stack>
                    </td>

                    <td>
                      <Stack gap={1}>
                        <Text variant="body-sm">{task.caseNumber}</Text>
                        <Text variant="caption" tone="muted">{task.address || '-'}</Text>
                      </Stack>
                    </td>

                    <td>
                      <Stack gap={1}>
                        <Text variant="body-sm">{task.customerName}</Text>
                        <Text variant="caption" tone="muted">{task.applicantType || 'Standard case'}</Text>
                      </Stack>
                    </td>

                    <td>
                      <Stack gap={1}>
                        <Text variant="body-sm">{task.verificationTypeName || '-'}</Text>
                        <Text variant="caption" tone="muted">{task.rateTypeName || 'Default rate'}</Text>
                      </Stack>
                    </td>

                    <td>
                      <Badge variant={getStatusVariant(task.status)}>
                        <StatusIcon size={12} />
                        {task.status.replace('_', ' ')}
                      </Badge>
                    </td>

                    <td>
                      <Badge variant={getPriorityVariant(task.priority)}>
                        {task.priority}
                      </Badge>
                    </td>

                    <td>
                      <Stack gap={1}>
                        <Text variant="body-sm">{task.assignedToName || 'Unassigned'}</Text>
                        <Text variant="caption" tone="muted">{task.assignedByName || 'System'}</Text>
                      </Stack>
                    </td>

                    <td>
                      <Stack gap={1}>
                        <Text variant="body-sm">{task.assignedAt ? formatDate(task.assignedAt) : formatDate(task.createdAt)}</Text>
                        <Text variant="caption" tone="muted">{task.assignedAt ? formatTime(task.assignedAt) : formatTime(task.createdAt)}</Text>
                      </Stack>
                    </td>

                    <td onClick={(event) => event.stopPropagation()}>
                      <div {...{ className: "ui-row-actions" }}>
                        {onViewTask ? (
                          <Button variant="secondary" icon={<Eye size={14} />} onClick={() => onViewTask(task.id)}>
                            View
                          </Button>
                        ) : null}
                        {onViewCase ? (
                          <Button variant="ghost" icon={<ExternalLink size={14} />} onClick={() => onViewCase(task.caseId)}>
                            Case
                          </Button>
                        ) : null}
                        {!task.assignedTo && task.status === 'PENDING' ? (
                          <Button variant="primary" icon={<UserCheck size={14} />} onClick={() => onAssignTask(task.id)}>
                            Assign
                          </Button>
                        ) : null}
                        {onEditCase ? (
                          <Button variant="ghost" icon={<Edit size={14} />} onClick={() => onEditCase(task.caseId, task.id)}>
                            Edit
                          </Button>
                        ) : null}
                        {onRevisitTask && task.status === 'COMPLETED' ? (
                          <Button variant="ghost" icon={<Copy size={14} />} onClick={() => onRevisitTask(task.id)}>
                            Revisit
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
