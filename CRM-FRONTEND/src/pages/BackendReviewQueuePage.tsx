import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ClipboardCheck, ExternalLink, Loader2 } from 'lucide-react';
import { VerificationTasksService } from '@/services/verificationTasks';
import { FieldReviewDecisionForm } from '@/components/verification-tasks/FieldReviewDecisionForm';

// Backend reviewer queue (mandatory review). Lists field verifications a field
// executive has submitted (status SUBMITTED_FOR_REVIEW) and lets a backend user
// record the official Backend Final Result. The FE submission is viewed via the
// case (Evidence link) and is never modified here.
export const BackendReviewQueuePage: React.FC = () => {
  const queryClient = useQueryClient();
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['backend-review-queue'],
    queryFn: () =>
      VerificationTasksService.getAllTasks({ status: 'SUBMITTED_FOR_REVIEW', limit: 100 }),
  });

  const tasks = data?.data?.tasks ?? [];
  const total = data?.data?.pagination?.total ?? tasks.length;

  const handleCompleted = () => {
    setOpenTaskId(null);
    queryClient.invalidateQueries({ queryKey: ['backend-review-queue'] });
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-2">
        <ClipboardCheck className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Backend Review</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Field verifications submitted by field executives, awaiting your final decision. Your Backend
        Final Result is the official company decision and is recorded separately from the field
        executive&apos;s submission.
      </p>

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      )}
      {isError && (
        <div className="flex items-center gap-3 rounded border border-destructive/40 bg-destructive/10 p-4 text-sm">
          Failed to load the review queue.
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      )}
      {!isLoading && !isError && tasks.length === 0 && (
        <div className="rounded border border-dashed p-8 text-center text-muted-foreground">
          No verifications awaiting review.
        </div>
      )}

      {total > tasks.length && (
        <div className="rounded border border-dashed p-3 text-sm text-muted-foreground">
          Showing the first {tasks.length} of {total} pending reviews. Finalize these and refresh to
          load the rest.
        </div>
      )}

      <div className="space-y-3">
        {tasks.map((t) => (
          <div key={t.id} className="rounded-lg border bg-card p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="font-medium">
                  {t.taskNumber} · {t.verificationTypeName ?? 'Verification'}
                </div>
                {t.address && (
                  <div className="truncate text-sm text-muted-foreground">{t.address}</div>
                )}
                {t.verificationOutcome && (
                  <div className="mt-1 text-xs">
                    <span className="text-muted-foreground">Field executive result: </span>
                    <span className="font-medium">{t.verificationOutcome}</span>
                  </div>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Link
                  to={`/case-management/${t.caseId}`}
                  className="inline-flex items-center text-sm text-primary hover:underline"
                >
                  <ExternalLink className="mr-1 h-3.5 w-3.5" /> Evidence
                </Link>
                <Button
                  size="sm"
                  variant={openTaskId === t.id ? 'secondary' : 'default'}
                  onClick={() => setOpenTaskId(openTaskId === t.id ? null : t.id)}
                >
                  {openTaskId === t.id ? 'Close' : 'Review'}
                </Button>
              </div>
            </div>
            {openTaskId === t.id && (
              <div className="mt-4 border-t pt-4">
                <FieldReviewDecisionForm
                  taskId={t.id}
                  caseId={t.caseId}
                  onCompleted={handleCompleted}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
