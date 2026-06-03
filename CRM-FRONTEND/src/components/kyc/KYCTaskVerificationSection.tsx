import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FileText,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Upload,
  Download,
  UserPlus,
  Loader2,
  Pencil,
} from 'lucide-react';
import {
  useKYCTasksForCase,
  useUpdateKYCDetails,
  useUploadKYCDocument,
  useAssignKYCTask,
} from '@/hooks/useKYC';
import { kycService, type KYCTask } from '@/services/kyc';
import { KYCCompletionForm } from '@/components/kyc/KYCCompletionForm';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { apiService } from '@/services/api';
import { useQuery } from '@tanstack/react-query';
import { usePermission } from '@/hooks/usePermissions';

const STATUS_CONFIG: Record<string, { color: string; icon: typeof CheckCircle }> = {
  PENDING: { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: AlertTriangle },
  PASS: { color: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle },
  FAIL: { color: 'bg-red-100 text-red-800 border-red-200', icon: XCircle },
};

interface KYCTaskVerificationSectionProps {
  caseId: string;
  taskId: string;
  readonly?: boolean;
}

export const KYCTaskVerificationSection: React.FC<KYCTaskVerificationSectionProps> = ({
  caseId,
  readonly = false,
}) => {
  const { data: kycTasks = [], isLoading } = useKYCTasksForCase(caseId);
  const { mutateAsync: updateDetails, isPending: isUpdating } = useUpdateKYCDetails();
  const { mutateAsync: uploadDoc } = useUploadKYCDocument();
  const { mutateAsync: assignDoc } = useAssignKYCTask();
  // KYC Verifier read-only model (2026-06-02): findings entry / upload / assign
  // require kyc.complete (Backend User). The read-only verifier sees view only,
  // even though CaseDetailPage passes readonly=false.
  const canComplete = usePermission('kyc.complete');
  const effectiveReadonly = readonly || !canComplete;

  // C2 (2026-06-03): KYC doc bytes are served via a row-scoped, bearer-authed
  // endpoint (raw /uploads/kyc is blocked). Fetch the blob then open it.
  const openKycDocument = async (kdvId: string) => {
    const win = window.open('', '_blank');
    try {
      const url = await kycService.getDocumentObjectUrl(kdvId);
      if (win) {win.location.href = url;} else {window.open(url, '_blank');}
    } catch {
      win?.close();
      toast.error('Could not open the document.');
    }
  };

  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);
  const [assignUser, setAssignUser] = useState<Record<string, string>>({});
  // Inline "edit details" state (number / holder / per-type custom fields).
  const [editingDoc, setEditingDoc] = useState<string | null>(null);
  // Inline "complete verification" state (shared KYCCompletionForm).
  const [completingDoc, setCompletingDoc] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    documentNumber: string;
    documentHolderName: string;
    documentDetails: Record<string, string>;
  }>({ documentNumber: '', documentHolderName: '', documentDetails: {} });

  // Fetch users for assignment dropdown (only when not readonly).
  // Phase 1.4 (2026-05-04): switched from `/users?role=KYC_VERIFIER` (which
  // requires `user.view` and 403'd for case.create-only users like
  // pradnya.mohite) to the new lite endpoint `/users/assignable-by-role`
  // which accepts case.create / user.view / case.assign / case.reassign
  // and returns only id/name/email/employeeId.
  const { data: usersData } = useQuery({
    queryKey: ['users-for-kyc-assign'],
    queryFn: async () => {
      const res = await apiService.get('/users/assignable-by-role', {
        role: 'KYC_VERIFIER',
      });
      return res.data as Array<{ id: string; name: string; employeeId: string }>;
    },
    staleTime: 5 * 60 * 1000,
    enabled: !effectiveReadonly,
  });
  const users = usersData || [];

  const startEdit = (doc: KYCTask) => {
    setEditingDoc(doc.id);
    setEditForm({
      documentNumber: doc.documentNumber || '',
      documentHolderName: doc.documentHolderName || '',
      documentDetails: { ...(doc.documentDetails || {}) },
    });
  };

  const handleSaveDetails = async (docId: string) => {
    try {
      await updateDetails({
        taskId: docId,
        payload: {
          documentNumber: editForm.documentNumber.trim() || undefined,
          documentHolderName: editForm.documentHolderName.trim() || undefined,
          documentDetails: editForm.documentDetails,
        },
      });
      toast.success('KYC details updated');
      setEditingDoc(null);
    } catch {
      toast.error('Failed to update KYC details');
    }
  };

  const handleUpload = async (docId: string, file: File) => {
    try {
      await uploadDoc({ taskId: docId, file });
      toast.success('Document uploaded');
    } catch {
      toast.error('Failed to upload document');
    }
  };

  const handleAssign = async (docId: string) => {
    const userId = assignUser[docId];
    if (!userId) {
      return;
    }
    try {
      await assignDoc({ taskId: docId, assignedTo: userId });
      toast.success('Document assigned');
    } catch {
      toast.error('Failed to assign');
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
          Loading KYC documents...
        </CardContent>
      </Card>
    );
  }

  if (kycTasks.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-muted-foreground">
          No KYC documents linked to this task.
        </CardContent>
      </Card>
    );
  }

  // KYC redesign (2026-06-02): only Pending / Completed are shown.
  const completedCount = kycTasks.filter(
    (t: KYCTask) => t.verificationStatus === 'COMPLETED'
  ).length;
  const pendingCount = kycTasks.length - completedCount;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-amber-600" />
            KYC Document Verification
          </CardTitle>
          <div className="flex gap-2 text-xs">
            <Badge variant="outline" className="bg-yellow-50">
              {pendingCount} Pending
            </Badge>
            <Badge variant="outline" className="bg-green-50">
              {completedCount} Completed
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {kycTasks.map((doc: KYCTask) => {
          const statusConf = STATUS_CONFIG[doc.verificationStatus] || STATUS_CONFIG.PENDING;
          const StatusIcon = statusConf.icon;
          const isExpanded = expandedDoc === doc.id;
          const isPending = doc.verificationStatus === 'PENDING';
          // KYC redesign (2026-06-02): no /start step. A doc is either terminal
          // (COMPLETED/REVOKED, read-only) or open — open docs can be completed
          // directly with the Pass/Fail controls.
          const isTerminal =
            doc.verificationStatus === 'COMPLETED' || doc.verificationStatus === 'REVOKED';
          const customFields =
            doc.documentDetails && Object.keys(doc.documentDetails).length > 0
              ? doc.documentDetails
              : null;

          return (
            <div
              key={doc.id}
              className={`border rounded-lg overflow-hidden ${isPending ? 'border-yellow-200' : 'border-border'}`}
            >
              {/* Document header row */}
              <button
                type="button"
                className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted transition-colors"
                onClick={() => setExpandedDoc(isExpanded ? null : doc.id)}
              >
                <StatusIcon
                  className={`h-4 w-4 shrink-0 ${
                    doc.verificationStatus === 'PASS'
                      ? 'text-green-600'
                      : doc.verificationStatus === 'FAIL'
                        ? 'text-red-600'
                        : 'text-yellow-600'
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{doc.documentTypeName}</span>
                    <Badge variant="outline" className="text-xs">
                      {doc.documentCategory}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {doc.documentNumber && <span>#{doc.documentNumber} · </span>}
                    {doc.documentHolderName && <span>{doc.documentHolderName} · </span>}
                    {doc.assignedToName ? `Assigned: ${doc.assignedToName}` : 'Unassigned'}
                  </div>
                </div>
                <Badge
                  className={`text-xs shrink-0 ${
                    doc.verificationStatus === 'COMPLETED'
                      ? 'bg-green-100 text-green-800 border-green-200'
                      : 'bg-yellow-100 text-yellow-800 border-yellow-200'
                  }`}
                >
                  {doc.verificationStatus === 'COMPLETED' ? 'Completed' : 'Pending'}
                </Badge>
              </button>

              {/* Expanded section */}
              {isExpanded && (
                <div className="border-t bg-muted/50 p-4 space-y-4">
                  {/* Document details grid */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Document Number</p>
                      <p className="text-sm font-medium font-mono">{doc.documentNumber || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Holder Name</p>
                      <p className="text-sm font-medium">{doc.documentHolderName || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Created</p>
                      <p className="text-sm">{format(new Date(doc.createdAt), 'dd MMM yyyy')}</p>
                    </div>
                  </div>

                  {/* Custom fields from LOS */}
                  {customFields && (
                    <div className="border rounded p-3 bg-blue-50/50">
                      <p className="text-xs font-semibold text-muted-foreground mb-2">
                        Verification Details
                      </p>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {Object.entries(customFields).map(([key, value]) => (
                          <div key={key}>
                            <p className="text-xs text-muted-foreground">
                              {key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                            </p>
                            <p className="text-sm font-medium">{value || '-'}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Description */}
                  {doc.description && (
                    <div className="border rounded p-3 bg-muted">
                      <p className="text-xs font-semibold text-muted-foreground mb-1">
                        Description
                      </p>
                      <p className="text-sm">{doc.description}</p>
                    </div>
                  )}

                  {/* Document file */}
                  {doc.documentFilePath ? (
                    <div className="flex items-center gap-2 p-2 bg-card border rounded">
                      <FileText className="h-4 w-4 text-blue-500 shrink-0" />
                      <span className="text-sm flex-1 truncate">{doc.documentFileName}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openKycDocument(doc.id)}
                      >
                        <Download className="h-3.5 w-3.5 mr-1" /> View
                      </Button>
                    </div>
                  ) : isPending && !effectiveReadonly ? (
                    <label className="flex items-center gap-2 p-3 bg-card border border-dashed rounded cursor-pointer hover:bg-muted transition-colors text-sm text-muted-foreground">
                      <Upload className="h-4 w-4" />
                      <span>Upload document</span>
                      <input
                        type="file"
                        aria-label="Upload document"
                        className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleUpload(doc.id, file);
                          }
                        }}
                      />
                    </label>
                  ) : (
                    <div className="text-sm text-muted-foreground italic">No document uploaded</div>
                  )}

                  {/* Assignment */}
                  {isPending && !effectiveReadonly && (
                    <div className="flex items-center gap-2">
                      <UserPlus className="h-4 w-4 text-muted-foreground shrink-0" />
                      <Select
                        value={assignUser[doc.id] || doc.assignedTo || ''}
                        onValueChange={(v) => setAssignUser((prev) => ({ ...prev, [doc.id]: v }))}
                      >
                        <SelectTrigger className="h-8 text-sm flex-1">
                          <SelectValue placeholder="Assign to user..." />
                        </SelectTrigger>
                        <SelectContent>
                          {users.map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.name} ({u.employeeId})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8"
                        onClick={() => handleAssign(doc.id)}
                        disabled={!assignUser[doc.id]}
                      >
                        Assign
                      </Button>
                    </div>
                  )}

                  {/* Previous verification result (terminal states only) */}
                  {isTerminal && (
                    <div
                      className={`border rounded p-3 ${
                        doc.verificationStatus === 'PASS'
                          ? 'bg-green-50 border-green-200'
                          : 'bg-red-50 border-red-200'
                      }`}
                    >
                      <p className="font-medium text-sm">Result: {doc.verificationStatus}</p>
                      {doc.verifiedByName && (
                        <p className="text-xs mt-1">By: {doc.verifiedByName}</p>
                      )}
                      {doc.verifiedAt && (
                        <p className="text-xs">
                          Date: {format(new Date(doc.verifiedAt), 'dd MMM yyyy HH:mm')}
                        </p>
                      )}
                      {doc.remarks && <p className="text-xs mt-1">Remarks: {doc.remarks}</p>}
                      {doc.rejectionReason && (
                        <p className="text-xs text-red-600">Reason: {doc.rejectionReason}</p>
                      )}
                    </div>
                  )}

                  {/* Edit details — fix the document number / holder / per-type
                      custom fields if something was entered wrong or left
                      missing. Completion (Verified / Not Verified) is done on
                      the dedicated KYC verification page, not from this card. */}
                  {!isTerminal &&
                    !effectiveReadonly &&
                    (editingDoc === doc.id ? (
                      <div className="space-y-3 pt-2 border-t">
                        <div>
                          <Label className="text-xs">Document Number</Label>
                          <Input
                            className="text-sm h-8"
                            value={editForm.documentNumber}
                            onChange={(e) =>
                              setEditForm((p) => ({ ...p, documentNumber: e.target.value }))
                            }
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Holder Name</Label>
                          <Input
                            className="text-sm h-8"
                            value={editForm.documentHolderName}
                            onChange={(e) =>
                              setEditForm((p) => ({ ...p, documentHolderName: e.target.value }))
                            }
                          />
                        </div>
                        {(doc.typeCustomFields || []).map((f) => (
                          <div key={f.key}>
                            <Label className="text-xs">
                              {f.label}
                              {f.required && <span className="text-red-500"> *</span>}
                            </Label>
                            <Input
                              type={
                                f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'
                              }
                              className="text-sm h-8"
                              value={editForm.documentDetails[f.key] || ''}
                              onChange={(e) =>
                                setEditForm((p) => ({
                                  ...p,
                                  documentDetails: {
                                    ...p.documentDetails,
                                    [f.key]: e.target.value,
                                  },
                                }))
                              }
                            />
                          </div>
                        ))}
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="flex-1"
                            onClick={() => handleSaveDetails(doc.id)}
                            disabled={isUpdating}
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            onClick={() => setEditingDoc(null)}
                            disabled={isUpdating}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : completingDoc === doc.id ? (
                      <div className="space-y-2 pt-2 border-t">
                        <p className="text-sm font-medium">Complete verification</p>
                        <KYCCompletionForm
                          taskId={doc.id}
                          onCompleted={() => setCompletingDoc(null)}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full"
                          onClick={() => setCompletingDoc(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2 pt-2 border-t">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8"
                          onClick={() => startEdit(doc)}
                        >
                          <Pencil className="h-3.5 w-3.5 mr-1" /> Edit details
                        </Button>
                        <Button
                          size="sm"
                          className="h-8 bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => setCompletingDoc(doc.id)}
                        >
                          <CheckCircle className="h-3.5 w-3.5 mr-1" /> Complete verification
                        </Button>
                      </div>
                    ))}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
