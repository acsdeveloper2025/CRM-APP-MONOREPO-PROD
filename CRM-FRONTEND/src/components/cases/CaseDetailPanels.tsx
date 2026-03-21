import React from 'react';
import {
  Calendar,
  CheckCircle2,
  FormInput,
  Image as ImageIcon,
  Mail,
  Phone,
  RotateCcw,
  User,
  XCircle,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { VerificationTasksManager } from '@/components/verification-tasks';
import { CaseAttachmentsSection } from '@/components/attachments/CaseAttachmentsSection';
import { Badge } from '@/ui/components/Badge';
import { Button } from '@/ui/components/Button';
import { Card } from '@/ui/components/Card';
import { Skeleton } from '@/ui/components/Skeleton';
import { Grid } from '@/ui/layout/Grid';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';

const safeDistance = (value?: string | null) => {
  if (!value) {
    return 'Unknown';
  }
  try {
    return formatDistanceToNow(new Date(value), { addSuffix: true });
  } catch {
    return 'Unknown';
  }
};

export const getCaseStatusVariant = (status: string) => {
  switch (status) {
    case 'COMPLETED':
    case 'APPROVED':
      return 'status-completed' as const;
    case 'IN_PROGRESS':
    case 'ASSIGNED':
      return 'status-progress' as const;
    case 'REJECTED':
      return 'status-revoked' as const;
    default:
      return 'status-pending' as const;
  }
};

export const getCasePriorityVariant = (priority: number | string) => {
  const resolved = typeof priority === 'number' ? priority : String(priority).toUpperCase();
  if (resolved === 4 || resolved === 'URGENT') {
    return 'danger' as const;
  }
  if (resolved === 3 || resolved === 'HIGH') {
    return 'warning' as const;
  }
  if (resolved === 2 || resolved === 'MEDIUM') {
    return 'accent' as const;
  }
  return 'neutral' as const;
};

export const getCasePriorityLabel = (priority: number | string) => {
  if (typeof priority === 'string') {
    return priority.replace('_', ' ');
  }
  const map: Record<number, string> = {
    1: 'LOW',
    2: 'MEDIUM',
    3: 'HIGH',
    4: 'URGENT',
  };
  return map[priority] || 'UNKNOWN';
};

export const CaseHeroPanel = React.memo(function CaseHeroPanel({
  caseItem,
  safeId,
  onApprove,
  onRework,
  onReject,
  onFormSubmissions,
}: {
  caseItem: Record<string, any>;
  safeId: string;
  onApprove: () => void;
  onRework: () => void;
  onReject: () => void;
  onFormSubmissions: () => void;
}) {
  return (
    <Card tone="highlight">
      <Grid min={280} style={{ gridTemplateColumns: 'minmax(0, 1.3fr) minmax(340px, 0.7fr)' }}>
        <Stack gap={4}>
          <Stack gap={2}>
            <Badge variant={getCaseStatusVariant(caseItem.status)}>{String(caseItem.status).replace('_', ' ')}</Badge>
            <Text as="h2" variant="display">{caseItem.customerName || caseItem.applicantName || 'Unnamed case'}</Text>
            <Text variant="body" tone="muted">
              {caseItem.address || 'No address recorded'} {caseItem.pincode ? `• ${caseItem.pincode}` : ''}
            </Text>
          </Stack>

          <div {...{ className: "ui-chip-row" }}>
            <Badge variant={getCasePriorityVariant(caseItem.priority)}>{getCasePriorityLabel(caseItem.priority)}</Badge>
            <Badge variant="accent">{caseItem.clientName || 'No client'}</Badge>
            <Badge variant="neutral">{caseItem.verificationType || 'Verification pending'}</Badge>
          </div>

          <Grid min={180}>
            <Card tone="strong">
              <Stack gap={1}>
                <Text variant="label" tone="soft">Tasks</Text>
                <Text variant="headline">{caseItem.totalTasks || 0}</Text>
                <Text variant="body-sm" tone="muted">
                  {(caseItem.pendingTasks || 0)} pending • {(caseItem.inProgressTasks || 0)} active
                </Text>
              </Stack>
            </Card>
            <Card tone="strong">
              <Stack gap={1}>
                <Text variant="label" tone="soft">Last updated</Text>
                <Text variant="headline">{safeDistance(caseItem.updatedAt)}</Text>
                <Text variant="body-sm" tone="muted">Keep action latency low on cases under review.</Text>
              </Stack>
            </Card>
          </Grid>
        </Stack>

        <Stack gap={3}>
          <Text as="h3" variant="title">Quick actions</Text>
          <Button variant="primary" icon={<CheckCircle2 size={16} />} onClick={onApprove}>
            Approve
          </Button>
          <Button variant="secondary" icon={<RotateCcw size={16} />} onClick={onRework}>
            Mark for rework
          </Button>
          <Button variant="danger" icon={<XCircle size={16} />} onClick={onReject}>
            Reject
          </Button>
          <Button variant="secondary" icon={<FormInput size={16} />} onClick={onFormSubmissions}>
            Open form submissions
          </Button>
          <Text variant="caption" tone="soft">Case reference: {caseItem.caseId || safeId}</Text>
        </Stack>
      </Grid>
    </Card>
  );
});

export const CaseFormDataPanel = React.memo(function CaseFormDataPanel({
  formSubmissionsLoading,
  latestSubmission,
}: {
  formSubmissionsLoading: boolean;
  latestSubmission: any;
}) {
  return (
    <Card tone="strong" staticCard>
      <Stack gap={3}>
        <Text as="h3" variant="headline">Form data</Text>
        {formSubmissionsLoading ? (
          <Stack gap={3}>
            <Skeleton style={{ height: 80, borderRadius: 20 }} />
            <Skeleton style={{ height: 80, borderRadius: 20 }} />
            <Skeleton style={{ height: 80, borderRadius: 20 }} />
          </Stack>
        ) : latestSubmission ? (
          <Stack gap={4}>
            <div {...{ className: "ui-summary-list" }}>
              {latestSubmission.sections.map((section: any) => (
                <Card key={section.id} tone="muted" staticCard>
                  <Stack gap={3}>
                    <Stack gap={1}>
                      <Text as="h4" variant="title">{section.title}</Text>
                      {section.description ? <Text variant="body-sm" tone="muted">{section.description}</Text> : null}
                    </Stack>
                    <div {...{ className: "ui-summary-list" }}>
                      {section.fields.slice(0, 6).map((field: any) => (
                        <div key={field.id} {...{ className: "ui-summary-list__item" }}>
                          <Stack gap={1}>
                            <Text variant="label" tone="soft">{field.label}</Text>
                            <Text variant="body-sm">
                              {field.displayValue || (typeof field.value === 'string' || typeof field.value === 'number'
                                ? String(field.value)
                                : Array.isArray(field.value)
                                  ? field.value.join(', ')
                                  : field.value
                                    ? JSON.stringify(field.value)
                                    : 'Not provided')}
                            </Text>
                          </Stack>
                          <Badge variant="neutral">{field.type}</Badge>
                        </div>
                      ))}
                    </div>
                  </Stack>
                </Card>
              ))}
            </div>
          </Stack>
        ) : (
          <div {...{ className: "ui-empty-state" }}>
            <FormInput size={34} />
            <Text variant="headline">No form data yet</Text>
            <Text variant="body-sm" tone="muted">Form submissions will appear here once field work is completed.</Text>
          </div>
        )}
      </Stack>
    </Card>
  );
});

export const CaseTasksPanel = React.memo(function CaseTasksPanel({
  safeId,
  caseItem,
}: {
  safeId: string;
  caseItem: Record<string, any>;
}) {
  return (
    <Card tone="strong" staticCard>
      <Stack gap={3}>
        <Text as="h3" variant="headline">Verification tasks</Text>
        <VerificationTasksManager
          caseId={safeId}
          caseNumber={caseItem.caseId?.toString()}
          customerName={caseItem.customerName}
          readonly={caseItem.status === 'COMPLETED'}
        />
      </Stack>
    </Card>
  );
});

export const CasePhotosPanel = React.memo(function CasePhotosPanel({
  photos,
}: {
  photos: any[];
}) {
  return (
    <Card tone="strong" staticCard>
      <Stack gap={3}>
        <Text as="h3" variant="headline">Photos</Text>
        {photos.length > 0 ? (
          <div {...{ className: "ui-photo-grid" }}>
            {photos.slice(0, 8).map((photo) => (
              <div key={photo.id} {...{ className: "ui-photo-card" }}>
                <img src={photo.thumbnailUrl || photo.url} alt={photo.type} />
                <div {...{ className: "ui-photo-card__meta" }}>
                  <Stack gap={1}>
                    <Badge variant="accent">{photo.type}</Badge>
                    <Text variant="caption" tone="muted">{photo.submittedByName}</Text>
                    <Text variant="caption">
                      {photo.geoLocation?.latitude?.toFixed(5)}, {photo.geoLocation?.longitude?.toFixed(5)}
                    </Text>
                    <Text variant="caption" tone="muted">
                      {photo.geoLocation?.address || `Accuracy ±${photo.geoLocation?.accuracy || 0}m`}
                    </Text>
                  </Stack>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div {...{ className: "ui-empty-state" }}>
            <ImageIcon size={34} />
            <Text variant="headline">No photos available</Text>
            <Text variant="body-sm" tone="muted">Geo-tagged verification photos will appear once submissions are uploaded.</Text>
          </div>
        )}
      </Stack>
    </Card>
  );
});

export const CaseOperationalSummaryPanel = React.memo(function CaseOperationalSummaryPanel({
  caseItem,
}: {
  caseItem: Record<string, any>;
}) {
  return (
    <Card tone="strong" staticCard>
      <Stack gap={3}>
        <Text as="h3" variant="headline">Operational summary</Text>
        <div {...{ className: "ui-summary-list" }}>
          <div {...{ className: "ui-summary-list__item" }}>
            <Stack gap={1}>
              <Text variant="label" tone="soft">Assigned to</Text>
              <Text variant="body-sm">{caseItem.assignedTo?.name || 'Not assigned'}</Text>
            </Stack>
            <Badge variant={caseItem.assignedTo?.name ? 'status-progress' : 'status-pending'}>
              {caseItem.assignedTo?.name ? 'Assigned' : 'Unassigned'}
            </Badge>
          </div>
          <div {...{ className: "ui-summary-list__item" }}>
            <Stack gap={1}>
              <Text variant="label" tone="soft">Contact</Text>
              <Text variant="body-sm">{caseItem.customerPhone || caseItem.applicantPhone || 'Unavailable'}</Text>
            </Stack>
            <Phone size={16} />
          </div>
          <div {...{ className: "ui-summary-list__item" }}>
            <Stack gap={1}>
              <Text variant="label" tone="soft">Email</Text>
              <Text variant="body-sm">{caseItem.customerEmail || caseItem.applicantEmail || 'Unavailable'}</Text>
            </Stack>
            <Mail size={16} />
          </div>
          <div {...{ className: "ui-summary-list__item" }}>
            <Stack gap={1}>
              <Text variant="label" tone="soft">Created by</Text>
              <Text variant="body-sm">{caseItem.createdByBackendUser?.name || 'System'}</Text>
            </Stack>
            <User size={16} />
          </div>
        </div>
      </Stack>
    </Card>
  );
});

export const CaseAttachmentsPanel = React.memo(function CaseAttachmentsPanel({
  safeId,
}: {
  safeId: string;
}) {
  return (
    <Card tone="strong" staticCard>
      <Stack gap={3}>
        <Text as="h3" variant="headline">Attachments</Text>
        <CaseAttachmentsSection caseId={safeId} />
      </Stack>
    </Card>
  );
});

export const CaseTimelinePanel = React.memo(function CaseTimelinePanel({
  timeline,
}: {
  timeline: Array<{ title: string; detail: string; time?: string }>;
}) {
  return (
    <Card tone="strong" staticCard>
      <Stack gap={3}>
        <Text as="h3" variant="headline">Activity timeline</Text>
        <div {...{ className: "ui-timeline" }}>
          {timeline.map((item, index) => (
            <div key={`${item.title}-${index}`} {...{ className: "ui-timeline-item" }}>
              <Stack gap={1}>
                <Text variant="title">{item.title}</Text>
                <Text variant="body-sm" tone="muted">{item.detail}</Text>
                <Stack direction="horizontal" gap={2} align="center">
                  <Calendar size={14} />
                  <Text variant="caption" tone="soft">{safeDistance(item.time)}</Text>
                </Stack>
              </Stack>
            </div>
          ))}
        </div>
      </Stack>
    </Card>
  );
});
