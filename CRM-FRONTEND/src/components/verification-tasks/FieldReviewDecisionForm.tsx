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
import { toast } from 'sonner';
import { VerificationTasksService } from '@/services/verificationTasks';

// Mandatory backend review (Layer 2). A backend user records the OFFICIAL
// Backend Final Result on a SUBMITTED_FOR_REVIEW field task and completes it.
// This is a separate decision layer — it NEVER overwrites the field
// executive's submission (FE result / remarks / photos / GPS). FE and Backend
// results are preserved independently and may differ.
const RESULTS = ['Positive', 'Negative', 'Refer', 'Fraud'] as const;

interface FieldReviewDecisionFormProps {
  taskId: string;
  onCompleted?: () => void;
}

export const FieldReviewDecisionForm: React.FC<FieldReviewDecisionFormProps> = ({
  taskId,
  onCompleted,
}) => {
  const [result, setResult] = useState('');
  const [remarks, setRemarks] = useState('');
  const [findings, setFindings] = useState('');
  const [observations, setObservations] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [busy, setBusy] = useState(false);

  const canComplete = remarks.trim().length > 0 && result.length > 0;

  const handleComplete = async () => {
    if (!canComplete || busy) {
      return;
    }
    setBusy(true);
    try {
      await VerificationTasksService.finalizeFieldReview(taskId, {
        backendFinalResult: result,
        remarks: remarks.trim(),
        findings: findings.trim() || undefined,
        observations: observations.trim() || undefined,
        recommendation: recommendation.trim() || undefined,
      });
      toast.success(`Verification finalized — ${result}`);
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
      {/* Backend Final Result — mandatory, the official company decision. */}
      <div className="space-y-1">
        <Label className="text-sm">
          Backend Final Result <span className="text-red-500">*</span>
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
        <p className="text-xs text-muted-foreground">
          The official company decision. May differ from the field executive&apos;s result; both are
          preserved.
        </p>
      </div>

      {/* Backend Remarks — mandatory. */}
      <div className="space-y-1">
        <Label className="text-sm">
          Backend Remarks <span className="text-red-500">*</span>
        </Label>
        <Textarea
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="Backend review observations / findings..."
          className="min-h-[80px]"
        />
      </div>

      {/* Optional structured fields. */}
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

      <Button
        onClick={handleComplete}
        disabled={!canComplete || busy}
        className="w-full bg-green-600 hover:bg-green-700 text-white"
      >
        <CheckCircle className="h-4 w-4 mr-2" />
        {busy ? 'Finalizing…' : 'Complete Verification'}
      </Button>
      {!canComplete && (
        <p className="text-xs text-muted-foreground text-center">
          Backend Result and Remarks are required to complete.
        </p>
      )}
    </div>
  );
};
