import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingState } from '@/components/ui/loading';
import { ArrowLeft, FileText, User, Phone, Calendar, Download } from 'lucide-react';
import { useKYCTaskDetail, useKYCCycles } from '@/hooks/useKYC';
import { usePermission } from '@/hooks/usePermissions';
import { kycService } from '@/services/kyc';
import { KYCCompletionForm } from '@/components/kyc/KYCCompletionForm';
import { toast } from 'sonner';
import { format } from 'date-fns';

// KYC redesign (2026-06-02): users see only Pending / Completed.
const kycDisplayStatus = (status: string): { label: string; color: string } =>
  status === 'COMPLETED'
    ? { label: 'Completed', color: 'bg-green-100 text-green-800' }
    : { label: 'Pending', color: 'bg-yellow-100 text-yellow-800' };

// Per-cycle outcome tint (cycle history panel).
const OUTCOME_COLORS: Record<string, string> = {
  Positive: 'bg-green-100 text-green-800',
  Negative: 'bg-red-100 text-red-800',
  Fraud: 'bg-red-100 text-red-800',
  Refer: 'bg-purple-100 text-purple-800',
};

export const KYCVerificationPage: React.FC = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();

  const { data: task, isLoading } = useKYCTaskDetail(taskId || '');
  // KYC Verifier read-only model (2026-06-02): only the Backend User (kyc.complete)
  // may enter findings + complete. The read-only verifier sees view + download only.
  const canComplete = usePermission('kyc.complete');
  const { data: cycles = [] } = useKYCCycles(taskId || '');

  // C2 (2026-06-03): KYC files are served via row-scoped, bearer-authed
  // endpoints (raw /uploads/kyc is blocked). Fetch the blob then open it —
  // open the tab synchronously first so the popup blocker doesn't eat it.
  const openKycFile = async (fetchUrl: () => Promise<string>) => {
    const win = window.open('', '_blank');
    try {
      const url = await fetchUrl();
      if (win) {win.location.href = url;} else {window.open(url, '_blank');}
    } catch {
      win?.close();
      toast.error('Could not open the file.');
    }
  };


  if (isLoading) {
    return <LoadingState />;
  }
  if (!task) {
    return <div className="text-center py-8">KYC task not found</div>;
  }

  // KYC redesign (2026-06-02): no /start step. The decision card shows for any
  // non-terminal (Pending) document when the user can complete; completion
  // records the outcome directly. Terminal = COMPLETED/REVOKED (read-only).
  const isTerminal =
    task.verificationStatus === 'COMPLETED' || task.verificationStatus === 'REVOKED';
  const canVerifyNow = !isTerminal && canComplete;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => navigate('/kyc-verification/all-kyc')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div>
          <h1 className="text-xl font-bold">KYC Verification</h1>
          <p className="text-sm text-muted-foreground">
            Case #{task.caseNumber} — {task.taskNumber}
          </p>
        </div>
        <Badge className={kycDisplayStatus(task.verificationStatus).color}>
          {kycDisplayStatus(task.verificationStatus).label}
        </Badge>
      </div>

      {/* Terminal-state banner — explains why the decision card is hidden. */}
      {isTerminal && (
        <div className="bg-muted border border-border rounded-lg px-4 py-3 text-sm">
          {task.verificationStatus === 'COMPLETED' && (
            <span>
              This KYC document has already been verified. The outcome is final and cannot be
              edited.
            </span>
          )}
          {task.verificationStatus === 'REVOKED' && (
            <span>
              This KYC document has been revoked; no further verification actions can be taken.
            </span>
          )}
        </div>
      )}

      {/* Customer Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Customer Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Customer Name</p>
                <p className="font-medium">{task.customerName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Phone</p>
                <p className="font-medium">{task.customerPhone || '-'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Case Status</p>
                <p className="font-medium">{task.caseStatus}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Created</p>
                <p className="font-medium">{format(new Date(task.createdAt), 'dd MMM yyyy')}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Document Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Document Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Document Type</p>
              <p className="font-medium">{task.documentTypeName}</p>
              <Badge variant="outline" className="mt-1 text-xs">
                {task.documentCategory}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Document Number</p>
              <p className="font-medium font-mono">{task.documentNumber || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Document Holder</p>
              <p className="font-medium">{task.documentHolderName || task.customerName}</p>
            </div>
          </div>

          {/* Custom Fields (from LOS) */}
          {task.documentDetails && Object.keys(task.documentDetails).length > 0 && (
            <div className="border rounded-lg p-3 bg-blue-50/50">
              <p className="text-xs font-semibold text-muted-foreground mb-2">
                Verification Details
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {Object.entries(task.documentDetails).map(([key, value]) => (
                  <div key={key}>
                    <p className="text-xs text-muted-foreground">
                      {key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                    </p>
                    <p className="font-medium text-sm">{value || '-'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          {task.description && (
            <div className="border rounded-lg p-3 bg-muted">
              <p className="text-xs font-semibold text-muted-foreground mb-1">Description</p>
              <p className="text-sm text-foreground">{task.description}</p>
            </div>
          )}

          {/* Document File */}
          {task.documentFilePath ? (
            <div className="border rounded-lg p-4 bg-muted">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="font-medium">{task.documentFileName}</p>
                    <p className="text-xs text-muted-foreground">Uploaded document</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openKycFile(() => kycService.getDocumentObjectUrl(taskId || ''))}
                >
                  <Download className="h-4 w-4 mr-1" /> View
                </Button>
              </div>
            </div>
          ) : (
            <div className="border rounded-lg p-4 bg-yellow-50 text-yellow-700 text-sm">
              No document uploaded yet
            </div>
          )}

          {/* Previous verification result (terminal states only) */}
          {isTerminal && (
            <div
              className={`border rounded-lg p-4 ${
                task.verificationStatus === 'PASS'
                  ? 'bg-green-50 border-green-200'
                  : task.verificationStatus === 'FAIL'
                    ? 'bg-red-50 border-red-200'
                    : 'bg-purple-50 border-purple-200'
              }`}
            >
              <p className="font-medium">Verification Result: {task.verificationStatus}</p>
              {task.verifiedByName && (
                <p className="text-sm mt-1">Verified by: {task.verifiedByName}</p>
              )}
              {task.verifiedAt && (
                <p className="text-sm">
                  Date: {format(new Date(task.verifiedAt), 'dd MMM yyyy HH:mm')}
                </p>
              )}
              {task.remarks && <p className="text-sm mt-2">Remarks: {task.remarks}</p>}
              {task.rejectionReason && (
                <p className="text-sm text-red-600 mt-1">Reason: {task.rejectionReason}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Verification Decision — shown for any non-terminal doc (no Start step);
          only for the Backend User executor (kyc.complete). Single mandatory
          Remark + KYC Result dropdown + optional verifier document; Complete
          stays disabled until Remark + Result are filled. */}
      {canVerifyNow && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Verification Decision</CardTitle>
          </CardHeader>
          <CardContent>
            <KYCCompletionForm
              taskId={taskId || ''}
              onCompleted={() => navigate('/kyc-verification/all-kyc')}
            />
          </CardContent>
        </Card>
      )}

      {/* P6 (2026-06-02): per-cycle reverification history. Each cycle is an
          immutable record — reverification never overwrites a prior cycle. */}
      {cycles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Verification Cycles ({cycles.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {cycles.map((cy) => (
              <div
                key={cy.cycle_number}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="outline">Cycle {cy.cycle_number}</Badge>
                  <Badge className={OUTCOME_COLORS[cy.final_status || ''] || 'bg-muted text-foreground'}>
                    {cy.status}
                  </Badge>
                  {cy.final_status && (
                    <span className="text-muted-foreground">{cy.final_status}</span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-muted-foreground">
                  {cy.assigned_verifier_name && <span>Verifier: {cy.assigned_verifier_name}</span>}
                  {cy.completed_by_name && <span>By: {cy.completed_by_name}</span>}
                  {cy.completed_at && (
                    <span>{format(new Date(cy.completed_at), 'dd MMM yyyy')}</span>
                  )}
                  {cy.rate_amount && <span>₹{cy.rate_amount}</span>}
                  {cy.report_file_path && (
                    <button
                      type="button"
                      onClick={() =>
                        openKycFile(() =>
                          kycService.getCycleReportObjectUrl(taskId || '', cy.cycle_number)
                        )
                      }
                      className="inline-flex items-center text-primary hover:underline"
                    >
                      <Download className="h-3.5 w-3.5 mr-1" />
                      {cy.report_file_name || 'Report'}
                    </button>
                  )}
                  <Badge variant="outline" className={cy.billed ? 'bg-green-50' : 'bg-yellow-50'}>
                    {cy.billed ? 'Billed' : 'Billable'}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
