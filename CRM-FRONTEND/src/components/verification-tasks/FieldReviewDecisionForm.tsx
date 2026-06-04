import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import {
  VerificationDecisionForm,
  type VerificationDecisionValues,
} from '@/components/verification-tasks/VerificationDecisionForm';
import { OptimizedFormSubmissionViewer } from '@/components/forms/OptimizedFormSubmissionViewer';
import { useCaseFormSubmissions } from '@/hooks/useForms';
import { VerificationTasksService } from '@/services/verificationTasks';

// Mandatory backend review (Layer 2). A backend user records the OFFICIAL
// Backend Final Result on a SUBMITTED_FOR_REVIEW field task and completes it.
// This is a separate decision layer — it NEVER overwrites the field
// executive's submission (FE result / remarks / photos / GPS). FE and Backend
// results are preserved independently and may differ.
//
// When caseId is supplied the field executive's own submission (result, photos,
// GPS, answers) is rendered read-only ABOVE the decision form so the reviewer
// sees the evidence in-context before deciding. The form UI is the shared
// VerificationDecisionForm; the field-specific submit (finalize) stays here.
interface FieldReviewDecisionFormProps {
  taskId: string;
  caseId?: string;
  onCompleted?: () => void;
}

export const FieldReviewDecisionForm: React.FC<FieldReviewDecisionFormProps> = ({
  taskId,
  caseId,
  onCompleted,
}) => {
  const [busy, setBusy] = useState(false);

  // Field executive's submission for THIS task (immutable evidence).
  const { data: submissionsData, isLoading: loadingEvidence } = useCaseFormSubmissions(
    caseId ?? ''
  );
  const feSubmission = caseId
    ? (submissionsData?.data?.submissions ?? []).find((s) => s.verificationTaskId === taskId)
    : undefined;

  const handleComplete = async (values: VerificationDecisionValues) => {
    setBusy(true);
    try {
      await VerificationTasksService.finalizeFieldReview(taskId, {
        backendFinalResult: values.result,
        remarks: values.remarks,
        findings: values.findings || undefined,
        observations: values.observations || undefined,
        recommendation: values.recommendation || undefined,
      });
      toast.success(`Verification finalized — ${values.result}`);
      onCompleted?.();
    } catch (error) {
      const msg =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to finalize verification';
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {caseId && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Field executive&apos;s submission (evidence)</p>
          {loadingEvidence ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading submission…
            </div>
          ) : feSubmission ? (
            <OptimizedFormSubmissionViewer submission={feSubmission} caseId={caseId} />
          ) : (
            <div className="rounded border border-dashed p-3 text-sm text-muted-foreground">
              No field submission found for this task.
            </div>
          )}
        </div>
      )}

      <VerificationDecisionForm
        resultLabel="Backend Final Result"
        resultHint="The official company decision. May differ from the field executive's result above; both are preserved."
        showStructured
        busy={busy}
        onComplete={handleComplete}
      />
    </div>
  );
};
