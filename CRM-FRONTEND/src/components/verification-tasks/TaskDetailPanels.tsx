import React from 'react';
import { format } from 'date-fns';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Edit,
  History,
  MapPin,
  User,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import { Badge } from '@/ui/components/Badge';
import { Button } from '@/ui/components/Button';
import { Card } from '@/ui/components/Card';
import { Grid } from '@/ui/layout/Grid';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';

export interface TaskDetailRecord {
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
  documentType?: string;
  documentNumber?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskAssignmentHistoryItem {
  id: string;
  assignedToName: string;
  assignedByName: string;
  assignedFromName?: string;
  assignedAt: string;
  assignmentReason?: string;
  taskStatusAfter: string;
}

const formatDateTime = (value?: string) => {
  if (!value) {
    return 'N/A';
  }

  try {
    return format(new Date(value), 'dd MMM yyyy, hh:mm a');
  } catch {
    return value;
  }
};

export const getStatusVariant = (status: string) => {
  const map: Record<string, React.ComponentProps<typeof Badge>['variant']> = {
    PENDING: 'status-pending',
    ASSIGNED: 'info',
    IN_PROGRESS: 'status-progress',
    COMPLETED: 'status-completed',
    REVOKED: 'status-revoked',
    ON_HOLD: 'warning',
  };

  return map[status] ?? 'neutral';
};

export const getPriorityVariant = (priority: string) => {
  const map: Record<string, React.ComponentProps<typeof Badge>['variant']> = {
    URGENT: 'danger',
    HIGH: 'warning',
    MEDIUM: 'positive',
    LOW: 'neutral',
  };

  return map[priority] ?? 'neutral';
};

const statusIconMap: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  PENDING: Clock,
  ASSIGNED: User,
  IN_PROGRESS: Clock,
  COMPLETED: CheckCircle2,
  REVOKED: XCircle,
  ON_HOLD: AlertCircle,
};

export const TaskDetailHeader = React.memo(function TaskDetailHeader({
  task,
  onBack,
  onEdit,
}: {
  task: TaskDetailRecord;
  onBack: () => void;
  onEdit: () => void;
}) {
  const StatusIcon = statusIconMap[task.status] ?? Clock;

  return (
    <Card tone="highlight">
      <Grid min={280} style={{ gridTemplateColumns: 'minmax(0, 1.5fr) minmax(280px, 0.8fr)' }}>
        <Stack gap={4}>
          <Stack direction="horizontal" gap={2} align="center" wrap="wrap">
            <Button variant="ghost" icon={<ArrowLeft size={16} />} onClick={onBack}>
              Back to tasks
            </Button>
            <Badge variant="accent">Case {task.caseNumber}</Badge>
            <Badge variant={getStatusVariant(task.status)}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <StatusIcon size={12} />
                {task.status.replace(/_/g, ' ')}
              </span>
            </Badge>
            <Badge variant={getPriorityVariant(task.priority)}>{task.priority}</Badge>
          </Stack>

          <Stack gap={1}>
            <Text as="h1" variant="display">{task.taskNumber}</Text>
            <Text variant="headline">{task.taskTitle}</Text>
            <Text variant="body" tone="muted">
              {task.customerName} • {task.verificationTypeName}
            </Text>
          </Stack>
        </Stack>

        <Stack gap={3} align="stretch">
          <Card tone="strong" staticCard>
            <Stack gap={1}>
              <Text variant="label" tone="soft">Assigned to</Text>
              <Text variant="headline">{task.assignedToName || 'Unassigned'}</Text>
              <Text variant="body-sm" tone="muted">
                {task.assignedAt ? `Assigned ${formatDateTime(task.assignedAt)}` : 'Ready for operator assignment'}
              </Text>
            </Stack>
          </Card>
          <Button variant="secondary" icon={<Edit size={16} />} onClick={onEdit}>
            Edit task
          </Button>
        </Stack>
      </Grid>
    </Card>
  );
});

const SummaryField = React.memo(function SummaryField({
  label,
  value,
  action,
}: {
  label: string;
  value: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <Stack gap={1}>
      <Text variant="label" tone="soft">{label}</Text>
      <Text variant="body-sm">{value}</Text>
      {action}
    </Stack>
  );
});

export const TaskInformationCard = React.memo(function TaskInformationCard({
  task,
  onOpenCase,
}: {
  task: TaskDetailRecord;
  onOpenCase: () => void;
}) {
  return (
    <Card tone="strong" staticCard>
      <Stack gap={4}>
        <Stack gap={1}>
          <Text as="h2" variant="headline">Task Information</Text>
          <Text variant="body-sm" tone="muted">Operational context and core verification metadata.</Text>
        </Stack>

        <Grid min={220}>
          <SummaryField
            label="Case Number"
            value={task.caseNumber}
            action={
              <div>
                <Button variant="ghost" onClick={onOpenCase}>Open case</Button>
              </div>
            }
          />
          <SummaryField label="Customer Name" value={task.customerName} />
          <SummaryField label="Verification Type" value={task.verificationTypeName} />
          <SummaryField label="Rate Type" value={task.rateTypeName || 'N/A'} />
          {task.applicantType ? <SummaryField label="Applicant Type" value={task.applicantType} /> : null}
          {task.trigger ? <SummaryField label="Trigger" value={task.trigger} /> : null}
          {task.documentType ? <SummaryField label="Document Type" value={task.documentType} /> : null}
          {task.documentNumber ? <SummaryField label="Document Number" value={task.documentNumber} /> : null}
        </Grid>

        {task.taskDescription ? (
          <Card tone="muted" staticCard>
            <Stack gap={1}>
              <Text variant="label" tone="soft">Description</Text>
              <Text variant="body-sm">{task.taskDescription}</Text>
            </Stack>
          </Card>
        ) : null}

        {task.address ? (
          <Card tone="muted" staticCard>
            <Stack gap={1}>
              <Text variant="label" tone="soft">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <MapPin size={14} />
                  Address
                </span>
              </Text>
              <Text variant="body-sm">{task.address}</Text>
              {task.pincode ? <Text variant="body-sm" tone="muted">Pincode: {task.pincode}</Text> : null}
            </Stack>
          </Card>
        ) : null}
      </Stack>
    </Card>
  );
});

