import {
  AlertCircle,
  BarChart3,
  Camera,
  CheckCircle,
  Clock,
  Download,
  Eye,
  FileText,
  Grid,
  MapPin,
  Smartphone,
  User,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/ui/components/Badge';
import { Button } from '@/ui/components/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/components/Card';
import { Box } from '@/ui/primitives/Box';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';
import { FormSubmission } from '@/types/form';
import { FormAttachmentsViewer } from './FormAttachmentsViewer';
import { FormFieldViewer } from './FormFieldViewer';
import { FormLocationViewer } from './FormLocationViewer';
import { FormPhotosGallery } from './FormPhotosGallery';
import VerificationImages from '@/components/VerificationImages';

interface EnhancedFormViewerProps {
  submission: FormSubmission;
  readonly?: boolean;
  showAttachments?: boolean;
  showPhotos?: boolean;
  showLocation?: boolean;
  showMetadata?: boolean;
  onFieldChange?: (fieldId: string, value: unknown) => void;
  onSectionToggle?: (sectionId: string, expanded: boolean) => void;
}

const surfaceStyle = {
  border: '1px solid var(--ui-border)',
  borderRadius: 'var(--ui-radius-lg)',
  background: 'var(--ui-surface)',
};

const subtleSurfaceStyle = {
  border: '1px solid var(--ui-border)',
  borderRadius: 'var(--ui-radius-lg)',
  background: 'var(--ui-surface-muted)',
};

function getOutcomeTone(outcome: string): 'positive' | 'danger' | 'warning' | 'muted' {
  switch (outcome.toLowerCase()) {
    case 'positive':
      return 'positive';
    case 'negative':
      return 'danger';
    case 'nsp':
      return 'warning';
    default:
      return 'muted';
  }
}

function getStatusVariant(status: string) {
  switch (status) {
    case 'APPROVED':
    case 'COMPLETED':
      return 'status-completed' as const;
    case 'UNDER_REVIEW':
    case 'SUBMITTED':
      return 'status-progress' as const;
    case 'REJECTED':
      return 'danger' as const;
    default:
      return 'warning' as const;
  }
}

function getValidationVariant(status: string) {
  switch (status) {
    case 'VALID':
      return 'positive' as const;
    case 'INVALID':
      return 'danger' as const;
    case 'WARNING':
      return 'warning' as const;
    default:
      return 'neutral' as const;
  }
}

function getFormTypeLabel(formType: string) {
  return formType
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function getNetworkIcon(type: string) {
  if (type === 'OFFLINE') {
    return <WifiOff size={16} style={{ color: 'var(--ui-danger)' }} />;
  }
  return <Wifi size={16} style={{ color: 'var(--ui-accent)' }} />;
}

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <Box style={{ ...surfaceStyle, padding: '1rem' }}>
      <Stack direction="horizontal" gap={3} align="center">
        <Box
          style={{
            width: '2.5rem',
            height: '2.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '0.9rem',
            background: 'rgba(17, 116, 110, 0.12)',
            color: 'var(--ui-accent)',
            flexShrink: 0,
          }}
        >
          {icon}
        </Box>
        <Stack gap={1}>
          <Text variant="caption" tone="muted">{label}</Text>
          <Text variant="title">{value}</Text>
        </Stack>
      </Stack>
    </Box>
  );
}

