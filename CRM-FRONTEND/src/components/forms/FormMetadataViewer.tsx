import { User, Clock, FileText, CheckCircle, AlertCircle, Eye } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/components/card';
import { Badge } from '@/ui/components/badge';
import { Separator } from '@/ui/components/separator';
import { FormSubmission } from '@/types/form';
import { Box } from '@/ui/primitives/Box';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';

interface FormMetadataViewerProps {
  submission: FormSubmission;
}

export function FormMetadataViewer({ submission }: FormMetadataViewerProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <CheckCircle size={16} style={{ color: 'var(--ui-success)' }} />;
      case 'REJECTED':
        return <AlertCircle size={16} style={{ color: 'var(--ui-danger)' }} />;
      case 'UNDER_REVIEW':
        return <Eye size={16} style={{ color: 'var(--ui-accent)' }} />;
      default:
        return <FileText size={16} style={{ color: 'var(--ui-text-muted)' }} />;
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      DRAFT: { variant: 'secondary' as const, label: 'Draft' },
      SUBMITTED: { variant: 'default' as const, label: 'Submitted' },
      UNDER_REVIEW: { variant: 'outline' as const, label: 'Under Review' },
      APPROVED: { variant: 'default' as const, label: 'Approved' },
      REJECTED: { variant: 'destructive' as const, label: 'Rejected' },
    };
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.DRAFT;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getFormTypeLabel = (formType: string) =>
    formType.split('-').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

  const getVerificationTypeLabel = (verificationType: string) =>
    verificationType.replace(/([A-Z])/g, ' $1').trim();

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <Stack direction="horizontal" gap={2} align="center">
            <FileText size={20} />
            <span>Form Information</span>
          </Stack>
        </CardTitle>
        <CardDescription>Submission details and verification metadata</CardDescription>
      </CardHeader>
      <CardContent>
        <Stack gap={6}>
          <Box style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
            <Stack gap={2}>
              <Text as="h4" variant="label">Form Details</Text>
              <Stack gap={2}>
                <Box style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text as="span" variant="body-sm" tone="muted">Form ID:</Text>
                  <Text as="span" variant="body-sm" style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>{submission.id}</Text>
                </Box>
                <Box style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text as="span" variant="body-sm" tone="muted">Case ID:</Text>
                  <Text as="span" variant="body-sm" style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>{submission.caseId}</Text>
                </Box>
                <Box style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text as="span" variant="body-sm" tone="muted">Form Type:</Text>
                  <Text as="span" variant="body-sm">{getFormTypeLabel(submission.formType)}</Text>
                </Box>
                <Box style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text as="span" variant="body-sm" tone="muted">Verification:</Text>
                  <Text as="span" variant="body-sm">{getVerificationTypeLabel(submission.verificationType)}</Text>
                </Box>
                <Box style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text as="span" variant="body-sm" tone="muted">Outcome:</Text>
                  <Badge variant="outline">{submission.outcome}</Badge>
                </Box>
              </Stack>
            </Stack>

            <Stack gap={2}>
              <Text as="h4" variant="label">Status & Progress</Text>
              <Stack gap={2}>
                <Box style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text as="span" variant="body-sm" tone="muted">Status:</Text>
                  <Stack direction="horizontal" gap={2} align="center">
                    {getStatusIcon(submission.status)}
                    {getStatusBadge(submission.status)}
                  </Stack>
                </Box>
                <Box style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text as="span" variant="body-sm" tone="muted">Sections:</Text>
                  <Text as="span" variant="body-sm">{submission.sections.length}</Text>
                </Box>
                <Box style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text as="span" variant="body-sm" tone="muted">Attachments:</Text>
                  <Text as="span" variant="body-sm">{submission.attachments.length}</Text>
                </Box>
                <Box style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text as="span" variant="body-sm" tone="muted">Location:</Text>
                  <Text as="span" variant="body-sm">{submission.location ? 'Captured' : 'Not available'}</Text>
                </Box>
              </Stack>
            </Stack>
          </Box>

          <Separator />

          <Box style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
            <Stack gap={2}>
              <Text as="h4" variant="label">Submission Details</Text>
              <Stack gap={2}>
                <Stack direction="horizontal" gap={2} align="center">
                  <User size={12} style={{ color: 'var(--ui-text-muted)' }} />
                  <Text as="span" variant="body-sm" tone="muted">Submitted by:</Text>
                  <Text as="span" variant="body-sm" style={{ fontWeight: 600 }}>{submission.submittedByName || submission.submittedBy || 'Unknown Agent'}</Text>
                </Stack>
                <Stack direction="horizontal" gap={2} align="center">
                  <Clock size={12} style={{ color: 'var(--ui-text-muted)' }} />
                  <Text as="span" variant="body-sm" tone="muted">Submitted at:</Text>
                  <Text as="span" variant="body-sm">{new Date(submission.submittedAt).toLocaleString()}</Text>
                </Stack>
              </Stack>
            </Stack>

            {(submission.reviewedBy || submission.reviewedAt) ? (
              <Stack gap={2}>
                <Text as="h4" variant="label">Review Details</Text>
                <Stack gap={2}>
                  {submission.reviewedBy ? (
                    <Stack direction="horizontal" gap={2} align="center">
                      <User size={12} style={{ color: 'var(--ui-text-muted)' }} />
                      <Text as="span" variant="body-sm" tone="muted">Reviewed by:</Text>
                      <Text as="span" variant="body-sm" style={{ fontWeight: 600 }}>{submission.reviewedBy}</Text>
                    </Stack>
                  ) : null}
                  {submission.reviewedAt ? (
                    <Stack direction="horizontal" gap={2} align="center">
                      <Clock size={12} style={{ color: 'var(--ui-text-muted)' }} />
                      <Text as="span" variant="body-sm" tone="muted">Reviewed at:</Text>
                      <Text as="span" variant="body-sm">{new Date(submission.reviewedAt).toLocaleString()}</Text>
                    </Stack>
                  ) : null}
                </Stack>
              </Stack>
            ) : null}
          </Box>

          <Box style={{ background: 'var(--ui-surface-muted)', borderRadius: 'var(--ui-radius-lg)', padding: '1rem' }}>
            <Text as="h4" variant="label" style={{ marginBottom: '0.75rem' }}>Form Statistics</Text>
            <Box style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}>
              <Box style={{ textAlign: 'center' }}>
                <Text variant="headline" tone="accent">{submission.sections.reduce((acc, section) => acc + section.fields.length, 0)}</Text>
                <Text variant="caption" tone="muted">Total Fields</Text>
              </Box>
              <Box style={{ textAlign: 'center' }}>
                <Text variant="headline" tone="positive">{submission.sections.reduce((acc, section) => acc + section.fields.filter((field) => field.value && field.value !== '').length, 0)}</Text>
                <Text variant="caption" tone="muted">Completed Fields</Text>
              </Box>
              <Box style={{ textAlign: 'center' }}>
                <Text variant="headline" tone="positive">{submission.attachments.length}</Text>
                <Text variant="caption" tone="muted">Attachments</Text>
              </Box>
              <Box style={{ textAlign: 'center' }}>
                <Text variant="headline" tone="positive">{submission.location ? '1' : '0'}</Text>
                <Text variant="caption" tone="muted">GPS Location</Text>
              </Box>
            </Box>
          </Box>

          <Stack gap={2}>
            <Text as="h4" variant="label">Completion Progress</Text>
            <Stack gap={2}>
              {submission.sections.map((section) => {
                const totalFields = section.fields.length;
                const completedFields = section.fields.filter((field) => field.value && field.value !== '').length;
                const percentage = totalFields > 0 ? (completedFields / totalFields) * 100 : 0;
                return (
                  <Stack key={section.id} gap={1}>
                    <Box style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text as="span" variant="body-sm">{section.title}</Text>
                      <Text as="span" variant="body-sm" tone="muted">
                        {completedFields}/{totalFields} ({Math.round(percentage)}%)
                      </Text>
                    </Box>
                    <Box style={{ width: '100%', background: 'var(--ui-surface)', borderRadius: '999px', height: '0.5rem' }}>
                      <Box style={{ width: `${percentage}%`, background: 'var(--ui-accent)', borderRadius: '999px', height: '0.5rem', transition: 'width 300ms ease' }} />
                    </Box>
                  </Stack>
                );
              })}
            </Stack>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