export const TaskAssignmentHistoryCard = React.memo(function TaskAssignmentHistoryCard({
  history,
}: {
  history: TaskAssignmentHistoryItem[];
}) {
  if (!history.length) {
    return null;
  }

  return (
    <Card staticCard>
      <Stack gap={4}>
        <Stack direction="horizontal" gap={2} align="center">
          <History size={18} />
          <Text as="h2" variant="headline">Assignment History</Text>
        </Stack>

        <Stack gap={3}>
          {history.map((item) => (
            <Card key={item.id} tone="muted" staticCard>
              <Stack gap={2}>
                <Text variant="body-sm">
                  Assigned to {item.assignedToName}
                  {item.assignedFromName ? ` (from ${item.assignedFromName})` : ''}
                </Text>
                <Text variant="caption" tone="muted">
                  By {item.assignedByName} • {formatDateTime(item.assignedAt)}
                </Text>
                <Stack direction="horizontal" gap={2} align="center" wrap="wrap">
                  <Badge variant={getStatusVariant(item.taskStatusAfter)}>{item.taskStatusAfter.replace(/_/g, ' ')}</Badge>
                  {item.assignmentReason ? <Text variant="caption" tone="muted">Reason: {item.assignmentReason}</Text> : null}
                </Stack>
              </Stack>
            </Card>
          ))}
        </Stack>
      </Stack>
    </Card>
  );
});

export const TaskSidebar = React.memo(function TaskSidebar({
  task,
}: {
  task: TaskDetailRecord;
}) {
  const hasFinancialData = Boolean(
    (task.estimatedAmount ?? 0) > 0 ||
    (task.actualAmount ?? 0) > 0 ||
    (task.calculatedCommission ?? 0) > 0
  );

  return (
    <Stack gap={4}>
      <Card tone="strong" staticCard>
        <Stack gap={3}>
          <Text as="h3" variant="title">Task Status</Text>
          <Stack gap={2}>
            <Text variant="label" tone="soft">Current Status</Text>
            <div>
              <Badge variant={getStatusVariant(task.status)}>{task.status.replace(/_/g, ' ')}</Badge>
            </div>
          </Stack>
          <Stack gap={2}>
            <Text variant="label" tone="soft">Priority</Text>
            <div>
              <Badge variant={getPriorityVariant(task.priority)}>{task.priority}</Badge>
            </div>
          </Stack>
        </Stack>
      </Card>

      <Card staticCard>
        <Stack gap={3}>
          <Text as="h3" variant="title">Assignment</Text>
          {task.assignedToName ? (
            <>
              <SummaryField label="Assigned To" value={task.assignedToName} />
              {task.assignedToEmployeeId ? <SummaryField label="Employee ID" value={task.assignedToEmployeeId} /> : null}
              {task.assignedByName ? <SummaryField label="Assigned By" value={task.assignedByName} /> : null}
              {task.assignedAt ? <SummaryField label="Assignment Time" value={formatDateTime(task.assignedAt)} /> : null}
            </>
          ) : (
            <Text variant="body-sm" tone="muted">Not assigned yet.</Text>
          )}
        </Stack>
      </Card>

      <Card staticCard>
        <Stack gap={3}>
          <Text as="h3" variant="title">Timeline</Text>
          <SummaryField label="Created" value={formatDateTime(task.createdAt)} />
          {task.assignedAt ? <SummaryField label="Assigned" value={formatDateTime(task.assignedAt)} /> : null}
          {task.startedAt ? <SummaryField label="Started" value={formatDateTime(task.startedAt)} /> : null}
          {task.completedAt ? <SummaryField label="Completed" value={formatDateTime(task.completedAt)} /> : null}
          <SummaryField label="Last Updated" value={formatDateTime(task.updatedAt)} />
        </Stack>
      </Card>

      {hasFinancialData ? (
        <Card staticCard>
          <Stack gap={3}>
            <Text as="h3" variant="title">Financial</Text>
            {(task.estimatedAmount ?? 0) > 0 ? (
              <SummaryField label="Estimated Amount" value={`₹${task.estimatedAmount?.toFixed(2)}`} />
            ) : null}
            {(task.actualAmount ?? 0) > 0 ? (
              <SummaryField label="Actual Amount" value={`₹${task.actualAmount?.toFixed(2)}`} />
            ) : null}
            {(task.calculatedCommission ?? 0) > 0 ? (
              <Stack gap={1}>
                <SummaryField label="Commission" value={`₹${task.calculatedCommission?.toFixed(2)}`} />
                {task.commissionStatus ? <Badge variant="info">{task.commissionStatus}</Badge> : null}
              </Stack>
            ) : null}
          </Stack>
        </Card>
      ) : null}
    </Stack>
  );
});
