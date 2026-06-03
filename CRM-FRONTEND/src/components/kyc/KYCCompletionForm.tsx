import {
  VerificationDecisionForm,
  type VerificationDecisionValues,
} from '@/components/verification-tasks/VerificationDecisionForm';
import { useVerifyKYCDocument, useUploadKYCReport } from '@/hooks/useKYC';
import { toast } from 'sonner';

// KYC redesign (2026-06-03): the verification decision is a single mandatory
// Remark + a KYC Result dropdown (Positive/Negative/Refer/Fraud), with an
// optional attachment (the document the KYC verifier sent back). Shared by the
// dedicated KYC verify page and the case-detail KYC card. `taskId` is the
// kyc_document_verifications id.
//
// The form UI is the shared VerificationDecisionForm; the KYC-specific submit
// logic (upload the verifier's document FIRST so it lands on the cycle this
// completion finalizes, then verify) stays here unchanged.
interface KYCCompletionFormProps {
  taskId: string;
  onCompleted?: () => void;
}

export const KYCCompletionForm: React.FC<KYCCompletionFormProps> = ({ taskId, onCompleted }) => {
  const { mutateAsync: verify, isPending: isVerifying } = useVerifyKYCDocument();
  const { mutateAsync: uploadReport, isPending: isUploading } = useUploadKYCReport();

  const busy = isVerifying || isUploading;

  const handleComplete = async (values: VerificationDecisionValues) => {
    try {
      // Upload the verifier's document FIRST so it lands on the cycle this
      // completion finalizes (mirrors the report-before-verify ordering).
      if (values.file) {
        await uploadReport({ taskId, file: values.file });
      }
      await verify({ taskId, data: { finalStatus: values.result, remarks: values.remarks } });
      toast.success(`KYC verification completed — ${values.result}`);
      onCompleted?.();
    } catch (error) {
      const msg =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to complete KYC verification';
      toast.error(msg);
    }
  };

  return (
    <VerificationDecisionForm
      resultLabel="KYC Result"
      showAttachment
      attachmentLabel="Document received from KYC verifier"
      busy={busy}
      onComplete={handleComplete}
    />
  );
};