export function FormViewer({
  submission,
  readonly = true,
  showAttachments = true,
  showPhotos = true,
  showLocation = true,
  showMetadata = true,
  onFieldChange,
}: EnhancedFormViewerProps) {
  const submittedAt = submission.submittedAt && !isNaN(new Date(submission.submittedAt).getTime())
    ? new Date(submission.submittedAt)
    : null;

  return (
    <Stack gap={6}>
      <Card tone="highlight">
        <CardHeader>
          <Box
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: '1rem',
              flexWrap: 'wrap',
            }}
          >
            <Stack direction="horizontal" gap={4} align="flex-start">
              <Box
                style={{
                  width: '4rem',
                  height: '4rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '1.25rem',
                  background: 'rgba(17, 116, 110, 0.12)',
                  color: 'var(--ui-accent)',
                  flexShrink: 0,
                }}
              >
                <FileText size={28} />
              </Box>
              <Stack gap={2}>
                <CardTitle>{getFormTypeLabel(submission.formType)} Verification</CardTitle>
                <CardDescription>{submission.verificationType}</CardDescription>
                <Stack direction="horizontal" gap={3} align="center" wrap="wrap">
                  <Text variant="label" tone={getOutcomeTone(submission.outcome)}>{submission.outcome}</Text>
                  <Stack direction="horizontal" gap={1} align="center">
                    <User size={14} />
                    <Text variant="body-sm" tone="muted">Agent: {submission.submittedByName}</Text>
                  </Stack>
                  <Stack direction="horizontal" gap={1} align="center">
                    <Clock size={14} />
                    <Text variant="body-sm" tone="muted">
                      {submittedAt ? formatDistanceToNow(submittedAt, { addSuffix: true }) : 'Unknown time'}
                    </Text>
                  </Stack>
                  <Stack direction="horizontal" gap={1} align="center">
                    <Camera size={14} />
                    <Text variant="body-sm" tone="muted">{submission.photos?.length || 0} photos</Text>
                  </Stack>
                </Stack>
              </Stack>
            </Stack>

            <Stack gap={2} align="flex-end">
              <Stack direction="horizontal" gap={2} wrap="wrap" justify="flex-end">
                <Badge variant={getStatusVariant(submission.status)}>{submission.status.replaceAll('_', ' ')}</Badge>
                <Badge variant={getValidationVariant(submission.validationStatus)}>{submission.validationStatus}</Badge>
              </Stack>
              <Badge variant="accent">Case #{submission.caseId}</Badge>
            </Stack>
          </Box>
        </CardHeader>
      </Card>

      <Box style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <MetricCard icon={<FileText size={18} />} label="Form Sections" value={submission.sections.length} />
        <MetricCard icon={<Camera size={18} />} label="Photos Captured" value={submission.photos?.length || 0} />
        <MetricCard
          icon={<MapPin size={18} />}
          label="GPS Accuracy"
          value={submission.geoLocation?.accuracy ? `±${submission.geoLocation.accuracy}m` : 'N/A'}
        />
        <MetricCard
          icon={<Smartphone size={18} />}
          label="Platform"
          value={submission.metadata?.deviceInfo?.platform || 'Unknown'}
        />
      </Box>

      <Box style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: 'minmax(0, 2fr) minmax(280px, 1fr)' }}>
        <Stack gap={6}>
          <Card>
            <CardHeader>
              <CardTitle>
                <Stack direction="horizontal" gap={2} align="center">
                  <Grid size={18} />
                  <span>Form Data</span>
                </Stack>
              </CardTitle>
              <CardDescription>Complete submission values by section</CardDescription>
            </CardHeader>
            <CardContent>
              <Stack gap={4}>
                {submission.sections.map((section, sectionIndex) => (
                  <Box key={section.id} style={surfaceStyle}>
                    <Box
                      style={{
                        padding: '1rem 1.25rem',
                        borderBottom: '1px solid var(--ui-border)',
                        background: 'var(--ui-surface-muted)',
                      }}
                    >
                      <Stack gap={2}>
                        <Stack direction="horizontal" gap={2} align="center" justify="space-between" wrap="wrap">
                          <Stack direction="horizontal" gap={2} align="center">
                            <Box
                              style={{
                                width: '1.9rem',
                                height: '1.9rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '999px',
                                background: 'var(--ui-accent)',
                                color: '#fff',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                              }}
                            >
                              {sectionIndex + 1}
                            </Box>
                            <Text as="h3" variant="title">{section.title}</Text>
                          </Stack>
                          <Badge variant="outline">{section.fields.length} fields</Badge>
                        </Stack>
                        {section.description ? <Text variant="body-sm" tone="muted">{section.description}</Text> : null}
                      </Stack>
                    </Box>

                    <Box style={{ padding: '1rem 1.25rem' }}>
                      <Box style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
                        {section.fields.map((field, fieldIndex) => (
                          <Box key={field.id} style={{ ...subtleSurfaceStyle, padding: '1rem' }}>
                            <Stack gap={3}>
                              <Box
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'flex-start',
                                  gap: '0.75rem',
                                  flexWrap: 'wrap',
                                }}
                              >
                                <Stack direction="horizontal" gap={2} align="center">
                                  <Box
                                    style={{
                                      width: '1.5rem',
                                      height: '1.5rem',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      borderRadius: '999px',
                                      background: 'var(--ui-surface)',
                                      border: '1px solid var(--ui-border)',
                                      fontSize: '0.75rem',
                                      fontWeight: 600,
                                      flexShrink: 0,
                                    }}
                                  >
                                    {fieldIndex + 1}
                                  </Box>
                                  <Text as="label" variant="label">
                                    {field.label}
                                    {field.isRequired ? (
                                      <Text as="span" variant="label" tone="danger" style={{ marginLeft: '0.25rem' }}>*</Text>
                                    ) : null}
                                  </Text>
                                </Stack>
                                <Badge variant="outline">{field.type.toUpperCase()}</Badge>
                              </Box>

                              <Box style={{ ...surfaceStyle, padding: '0.875rem' }}>
                                <FormFieldViewer
                                  field={field}
                                  readonly={true}
                                  onChange={(value) => onFieldChange?.(field.id, value)}
                                />
                              </Box>

                              {field.validation ? (
                                <Stack direction="horizontal" gap={1} align="center">
                                  <Badge variant={field.validation.isValid ? 'positive' : 'danger'}>
                                    <Stack direction="horizontal" gap={1} align="center">
                                      {field.validation.isValid ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
                                      <span>{field.validation.isValid ? 'Valid' : 'Invalid'}</span>
                                    </Stack>
                                  </Badge>
                                </Stack>
                              ) : null}
                            </Stack>
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>

          {showPhotos && submission.photos && submission.photos.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>
                  <Stack direction="horizontal" gap={2} align="center">
                    <Camera size={18} />
                    <span>Verification Photos ({submission.photos.length})</span>
                  </Stack>
                </CardTitle>
                <CardDescription>Photos captured during verification</CardDescription>
              </CardHeader>
              <CardContent>
                <FormPhotosGallery photos={submission.photos} />
              </CardContent>
            </Card>
          ) : null}
        </Stack>

        <Stack gap={6}>
          <Card>
            <CardHeader>
              <CardTitle>
                <Stack direction="horizontal" gap={2} align="center">
                  <BarChart3 size={18} />
                  <span>Summary</span>
                </Stack>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Stack gap={3}>
                <Box style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                  <Text variant="body-sm" tone="muted">Status</Text>
                  <Badge variant={getStatusVariant(submission.status)}>{submission.status.replaceAll('_', ' ')}</Badge>
                </Box>
                <Box style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                  <Text variant="body-sm" tone="muted">Outcome</Text>
                  <Text variant="label" tone={getOutcomeTone(submission.outcome)}>{submission.outcome}</Text>
                </Box>
                <Box style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                  <Text variant="body-sm" tone="muted">Validation</Text>
                  <Badge variant={getValidationVariant(submission.validationStatus)}>{submission.validationStatus}</Badge>
                </Box>
                <Box style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                  <Text variant="body-sm" tone="muted">Sections</Text>
                  <Text variant="label">{submission.sections.length}</Text>
                </Box>
              </Stack>
            </CardContent>
          </Card>

          {showMetadata ? (
            <Card>
              <CardHeader>
                <CardTitle>
                  <Stack direction="horizontal" gap={2} align="center">
                    <Smartphone size={18} />
                    <span>Device Info</span>
                  </Stack>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Stack gap={3}>
                  <Box>
                    <Text variant="caption" tone="muted">Platform</Text>
                    <Text variant="body-sm">{submission.metadata?.deviceInfo?.platform || 'Unknown'}</Text>
                  </Box>
                  <Box>
                    <Text variant="caption" tone="muted">App Version</Text>
                    <Text variant="body-sm">v{submission.metadata?.deviceInfo?.appVersion || 'Unknown'}</Text>
                  </Box>
                  <Box>
                    <Text variant="caption" tone="muted">Network</Text>
                    <Stack direction="horizontal" gap={2} align="center">
                      {getNetworkIcon(submission.metadata?.networkInfo?.type || 'WIFI')}
                      <Text variant="body-sm">{submission.metadata?.networkInfo?.type || 'Unknown'}</Text>
                    </Stack>
                  </Box>
                  <Box>
                    <Text variant="caption" tone="muted">Form Version</Text>
                    <Text variant="body-sm">{submission.metadata?.formVersion || 'Unknown'}</Text>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          ) : null}

          {submission.validationErrors && submission.validationErrors.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>
                  <Stack direction="horizontal" gap={2} align="center">
                    <AlertCircle size={18} style={{ color: 'var(--ui-danger)' }} />
                    <span>Validation Issues</span>
                  </Stack>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Stack gap={2}>
                  {submission.validationErrors.map((error, index) => (
                    <Stack key={index} direction="horizontal" gap={2} align="flex-start">
                      <Text variant="body-sm" tone="danger">•</Text>
                      <Text variant="body-sm" tone="danger">{error}</Text>
                    </Stack>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          ) : null}
        </Stack>
      </Box>

      <Card tone="strong">
        <CardHeader>
          <CardTitle>
            <Stack direction="horizontal" gap={2} align="center">
              <FileText size={20} />
              <span>Form as Submitted by Field Agent</span>
            </Stack>
          </CardTitle>
          <CardDescription>
            Exact submission captured by {submission.submittedByName} on {submittedAt ? submittedAt.toLocaleDateString() : 'Unknown date'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Stack gap={6}>
            <Box style={{ ...subtleSurfaceStyle, padding: '1.5rem' }}>
              <Stack gap={4}>
                <Text as="h2" variant="headline" style={{ textAlign: 'center' }}>
                  {getFormTypeLabel(submission.formType)} Verification Form
                </Text>
                <Box style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                  <Box style={{ ...surfaceStyle, padding: '1rem' }}>
                    <Text variant="caption" tone="muted">Case ID</Text>
                    <Text variant="title" tone="accent">{submission.caseId}</Text>
                  </Box>
                  <Box style={{ ...surfaceStyle, padding: '1rem' }}>
                    <Text variant="caption" tone="muted">Field Agent</Text>
                    <Text variant="title">{submission.submittedByName}</Text>
                  </Box>
                  <Box style={{ ...surfaceStyle, padding: '1rem' }}>
                    <Text variant="caption" tone="muted">Verification Outcome</Text>
                    <Text variant="title" tone={getOutcomeTone(submission.outcome)}>{submission.outcome}</Text>
                  </Box>
                  <Box style={{ ...surfaceStyle, padding: '1rem' }}>
                    <Text variant="caption" tone="muted">Total Images</Text>
                    <Text variant="title" tone="accent">{submission.photos?.length || 0} photos</Text>
                  </Box>
                </Box>
                <Stack direction="horizontal" gap={2} align="center" justify="center" wrap="wrap">
                  <Clock size={16} />
                  <Text variant="body-sm" tone="muted">
                    Submitted on {submittedAt ? submittedAt.toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    }) : 'Unknown date'} at {submittedAt ? submittedAt.toLocaleTimeString() : 'Unknown time'}
                  </Text>
                </Stack>
              </Stack>
            </Box>

            <Stack gap={4}>
              {submission.sections.map((section, sectionIndex) => (
                <Box key={section.id} style={surfaceStyle}>
                  <Box
                    style={{
                      padding: '1rem 1.25rem',
                      borderBottom: '1px solid var(--ui-border)',
                      background: 'linear-gradient(90deg, rgba(17,116,110,0.08), rgba(17,116,110,0.02))',
                    }}
                  >
                    <Stack gap={2}>
                      <Stack direction="horizontal" gap={2} align="center" justify="space-between" wrap="wrap">
                        <Stack direction="horizontal" gap={2} align="center">
                          <Box
                            style={{
                              width: '2rem',
                              height: '2rem',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: '999px',
                              background: 'var(--ui-accent)',
                              color: '#fff',
                              fontWeight: 700,
                              fontSize: '0.8rem',
                            }}
                          >
                            {sectionIndex + 1}
                          </Box>
                          <Text as="h3" variant="title">{section.title}</Text>
                        </Stack>
                        <Badge variant="outline">{section.fields.length} fields</Badge>
                      </Stack>
                      {section.description ? <Text variant="body-sm" tone="muted">{section.description}</Text> : null}
                    </Stack>
                  </Box>

                  <Box style={{ padding: '1.25rem' }}>
                    <Box style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
                      {section.fields.map((field, fieldIndex) => (
                        <Box key={field.id} style={{ ...subtleSurfaceStyle, padding: '1rem' }}>
                          <Stack gap={3}>
                            <Box
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'flex-start',
                                gap: '0.75rem',
                                flexWrap: 'wrap',
                              }}
                            >
                              <Stack direction="horizontal" gap={2} align="center">
                                <Box
                                  style={{
                                    width: '1.65rem',
                                    height: '1.65rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRadius: '999px',
                                    background: 'var(--ui-surface)',
                                    border: '1px solid var(--ui-border)',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                  }}
                                >
                                  {fieldIndex + 1}
                                </Box>
                                <Text as="label" variant="label">
                                  {field.label}
                                  {field.isRequired ? (
                                    <Text as="span" variant="label" tone="danger" style={{ marginLeft: '0.25rem' }}>*</Text>
                                  ) : null}
                                </Text>
                              </Stack>
                              <Badge variant="neutral">{field.type}</Badge>
                            </Box>

                            <Box style={{ ...surfaceStyle, padding: '1rem', minHeight: '3.25rem' }}>
                              <FormFieldViewer
                                field={field}
                                readonly={true}
                                onChange={(value) => onFieldChange?.(field.id, value)}
                              />
                            </Box>

                            {field.validation ? (
                              <Badge variant={field.validation.isValid ? 'positive' : 'danger'}>
                                {field.validation.isValid ? 'Valid' : 'Invalid'}
                              </Badge>
                            ) : null}
                          </Stack>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                </Box>
              ))}
            </Stack>

            <Box style={{ ...subtleSurfaceStyle, padding: '1.5rem' }}>
              <Stack gap={4}>
                <Text as="h4" variant="title">
                  <Stack direction="horizontal" gap={2} align="center">
                    <FileText size={18} />
                    <span>Form Submission Summary</span>
                  </Stack>
                </Text>
                <Box style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                  <Box style={{ ...surfaceStyle, padding: '1rem' }}>
                    <Text variant="caption" tone="muted">Status</Text>
                    <Box style={{ marginTop: '0.5rem' }}>
                      <Badge variant={getStatusVariant(submission.status)}>{submission.status.replaceAll('_', ' ')}</Badge>
                    </Box>
                  </Box>
                  <Box style={{ ...surfaceStyle, padding: '1rem' }}>
                    <Text variant="caption" tone="muted">Verification Outcome</Text>
                    <Text variant="title" tone={getOutcomeTone(submission.outcome)}>{submission.outcome}</Text>
                  </Box>
                  <Box style={{ ...surfaceStyle, padding: '1rem' }}>
                    <Text variant="caption" tone="muted">Validation Status</Text>
                    <Box style={{ marginTop: '0.5rem' }}>
                      <Badge variant={getValidationVariant(submission.validationStatus)}>{submission.validationStatus}</Badge>
                    </Box>
                  </Box>
                  <Box style={{ ...surfaceStyle, padding: '1rem' }}>
                    <Text variant="caption" tone="muted">Form Sections</Text>
                    <Text variant="title" tone="accent">{submission.sections.length} sections</Text>
                  </Box>
                </Box>

                {submission.metadata ? (
                  <Box style={{ ...surfaceStyle, padding: '1rem' }}>
                    <Stack gap={3}>
                      <Text variant="label">Submission Metadata</Text>
                      <Box style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                        <Text variant="body-sm" tone="muted">
                          <strong>Platform:</strong> {submission.metadata.deviceInfo?.platform || 'Unknown'}
                        </Text>
                        <Text variant="body-sm" tone="muted">
                          <strong>App Version:</strong> {submission.metadata.deviceInfo?.appVersion || 'Unknown'}
                        </Text>
                        <Text variant="body-sm" tone="muted">
                          <strong>Network:</strong> {submission.metadata.networkInfo?.type || 'Unknown'}
                        </Text>
                        <Text variant="body-sm" tone="muted">
                          <strong>Submission Attempts:</strong> {submission.metadata.submissionAttempts || 1}
                        </Text>
                      </Box>
                    </Stack>
                  </Box>
                ) : null}
              </Stack>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      {submission.caseId ? (
        <VerificationImages
          caseId={submission.caseId}
          submissionId={submission.id}
          title="Captured Verification Images"
          showStats={true}
          submissionAddress={submission.geoLocation?.address}
        />
      ) : null}

      {showAttachments && submission.attachments.length > 0 ? (
        <FormAttachmentsViewer attachments={submission.attachments} readonly={readonly} />
      ) : null}

      {showLocation && submission.geoLocation ? (
        <FormLocationViewer location={submission.geoLocation} readonly={readonly} />
      ) : null}

      {submission.reviewNotes ? (
        <Card>
          <CardHeader>
            <CardTitle>
              <Stack direction="horizontal" gap={2} align="center">
                <Eye size={18} />
                <span>Review Comments</span>
              </Stack>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Box style={{ ...subtleSurfaceStyle, padding: '1rem' }}>
              <Stack gap={3}>
                <Text variant="body-sm" style={{ whiteSpace: 'pre-wrap' }}>{submission.reviewNotes}</Text>
                {submission.reviewedBy && submission.reviewedAt ? (
                  <Box
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '1rem',
                      flexWrap: 'wrap',
                      paddingTop: '0.75rem',
                      borderTop: '1px solid var(--ui-border)',
                    }}
                  >
                    <Stack direction="horizontal" gap={1} align="center">
                      <User size={12} />
                      <Text variant="caption" tone="muted">Reviewed by {submission.reviewedBy}</Text>
                    </Stack>
                    <Stack direction="horizontal" gap={1} align="center">
                      <Clock size={12} />
                      <Text variant="caption" tone="muted">{new Date(submission.reviewedAt).toLocaleString()}</Text>
                    </Stack>
                  </Box>
                ) : null}
              </Stack>
            </Box>
          </CardContent>
        </Card>
      ) : null}

      {!readonly ? (
        <Card>
          <CardContent>
            <Box
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '1rem',
                flexWrap: 'wrap',
              }}
            >
              <Text variant="body-sm" tone="muted">
                Last updated: {new Date(submission.submittedAt).toLocaleString()}
              </Text>
              <Stack direction="horizontal" gap={2} wrap="wrap">
                <Button variant="outline" icon={<Download size={16} />}>Export PDF</Button>
                <Button variant="outline" icon={<FileText size={16} />}>Print Form</Button>
              </Stack>
            </Box>
          </CardContent>
        </Card>
      ) : null}
    </Stack>
  );
}
