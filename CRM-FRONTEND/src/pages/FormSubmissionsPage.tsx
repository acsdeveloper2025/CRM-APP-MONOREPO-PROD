import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/ui/components/Dialog';
import { useCaseFormSubmissions } from '@/hooks/useForms';
import { FormViewer } from '@/components/forms/FormViewer';
import { FormSubmission } from '@/types/form';
import { MetricCardGrid } from '@/components/shared/MetricCardGrid';
import {
  Camera,
  Clock,
  User,
  AlertCircle,
  Eye,
  FileText,
  CheckCircle2
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { LoadingState } from '@/ui/components/Loading';
import { Badge } from '@/ui/components/Badge';
import { Card } from '@/ui/components/Card';
import { Page } from '@/ui/layout/Page';
import { Section } from '@/ui/layout/Section';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';

export const FormSubmissionsPage: React.FC = () => {
  const { caseId } = useParams<{ caseId: string }>();
  const [selectedSubmission, setSelectedSubmission] = useState<FormSubmission | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  const { data: formSubmissionsData, isLoading, error } = useCaseFormSubmissions(caseId || '');
  const submissions = formSubmissionsData?.data?.submissions || [];

  const handleSubmissionSelect = (submission: FormSubmission) => {
    setSelectedSubmission(submission);
    setIsViewerOpen(true);
  };

  const handleCloseViewer = () => {
    setSelectedSubmission(null);
    setIsViewerOpen(false);
  };

  const getStatusVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
      case 'approved':
        return 'status-completed' as const;
      case 'pending':
      case 'under_review':
        return 'status-pending' as const;
      case 'failed':
      case 'rejected':
        return 'danger' as const;
      default:
        return 'neutral' as const;
    }
  };

  const getValidationVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case 'valid':
        return 'positive' as const;
      case 'invalid':
      case 'flagged':
        return 'danger' as const;
      case 'warning':
      case 'pending':
        return 'warning' as const;
      default:
        return 'neutral' as const;
    }
  };

  if (isLoading) {
    return (
      <Page
        title="Form Submissions"
        subtitle={`Case #${caseId}`}
        shell
      >
        <Section>
          <LoadingState message="Fetching form submissions..." size="lg" className="min-h-[400px]" />
        </Section>
      </Page>
    );
  }

  if (error) {
    return (
      <Page
        title="Form Submissions"
        subtitle={`Case #${caseId}`}
        shell
      >
        <Section>
          <Stack gap={3} style={{ textAlign: 'center', padding: '3rem 0' }}>
            <AlertCircle size={48} style={{ color: 'var(--ui-danger)' }} />
            <Text as="h2" variant="headline">Error Loading Form Submissions</Text>
            <Text tone="muted">There was an error loading the form submissions for this case.</Text>
          </Stack>
        </Section>
      </Page>
    );
  }

  return (
    <Page
      title="Form Submissions"
      subtitle={`Case #${caseId}`}
      shell
      actions={<Badge variant="neutral">{submissions.length} submissions</Badge>}
    >
      <Section>
        <MetricCardGrid
          min={220}
          items={[
            { title: 'Submissions', value: submissions.length, detail: 'Captured for this case', icon: FileText, tone: 'accent' },
            { title: 'Completed', value: submissions.filter((s) => ['completed', 'approved'].includes(s.status.toLowerCase())).length, detail: 'Approved or completed', icon: CheckCircle2, tone: 'positive' },
            { title: 'Photos', value: submissions.reduce((total, submission) => total + (submission.photos?.length || 0), 0), detail: 'Captured images', icon: Camera, tone: 'warning' },
          ]}
        />
      </Section>

      <Section>
        {submissions.length === 0 ? (
          <Card tone="strong" staticCard>
            <Stack gap={3} style={{ textAlign: 'center', padding: '2rem 0' }}>
              <FileText size={48} style={{ color: 'var(--ui-muted)' }} />
              <Text as="h3" variant="title">No Form Submissions</Text>
              <Text tone="muted">No form submissions found for this case.</Text>
            </Stack>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {submissions.map((submission) => (
              <Card
                key={submission.id}
                tone="strong"
                onClick={() => handleSubmissionSelect(submission)}
                style={{ cursor: 'pointer' }}
              >
                <Stack gap={3}>
                  <Stack direction="horizontal" justify="space-between" align="flex-start" gap={3}>
                    <Stack direction="horizontal" gap={3} align="center">
                      <div className="ui-stat-card" style={{ padding: '0.7rem' }}>
                        <User size={18} />
                      </div>
                      <Stack gap={1}>
                        <Text as="h3" variant="title">{submission.submittedByName}</Text>
                        <Text variant="body-sm" tone="muted">Field Agent</Text>
                      </Stack>
                    </Stack>
                    <Stack gap={1} align="flex-end">
                      <Badge variant={getStatusVariant(submission.status)}>
                        {submission.status.replace('_', ' ')}
                      </Badge>
                      <Badge variant={getValidationVariant(submission.validationStatus)}>
                        {submission.validationStatus}
                      </Badge>
                    </Stack>
                  </Stack>

                  {submission.verificationTaskNumber ? (
                    <Stack direction="horizontal" gap={2} align="center" wrap="wrap">
                      <CheckCircle2 size={16} style={{ color: 'var(--ui-positive)' }} />
                      <Text variant="body-sm" tone="positive">Task {submission.verificationTaskNumber}</Text>
                      {submission.verificationTypeName ? (
                        <Badge variant="neutral">{submission.verificationTypeName}</Badge>
                      ) : null}
                    </Stack>
                  ) : null}

                  <Stack gap={2}>
                    <Stack direction="horizontal" gap={2} align="center">
                      <Clock size={16} />
                      <Text variant="body-sm" tone="muted">
                        {formatDistanceToNow(new Date(submission.submittedAt), { addSuffix: true })}
                      </Text>
                    </Stack>
                    <Stack direction="horizontal" gap={2} align="center">
                      <FileText size={16} />
                      <Text variant="body-sm" tone="muted">{submission.formType} Form</Text>
                    </Stack>
                    <Stack direction="horizontal" gap={2} align="center">
                      <Camera size={16} />
                      <Text variant="body-sm" tone="muted">{submission.photos?.length || 0} photos captured</Text>
                    </Stack>
                  </Stack>
                </Stack>
              </Card>
            ))}
          </div>
        )}
      </Section>

      {submissions.some(s => s.photos && s.photos.length > 0) ? (
        <Section>
          <Card tone="strong" staticCard>
            <Stack gap={4}>
              <Stack direction="horizontal" gap={2} align="center">
                <Camera size={18} />
                <Text as="h3" variant="title">Captured Images</Text>
              </Stack>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              {submissions.flatMap(submission =>
                (submission.photos || []).map(photo => (
                  <div
                    key={`${submission.id}-${photo.id}`}
                    className="group relative cursor-pointer"
                    onClick={() => handleSubmissionSelect(submission)}
                  >
                    <div className="aspect-square bg-slate-100 dark:bg-slate-800/60 rounded-lg overflow-hidden">
                      <img
                        src={photo.thumbnailUrl || photo.url}
                        alt={`Photo by ${submission.submittedByName}`}
                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      />
                    </div>
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-opacity rounded-lg flex items-center justify-center">
                      <Eye className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="absolute top-2 left-2">
                      <Badge className="text-xs bg-black bg-opacity-70 text-white">
                        {photo.type}
                      </Badge>
                    </div>
                    <div className="absolute bottom-2 left-2 right-2">
                      <div className="bg-black bg-opacity-70 text-white text-xs p-1 rounded truncate">
                        {submission.submittedByName}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            </Stack>
          </Card>
        </Section>
      ) : null}

      {selectedSubmission && (
        <Dialog open={isViewerOpen} onOpenChange={handleCloseViewer}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-auto">
            <DialogHeader>
              <DialogTitle>Form Submission Details</DialogTitle>
            </DialogHeader>
            <FormViewer
              submission={selectedSubmission}
              readonly={true}
              showAttachments={true}
              showPhotos={true}
              showLocation={true}
              showMetadata={true}
            />
          </DialogContent>
        </Dialog>
      )}
    </Page>
  );
};
