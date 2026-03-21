import React from 'react';
import { AlertTriangle, ArrowUpDown, ChevronLeft, ChevronRight, Clock, TrendingUp, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MetricCardGrid } from '@/components/shared/MetricCardGrid';
import { PaginationStatusCard } from '@/components/shared/PaginationStatusCard';
import { Badge } from '@/ui/components/Badge';
import { Button } from '@/ui/components/Button';
import { Card } from '@/ui/components/Card';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';
import type { OverdueTask, OverdueTasksResponse } from '@/types/dto/dashboard.dto';
export function tatStatusVariant(status: string): React.ComponentProps<typeof Badge>['variant'] {
    switch (status) {
        case 'ASSIGNED':
            return 'info';
        case 'IN_PROGRESS':
            return 'status-progress';
        case 'PENDING':
            return 'status-pending';
        default:
            return 'neutral';
    }
}
export function tatPriorityVariant(priority: string): React.ComponentProps<typeof Badge>['variant'] {
    switch (priority) {
        case 'URGENT':
            return 'danger';
        case 'HIGH':
            return 'warning';
        case 'MEDIUM':
            return 'accent';
        case 'LOW':
            return 'positive';
        default:
            return 'neutral';
    }
}
export function TATMonitoringSummaryCards({ criticalCount, totalCount, onTrack, avgOverdueDays, completedToday, }: {
    criticalCount: number;
    totalCount: number;
    onTrack: number;
    avgOverdueDays: number;
    completedToday: number;
}) {
    return (<MetricCardGrid items={[
            { title: 'Critical Overdue', value: criticalCount, detail: 'More than 3 days', icon: AlertTriangle, tone: 'danger' },
            { title: 'Total Overdue', value: totalCount, detail: 'More than 1 day', icon: Clock, tone: 'warning' },
            { title: 'On Track', value: onTrack, detail: 'Within TAT', icon: Clock, tone: 'positive' },
            { title: 'Avg TAT', value: `${avgOverdueDays} days`, detail: 'Average overdue', icon: TrendingUp, tone: 'neutral' },
            { title: 'Completed Today', value: completedToday, detail: 'Tasks completed', icon: Clock, tone: 'accent' },
        ]}/>);
}
export function TATMonitoringTable({ tasks, isLoading, pagination, sortBy, onSort, onPageChange, onViewCase, onViewTask, }: {
    tasks: OverdueTask[];
    isLoading: boolean;
    pagination: OverdueTasksResponse['pagination'];
    sortBy: string;
    onSort: (column: string) => void;
    onPageChange: (page: number) => void;
    onViewCase: (caseId: string) => void;
    onViewTask: (taskId: string) => void;
}) {
    if (isLoading) {
        return (<Card staticCard>
        <div {...{ className: "ui-empty-state" }}>
          <Clock size={32}/>
          <Text variant="headline">Loading overdue tasks</Text>
          <Text variant="body-sm" tone="muted">Preparing risk table and overdue metrics.</Text>
        </div>
      </Card>);
    }
    if (tasks.length === 0) {
        return (<Card staticCard>
        <div {...{ className: "ui-empty-state" }}>
          <Clock size={36}/>
          <Text variant="headline">No overdue tasks found</Text>
          <Text variant="body-sm" tone="muted">All tracked tasks are currently within TAT.</Text>
        </div>
      </Card>);
    }
    return (<Stack gap={4}>
      <div {...{ className: "ui-operational-table" }} data-density="compact">
        <div {...{ className: "ui-operational-table__toolbar" }}>
          <Stack gap={1}>
            <Text as="h3" variant="title">SLA risk table</Text>
            <Text variant="body-sm" tone="muted">Sort by customer, priority, or overdue duration to focus intervention.</Text>
          </Stack>
          <Badge variant="warning">{tasks.length} overdue tasks</Badge>
        </div>

        <div {...{ className: "ui-operational-table__scroll" }}>
          <table>
            <thead>
              <tr>
                <SortableHead label="Task Number" active={sortBy === 'task_number'} onClick={() => onSort('task_number')}/>
                <th>Case Number</th>
                <SortableHead label="Customer" active={sortBy === 'customer_name'} onClick={() => onSort('customer_name')}/>
                <th>Verification Type</th>
                <th>Assigned To</th>
                <SortableHead label="Days Overdue" active={sortBy === 'days_overdue'} onClick={() => onSort('days_overdue')}/>
                <SortableHead label="Status" active={sortBy === 'status'} onClick={() => onSort('status')}/>
                <SortableHead label="Priority" active={sortBy === 'priority'} onClick={() => onSort('priority')}/>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (<tr key={task.id} {...{ className: "ui-operational-row" }} data-risk={task.daysOverdue > 3 || task.priority === 'URGENT'}>
                  <td>
                    <Stack gap={1}>
                      <Badge variant="accent">{task.taskNumber}</Badge>
                      <Text variant="caption" tone="muted">{task.daysOverdue} day{task.daysOverdue === 1 ? '' : 's'} overdue</Text>
                    </Stack>
                  </td>
                  <td>
                    <Button variant="ghost" onClick={() => onViewCase(task.caseId)}>
                      {task.caseNumber}
                    </Button>
                  </td>
                  <td><Text variant="body-sm">{task.customerName}</Text></td>
                  <td><Text variant="body-sm">{task.verificationTypeName}</Text></td>
                  <td>
                    <Stack direction="horizontal" gap={2} align="center">
                      <User size={14}/>
                      <Text variant="body-sm">{task.assignedToName || 'Unassigned'}</Text>
                    </Stack>
                  </td>
                  <td>
                    <Text variant="body-sm" tone={task.daysOverdue > 3 ? 'danger' : 'warning'}>
                      {task.daysOverdue} day{task.daysOverdue === 1 ? '' : 's'}
                    </Text>
                  </td>
                  <td><Badge variant={tatStatusVariant(task.status)}>{task.status}</Badge></td>
                  <td><Badge variant={tatPriorityVariant(task.priority)}>{task.priority}</Badge></td>
                  <td>
                    <Button variant="secondary" onClick={() => onViewTask(task.id)}>
                      View Details
                    </Button>
                  </td>
                </tr>))}
            </tbody>
          </table>
        </div>
      </div>

      <PaginationStatusCard page={pagination.page} limit={pagination.limit} total={pagination.totalCount} totalPages={pagination.totalPages} onPrevious={() => onPageChange(pagination.page - 1)} onNext={() => onPageChange(pagination.page + 1)}/>
    </Stack>);
}
function SortableHead({ label, active, onClick, }: {
    label: string;
    active: boolean;
    onClick: () => void;
}) {
    return (<th>
      <button type="button" onClick={onClick} {...{ className: cn('ui-reset-button', active && 'is-active') }} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span>{label}</span>
        <ArrowUpDown size={14}/>
      </button>
    </th>);
}
