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

// Shared presentational verification-decision form used by BOTH the KYC
// completion flow and the field backend-review flow. It only collects the
// decision; each call site owns its own submit logic (so KYC keeps its exact
// upload-then-verify behaviour and field keeps its finalize call). The decision
// is always a mandatory Result + Remark; the button stays disabled until both
// are filled. Optional sections (attachment / structured findings) are toggled
// per call site.
const RESULTS = ['Positive', 'Negative', 'Refer', 'Fraud'] as const;

export interface VerificationDecisionValues {
  result: string;
  remarks: string;
  file: File | null;
  findings: string;
  observations: string;
  recommendation: string;
}

interface VerificationDecisionFormProps {
  resultLabel: string;
  resultHint?: string;
  showAttachment?: boolean;
  attachmentLabel?: string;
  showStructured?: boolean;
  busy?: boolean;
  completeLabel?: string;
  onComplete: (values: VerificationDecisionValues) => void | Promise<void>;
}

export const VerificationDecisionForm: React.FC<VerificationDecisionFormProps> = ({
  resultLabel,
  resultHint,
  showAttachment = false,
  attachmentLabel = 'Attachment',
  showStructured = false,
  busy = false,
  completeLabel = 'Complete Verification',
  onComplete,
}) => {
  const [result, setResult] = useState('');
  const [remarks, setRemarks] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [findings, setFindings] = useState('');
  const [observations, setObservations] = useState('');
  const [recommendation, setRecommendation] = useState('');

  const canComplete = remarks.trim().length > 0 && result.length > 0;

  const handle = () => {
    if (!canComplete || busy) {
      return;
    }
    void onComplete({
      result,
      remarks: remarks.trim(),
      file,
      findings: findings.trim(),
      observations: observations.trim(),
      recommendation: recommendation.trim(),
    });
  };

  return (
    <div className="space-y-4">
      {showAttachment && (
        <div className="space-y-1">
          <Label className="text-sm">{attachmentLabel}</Label>
          <input
            type="file"
            aria-label={attachmentLabel}
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-input file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-muted/80"
          />
          <p className="text-xs text-muted-foreground">
            Optional. Attach the source&apos;s reply / report (PDF, image, or Word). Saved with this
            verification.
          </p>
        </div>
      )}

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

      {/* Result — mandatory. */}
      <div className="space-y-1">
        <Label className="text-sm">
          {resultLabel} <span className="text-red-500">*</span>
        </Label>
        <Select value={result} onValueChange={setResult}>
          <SelectTrigger>
            <SelectValue placeholder="Select result" />
          </SelectTrigger>
          <SelectContent>
            {RESULTS.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {resultHint && <p className="text-xs text-muted-foreground">{resultHint}</p>}
      </div>

      {showStructured && (
        <>
          <div className="space-y-1">
            <Label className="text-sm">Findings</Label>
            <Textarea
              value={findings}
              onChange={(e) => setFindings(e.target.value)}
              placeholder="Optional"
              className="min-h-[60px]"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-sm">Observations</Label>
            <Textarea
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              placeholder="Optional"
              className="min-h-[60px]"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-sm">Final Recommendation</Label>
            <Textarea
              value={recommendation}
              onChange={(e) => setRecommendation(e.target.value)}
              placeholder="Optional"
              className="min-h-[60px]"
            />
          </div>
        </>
      )}

      <Button
        onClick={handle}
        disabled={!canComplete || busy}
        className="w-full bg-green-600 hover:bg-green-700 text-white"
      >
        <CheckCircle className="h-4 w-4 mr-2" />
        {busy ? 'Completing…' : completeLabel}
      </Button>
      {!canComplete && (
        <p className="text-xs text-muted-foreground text-center">
          {resultLabel} and Remark are required to complete.
        </p>
      )}
    </div>
  );
};
