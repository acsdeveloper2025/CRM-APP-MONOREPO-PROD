import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CheckCircle } from 'lucide-react';
import { useVerifyKYCDocument, useUploadKYCReport } from '@/hooks/useKYC';
import { toast } from 'sonner';

// KYC redesign (2026-06-03): the verification decision is a single mandatory
// Remark + a KYC Result dropdown (Positive/Negative/Refer/Fraud), with an
// optional attachment (the document the KYC verifier sent back). The Complete
// button stays disabled until both mandatory fields are filled. Shared by the
// dedicated KYC verify page and the case-detail KYC card so completion behaves
// identically in both places. `taskId` is the kyc_document_verifications id.
const KYC_RESULTS = ['Positive', 'Negative', 'Refer', 'Fraud'] as const;

interface KYCCompletionFormProps {
  taskId: string;
  onCompleted?: () => void;
}

export const KYCCompletionForm: React.FC<KYCCompletionFormProps> = ({ taskId, onCompleted }) => {
  const { mutateAsync: verify, isPending: isVerifying } = useVerifyKYCDocument();
  const { mutateAsync: uploadReport, isPending: isUploading } = useUploadKYCReport();

  const [remarks, setRemarks] = useState('');
  const [result, setResult] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const busy = isVerifying || isUploading;
  const canComplete = remarks.trim().length > 0 && result.length > 0;

  const handleComplete = async () => {
    if (!canComplete) {
      return;
    }
    try {
      // Upload the verifier's document FIRST so it lands on the cycle this
      // completion finalizes (mirrors the report-before-verify ordering).
      if (file) {
        await uploadReport({ taskId, file });
      }
      await verify({ taskId, data: { finalStatus: result, remarks: remarks.trim() } });
      toast.success(`KYC verification completed — ${result}`);
      onCompleted?.();
    } catch (error) {
      const msg =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to complete KYC verification';
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-4">
      {/* Attachment — the document the KYC verifier sent back (optional). */}
      <div className="space-y-1">
        <Label className="text-sm">Document received from KYC verifier</Label>
        <input
          type="file"
          aria-label="Document received from KYC verifier"
          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-input file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-muted/80"
        />
        <p className="text-xs text-muted-foreground">
          Optional. Attach the source&apos;s reply / report (PDF, image, or Word). Saved with this
          verification.
        </p>
      </div>

      {/* Remark — mandatory. */}
      <div className="space-y-1">
        <Label className="text-sm">
          Remark <span className="text-red-500">*</span>
        </Label>
        <Textarea
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="Add the verification observations / findings..."
          className="min-h-[80px]"
        />
      </div>

      {/* KYC Result — mandatory. */}
      <div className="space-y-1">
        <Label className="text-sm">
          KYC Result <span className="text-red-500">*</span>
        </Label>
        <Select value={result} onValueChange={setResult}>
          <SelectTrigger>
            <SelectValue placeholder="Select result" />
          </SelectTrigger>
          <SelectContent>
            {KYC_RESULTS.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Complete — disabled until Remark + Result are filled. */}
      <Button
        onClick={handleComplete}
        disabled={!canComplete || busy}
        className="w-full bg-green-600 hover:bg-green-700 text-white"
      >
        <CheckCircle className="h-4 w-4 mr-2" />
        {busy ? 'Completing…' : 'Complete Verification'}
      </Button>
      {!canComplete && (
        <p className="text-xs text-muted-foreground text-center">
          Remark and KYC Result are required to complete.
        </p>
      )}
    </div>
  );
};
