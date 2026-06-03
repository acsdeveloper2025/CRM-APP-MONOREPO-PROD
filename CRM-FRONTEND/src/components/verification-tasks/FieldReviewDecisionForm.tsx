import { useState } from 'react';
import { toast } from 'sonner';
import {
  VerificationDecisionForm,
  type VerificationDecisionValues,
} from '@/components/verification-tasks/VerificationDecisionForm';
import { VerificationTasksService } from '@/services/verificationTasks';

// Mandatory backend review (Layer 2). A backend user records the OFFICIAL
// Backend Final Result on a SUBMITTED_FOR_REVIEW field task and completes it.
// This is a separate decision layer — it NEVER overwrites the field
// executive's submission (FE result / remarks / photos / GPS). FE and Backend
// results are preserved independently and may differ.
//
// The form UI is the shared VerificationDecisionForm; the field-specific submit
// (finalize) stays here.
interface FieldReviewDecisionFormProps {
  taskId: string;
  onCompleted?: () => void;
}

export const FieldReviewDecisionForm: React.FC<FieldReviewDecisionFormProps> = ({
  taskId,
  onCompleted,
}) => {
  const [busy, setBusy] = useState(false);

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
    <VerificationDecisionForm
      resultLabel="Backend Final Result"
      resultHint="The official company decision. May differ from the field executive's result; both are preserved."
      showStructured
      busy={busy}
      onComplete={handleComplete}
    />
  );
};
