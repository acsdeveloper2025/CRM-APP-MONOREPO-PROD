import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Edit,
  UserCheck,
} from 'lucide-react';
import { useApproveCase, useAssignCase, useCase, useCaseHistory, useRejectCase, useRequestRework } from '@/hooks/useCases';
import { useCaseFormSubmissions } from '@/hooks/useForms';
import { ReassignCaseModal } from '@/components/cases/ReassignCaseModal';
import {
  CaseAttachmentsPanel,
  CaseFormDataPanel,
  CaseHeroPanel,
  CaseOperationalSummaryPanel,
  CasePhotosPanel,
  CaseTasksPanel,
  CaseTimelinePanel,
} from '@/components/cases/CaseDetailPanels';
import { ReviewDialog } from '@/components/review/ReviewDialog';
import { Button } from '@/ui/components/Button';
import { Card } from '@/ui/components/Card';
import { Skeleton } from '@/ui/components/Skeleton';
import { Grid } from '@/ui/layout/Grid';
import { Page } from '@/ui/layout/Page';
import { Section } from '@/ui/layout/Section';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';
import { toast } from 'sonner';

type ReviewAction = 'approve' | 'reject' | 'rework' | null;

export const CaseDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const safeId = id || '';
  const [isReassignModalOpen, setIsReassignModalOpen] = useState(false);
  const [reviewAction, setReviewAction] = useState<ReviewAction>(null);

  const { data: caseData, isLoading, refetch } = useCase(safeId);
  const { data: historyData } = useCaseHistory(safeId);
  const { data: formSubmissionsData, isLoading: formSubmissionsLoading } = useCaseFormSubmissions(safeId);
  const assignCaseMutation = useAssignCase();
  const approveCaseMutation = useApproveCase();
  const rejectCaseMutation = useRejectCase();
  const requestReworkMutation = useRequestRework();

  const caseItem = caseData?.data;
  const historyItems = Array.isArray(historyData?.data) ? historyData?.data : [];
  const formSubmissions = formSubmissionsData?.data?.submissions || [];
  const latestSubmission = formSubmissions[0];
  const photos = useMemo(
    () =>
      formSubmissions.flatMap((submission) =>
        (submission.photos || []).map((photo) => ({
          ...photo,
          submittedByName: submission.submittedByName,
          verificationTaskNumber: submission.verificationTaskNumber,
        }))
      ),
    [formSubmissions]
  );

  const handleEditCase = () => {
    navigate(`/cases/new?edit=${safeId}`);
  };

  const handleReassignCase = async (assignedToId: string, reason: string) => {
    await assignCaseMutation.mutateAsync({
      id: safeId,
      assignedToId,
      reason,
    });
    setIsReassignModalOpen(false);
    refetch();
  };

  const handleApproveCase = async (caseId: string, feedback?: string) => {
    await approveCaseMutation.mutateAsync({ id: caseId, feedback });
    toast.success('Case approved');
    setReviewAction(null);
    refetch();
  };

  const handleRejectCase = async (caseId: string, reason: string) => {
    await rejectCaseMutation.mutateAsync({ id: caseId, reason });
    toast.success('Case rejected');
    setReviewAction(null);
    refetch();
  };

  const handleRequestRework = async (caseId: string, feedback: string) => {
    await requestReworkMutation.mutateAsync({ id: caseId, feedback });
    toast.success('Rework requested');
    setReviewAction(null);
    refetch();
  };

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable;

      if (typing) {
        return;
      }

      if (event.key === 'a' || event.key === 'A') {
        event.preventDefault();
        setReviewAction('approve');
      }

      if (event.key === 'r' || event.key === 'R') {
        event.preventDefault();
        setReviewAction('rework');
      }

      if (event.key === 'Escape') {
        setReviewAction(null);
        setIsReassignModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const timeline = [
    {
      title: 'Case created',
      detail: caseItem?.createdByBackendUser?.name || 'System',
      time: caseItem?.createdAt,
    },
    {
      title: 'Last updated',
      detail: caseItem?.assignedTo?.name || 'Unassigned',
      time: caseItem?.updatedAt,
    },
    ...historyItems.slice(0, 6).map((item: Record<string, unknown>) => ({
      title: String(item.action || item.event || 'Case activity'),
      detail: String(item.description || item.notes || item.actorName || 'Operational event'),
      time: String(item.createdAt || item.timestamp || item.updatedAt || ''),
    })),
  ].filter((item) => item.time);

  if (isLoading) {
    return (
      <Page title="Case detail" subtitle="Loading operational panel..." shell>
        <Section>
          <Stack gap={4}>
            <Skeleton style={{ height: 120, borderRadius: 28 }} />
            <Grid min={280}>
              <Skeleton style={{ height: 340, borderRadius: 28 }} />
              <Skeleton style={{ height: 340, borderRadius: 28 }} />
            </Grid>
            <Skeleton style={{ height: 220, borderRadius: 28 }} />
          </Stack>
        </Section>
      </Page>
    );
  }

  if (!caseItem) {
    return (
      <Page title="Case detail" subtitle="Case record unavailable." shell>
        <Section>
          <Card staticCard>
            <div {...{ className: "ui-empty-state" }}>
              <Text variant="headline">Case not found</Text>
              <Text variant="body-sm" tone="muted">The case you’re trying to open is no longer available.</Text>
              <Link to="/cases" style={{ textDecoration: 'none' }}>
                <Button variant="secondary" icon={<ArrowLeft size={16} />}>Back to cases</Button>
              </Link>
            </div>
          </Card>
        </Section>
      </Page>
    );
  }

  return (
    <Page
      title={`Case #${caseItem.caseId || caseItem.id.slice(-8)}`}
      subtitle={caseItem.title || 'Operational panel'}
      shell
      actions={
        <Stack direction="horizontal" gap={2} wrap="wrap">
          <Link to="/cases" style={{ textDecoration: 'none' }}>
            <Button variant="secondary" icon={<ArrowLeft size={16} />}>Back</Button>
          </Link>
          <Button variant="secondary" icon={<Edit size={16} />} onClick={handleEditCase}>
            Edit
          </Button>
          <Button variant="secondary" icon={<UserCheck size={16} />} onClick={() => setIsReassignModalOpen(true)}>
            Assign
          </Button>
        </Stack>
      }
    >
      <Section>
        <CaseHeroPanel
          caseItem={caseItem}
          safeId={safeId}
          onApprove={() => setReviewAction('approve')}
          onRework={() => setReviewAction('rework')}
          onReject={() => setReviewAction('reject')}
          onFormSubmissions={() => navigate(`/cases/${safeId}/form-submissions`)}
        />
      </Section>

      <Section>
        <Grid min={320} style={{ gridTemplateColumns: 'minmax(0, 1.4fr) minmax(320px, 0.8fr)' }}>
          <Stack gap={4}>
            <CaseFormDataPanel
              formSubmissionsLoading={formSubmissionsLoading}
              latestSubmission={latestSubmission}
            />

            <CaseTasksPanel
              safeId={safeId}
              caseItem={caseItem}
            />
          </Stack>

          <Stack gap={4}>
            <CasePhotosPanel photos={photos} />
            <CaseOperationalSummaryPanel caseItem={caseItem} />
            <CaseAttachmentsPanel safeId={safeId} />
          </Stack>
        </Grid>
      </Section>

      <Section>
        <CaseTimelinePanel timeline={timeline} />
      </Section>

      {caseItem ? (
        <>
          <ReviewDialog
            isOpen={reviewAction !== null}
            onClose={() => setReviewAction(null)}
            case={caseItem}
            initialAction={reviewAction === null ? undefined : reviewAction}
            onApprove={handleApproveCase}
            onReject={handleRejectCase}
            onRequestRework={handleRequestRework}
            isLoading={
              approveCaseMutation.isPending || rejectCaseMutation.isPending || requestReworkMutation.isPending
            }
          />
          <ReassignCaseModal
            isOpen={isReassignModalOpen}
            onClose={() => setIsReassignModalOpen(false)}
            onReassign={handleReassignCase}
            case={caseItem}
            isLoading={assignCaseMutation.isPending}
          />
        </>
      ) : null}
    </Page>
  );
};
