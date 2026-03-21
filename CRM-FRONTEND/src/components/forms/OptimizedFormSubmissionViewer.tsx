import React, { useState } from 'react';
import {
  Calendar,
  Camera,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  Smartphone,
  User,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { Badge } from '@/ui/components/badge';
import { Button } from '@/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/components/card';
import { Box } from '@/ui/primitives/Box';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';
import { FormField, FormSubmission } from '@/types/form';
import VerificationImages from '@/components/VerificationImages';
import { TemplateReportCard } from '@/components/forms/TemplateReportCard';

interface OptimizedFormSubmissionViewerProps {
  submission: FormSubmission;
  caseId: string;
}

const surfaceStyle = {
  border: '1px solid var(--ui-border)',
  borderRadius: 'var(--ui-radius-lg)',
  background: 'var(--ui-surface)',
};

function getStatusVariant(status: string) {
  switch (status) {
    case 'COMPLETED':
    case 'APPROVED':
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

const getFieldValue = (field: FormField): React.ReactNode => {
  if (field.displayValue) {
    return field.displayValue;
  }

  const val = field.value;
  if (val === null || val === undefined || val === '') {
    return null;
  }

  if (typeof val === 'string' || typeof val === 'number') {
    return val;
  }

  if (typeof val === 'boolean') {
    return val ? 'Yes' : 'No';
  }

  if (Array.isArray(val)) {
    return val.join(', ');
  }

  if (typeof val === 'object') {
    const objVal = val as Record<string, unknown>;
    if ('url' in objVal && typeof objVal.url === 'string') {
      return (
        <a
          href={objVal.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--ui-accent)', textDecoration: 'underline' }}
        >
          View File
        </a>
      );
    }

    try {
      return JSON.stringify(val);
    } catch {
      return '[Complex Object]';
    }
  }

  return String(val);
};

export const OptimizedFormSubmissionViewer: React.FC<OptimizedFormSubmissionViewerProps> = ({
  submission,
  caseId,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const getFormTypeLabel = (formType: string) => formType.replace('_', ' ').toUpperCase();

  const submissionDate = (() => {
    const dateStr = submission.submittedAt || submission.metadata?.submissionTimestamp;
    if (!dateStr) {
      return null;
    }
    const cleanDateStr = dateStr.replace(/T00:00:00\.000Z$/, '').replace(/GMT\+0530 \(India Standard Time\)/, '');
    const date = new Date(cleanDateStr);
    return isNaN(date.getTime()) ? null : date;
  })();

  const agentName = submission.submittedByName || submission.submittedBy || 'Unknown Agent';
  const formSections = submission.sections || [];
  const totalFields = formSections.reduce((total, section) => total + (section.fields?.length || 0), 0);

  const verificationOutcome = (() => {
    if (submission.outcome) {
      return submission.outcome;
    }
    if (submission.formType) {
      return submission.formType;
    }
    const field = formSections.flatMap((s) => s.fields || []).find(
      (f) =>
        f.id === 'finalStatus' ||
        f.id === 'verification_outcome' ||
        f.label?.toLowerCase().includes('outcome') ||
        f.label?.toLowerCase().includes('final status'),
    );
    if (field?.value && typeof field.value === 'string') {
      return field.value;
    }
    return 'Not specified';
  })();

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
            <Stack direction="horizontal" gap={3} align="center">
              <Box
                style={{
                  width: '3rem',
                  height: '3rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '1rem',
                  background: 'rgba(17, 116, 110, 0.12)',
                  color: 'var(--ui-accent)',
                  flexShrink: 0,
                }}
              >
                <FileText size={20} />
              </Box>
              <Stack gap={2}>
                <CardTitle>{getFormTypeLabel(submission.formType)} Verification</CardTitle>
                <Stack direction="horizontal" gap={2} align="center" wrap="wrap">
                  <Badge variant={getStatusVariant(submission.status)}>{submission.status.toUpperCase()}</Badge>
                  <Badge variant={getValidationVariant(submission.validationStatus)}>{submission.validationStatus.toUpperCase()}</Badge>
                  <Badge variant="accent">Outcome: {verificationOutcome.toUpperCase()}</Badge>
                </Stack>
              </Stack>
            </Stack>

            <Button
              variant="outline"
              onClick={() => setIsExpanded((value) => !value)}
              icon={isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            >
              {isExpanded ? 'Collapse' : 'Expand'} Details
            </Button>
          </Box>
        </CardHeader>

        <CardContent>
          <Stack gap={4}>
            <Box style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
              <Box style={{ ...surfaceStyle, padding: '1rem' }}>
                <Stack direction="horizontal" gap={2} align="center">
                  <User size={16} />
                  <Stack gap={1}>
                    <Text variant="caption" tone="muted">Agent</Text>
                    <Text variant="body-sm">{agentName}</Text>
                  </Stack>
                </Stack>
              </Box>

              <Box style={{ ...surfaceStyle, padding: '1rem' }}>
                <Stack direction="horizontal" gap={2} align="center">
                  <Clock size={16} />
                  <Stack gap={1}>
                    <Text variant="caption" tone="muted">Submitted</Text>
                    <Text variant="body-sm">
                      {submissionDate ? formatDistanceToNow(submissionDate, { addSuffix: true }) : 'Unknown time'}
                    </Text>
                  </Stack>
                </Stack>
              </Box>

              <Box style={{ ...surfaceStyle, padding: '1rem' }}>
                <Stack direction="horizontal" gap={2} align="center">
                  <Camera size={16} />
                  <Stack gap={1}>
                    <Text variant="caption" tone="muted">Photos</Text>
                    <Text variant="body-sm">{submission.photos?.length || 0} captured</Text>
                  </Stack>
                </Stack>
              </Box>

              <Box style={{ ...surfaceStyle, padding: '1rem' }}>
                <Stack direction="horizontal" gap={2} align="center">
                  <FileText size={16} />
                  <Stack gap={1}>
                    <Text variant="caption" tone="muted">Form Data</Text>
                    <Text variant="body-sm">{formSections.length} sections, {totalFields} fields</Text>
                  </Stack>
                </Stack>
              </Box>
            </Box>

            <Box
              style={{
                display: 'grid',
                gap: '1rem',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                paddingTop: '1rem',
                borderTop: '1px solid var(--ui-border)',
              }}
            >
              <Box style={{ ...surfaceStyle, padding: '1rem' }}>
                <Stack direction="horizontal" gap={2} align="center">
                  <Calendar size={16} />
                  <Stack gap={1}>
                    <Text variant="caption" tone="muted">Full Date & Time</Text>
                    <Text variant="body-sm">
                      {submissionDate ? format(submissionDate, 'MMM dd, yyyy HH:mm') : 'Unknown date'}
                    </Text>
                  </Stack>
                </Stack>
              </Box>

              <Box style={{ ...surfaceStyle, padding: '1rem' }}>
                <Stack direction="horizontal" gap={2} align="center">
                  <Smartphone size={16} />
                  <Stack gap={1}>
                    <Text variant="caption" tone="muted">Platform</Text>
                    <Text variant="body-sm">{submission.metadata?.deviceInfo?.platform || 'Unknown'}</Text>
                  </Stack>
                </Stack>
              </Box>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      {isExpanded ? (
        <Stack gap={6}>
          {formSections.length > 0 ? (
            <Stack gap={4}>
              <Stack direction="horizontal" gap={2} align="center" wrap="wrap">
                <FileText size={18} style={{ color: 'var(--ui-accent)' }} />
                <Text as="h3" variant="title">Form Data</Text>
                <Badge variant="outline">{formSections.length} sections, {totalFields} fields</Badge>
              </Stack>

              <Card>
                <CardContent>
                  <Stack gap={6}>
                    {formSections.map((section, sectionIndex) => (
                      <Box
                        key={`${section.id}-${sectionIndex}`}
                        style={{
                          paddingTop: sectionIndex > 0 ? '1.5rem' : 0,
                          borderTop: sectionIndex > 0 ? '1px solid var(--ui-border)' : 'none',
                        }}
                      >
                        <Stack gap={3}>
                          <Stack direction="horizontal" gap={2} align="center" wrap="wrap">
                            <Box
                              style={{
                                width: '1.5rem',
                                height: '1.5rem',
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
                            <Text as="h4" variant="label">{section.title}</Text>
                            <Badge variant="outline">{section.fields?.length || 0} fields</Badge>
                          </Stack>

                          <Box style={{ display: 'grid', gap: '0.75rem' }}>
                            {section.fields?.map((field, fieldIndex) => (
                              <Box
                                key={`${field.id}-${fieldIndex}`}
                                style={{
                                  display: 'flex',
                                  alignItems: 'baseline',
                                  gap: '0.75rem',
                                  padding: '0.5rem 0',
                                  borderBottom: fieldIndex < (section.fields?.length || 0) - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none',
                                  flexWrap: 'wrap',
                                }}
                              >
                                <Text
                                  as="span"
                                  variant="body-sm"
                                  tone="muted"
                                  style={{ minWidth: '10rem', fontWeight: 600 }}
                                >
                                  {field.label}:
                                </Text>
                                <Text as="span" variant="body-sm" style={{ flex: 1 }}>
                                  {getFieldValue(field) || <Text as="span" variant="body-sm" tone="muted">Not provided</Text>}
                                </Text>
                              </Box>
                            ))}
                          </Box>
                        </Stack>
                      </Box>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            </Stack>
          ) : (
            <Card>
              <CardContent>
                <Stack gap={2} align="center" style={{ textAlign: 'center' }}>
                  <FileText size={48} style={{ color: 'var(--ui-text-muted)' }} />
                  <Text as="h3" variant="title">No Form Data</Text>
                  <Text tone="muted">No form fields were captured in this submission.</Text>
                </Stack>
              </CardContent>
            </Card>
          )}

          <Stack gap={4}>
            <Stack direction="horizontal" gap={2} align="center" wrap="wrap">
              <Camera size={18} style={{ color: 'var(--ui-accent)' }} />
              <Text as="h3" variant="title">Verification Photos</Text>
              <Badge variant="outline">{submission.photos?.length || 0} photos</Badge>
            </Stack>

            <Card>
              <CardContent>
                <VerificationImages
                  caseId={caseId}
                  submissionId={submission.id}
                  title=""
                  showStats={false}
                  submissionAddress={submission.geoLocation?.address}
                />
              </CardContent>
            </Card>
          </Stack>

          <TemplateReportCard
            caseId={caseId}
            submissionId={submission.id}
            verificationType={submission.verificationType || 'RESIDENCE'}
            outcome={submission.outcome || 'Positive &amp; Door Locked'}
          />
        </Stack>
      ) : null}
    </Stack>
  );
};
