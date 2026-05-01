import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
} from 'lucide-react';
import {
  useKYCTasksForCase,
  useVerifyKYCDocument,
  useUploadKYCDocument,
  useAssignKYCTask,
} from '@/hooks/useKYC';
import type { KYCTask } from '@/services/kyc';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { apiService } from '@/services/api';
import { useQuery } from '@tanstack/react-query';

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
  const { mutateAsync: verifyDoc, isPending: isVerifying } = useVerifyKYCDocument();
  const { mutateAsync: uploadDoc } = useUploadKYCDocument();
  const { mutateAsync: assignDoc } = useAssignKYCTask();

  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});
  const [assignUser, setAssignUser] = useState<Record<string, string>>({});

  // Fetch users for assignment dropdown (only when not readonly)
  const { data: usersData } = useQuery({
    queryKey: ['users-for-kyc-assign'],
    queryFn: async () => {
      const res = await apiService.get('/users', {
        limit: 200,
        isActive: 'true',
        role: 'KYC_VERIFIER',
      });
      return res.data as Array<{ id: string; name: string; employeeId: string }>;
    },
    staleTime: 5 * 60 * 1000,
    enabled: !readonly,
  });
  const users = usersData || [];

  const handleVerify = async (docId: string, status: 'PASS' | 'FAIL' | 'REFER') => {
    if (status === 'FAIL' && !rejectionReasons[docId]?.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }
    try {
      await verifyDoc({
        taskId: docId,
        data: {
          status,
          remarks: remarks[docId]?.trim() || undefined,
          rejectionReason: status === 'FAIL' ? rejectionReasons[docId]?.trim() : undefined,
        },
      });
      toast.success(`Document marked as ${status}`);
      setExpandedDoc(null);
    } catch {
      toast.error('Failed to verify document');
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
        <CardContent className="py-8 text-center text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
          Loading KYC documents...
        </CardContent>
      </Card>
    );
  }

  if (kycTasks.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-gray-500">
          No KYC documents linked to this task.
        </CardContent>
      </Card>
    );
  }

  const pendingCount = kycTasks.filter((t: KYCTask) => t.verificationStatus === 'PENDING').length;
  const passedCount = kycTasks.filter((t: KYCTask) => t.verificationStatus === 'PASS').length;
  const failedCount = kycTasks.filter((t: KYCTask) => t.verificationStatus === 'FAIL').length;

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
              {passedCount} Passed
            </Badge>
            {failedCount > 0 && (
              <Badge variant="outline" className="bg-red-50">
                {failedCount} Failed
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {kycTasks.map((doc: KYCTask) => {
          const statusConf = STATUS_CONFIG[doc.verificationStatus] || STATUS_CONFIG.PENDING;
          const StatusIcon = statusConf.icon;
          const isExpanded = expandedDoc === doc.id;
          const isPending = doc.verificationStatus === 'PENDING';
          const customFields =
            doc.documentDetails && Object.keys(doc.documentDetails).length > 0
              ? doc.documentDetails
              : null;

          return (
            <div
              key={doc.id}
              className={`border rounded-lg overflow-hidden ${isPending ? 'border-yellow-200' : 'border-gray-200'}`}
            >
              {/* Document header row */}
              <button
                type="button"
                className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 transition-colors"
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
                  <div className="text-xs text-gray-500 mt-0.5">
                    {doc.documentNumber && <span>#{doc.documentNumber} · </span>}
                    {doc.documentHolderName && <span>{doc.documentHolderName} · </span>}
                    {doc.assignedToName ? `Assigned: ${doc.assignedToName}` : 'Unassigned'}
                  </div>
                </div>
                <Badge className={`text-xs shrink-0 ${statusConf.color}`}>
                  {doc.verificationStatus}
                </Badge>
              </button>

              {/* Expanded section */}
              {isExpanded && (
                <div className="border-t bg-gray-50/50 p-4 space-y-4">
                  {/* Document details grid */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div>
                      <p className="text-xs text-gray-500">Document Number</p>
                      <p className="text-sm font-medium font-mono">{doc.documentNumber || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Holder Name</p>
                      <p className="text-sm font-medium">{doc.documentHolderName || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Created</p>
                      <p className="text-sm">{format(new Date(doc.createdAt), 'dd MMM yyyy')}</p>
                    </div>
                  </div>

                  {/* Custom fields from LOS */}
                  {customFields && (
                    <div className="border rounded p-3 bg-blue-50/50">
                      <p className="text-xs font-semibold text-gray-600 mb-2">
                        Verification Details
                      </p>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {Object.entries(customFields).map(([key, value]) => (
                          <div key={key}>
                            <p className="text-xs text-gray-500">
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
                    <div className="border rounded p-3 bg-gray-50">
                      <p className="text-xs font-semibold text-gray-600 mb-1">Description</p>
                      <p className="text-sm">{doc.description}</p>
                    </div>
                  )}

                  {/* Document file */}
                  {doc.documentFilePath ? (
                    <div className="flex items-center gap-2 p-2 bg-white border rounded">
                      <FileText className="h-4 w-4 text-blue-500 shrink-0" />
                      <span className="text-sm flex-1 truncate">{doc.documentFileName}</span>
                      <Button variant="outline" size="sm" asChild>
                        <a href={doc.documentFilePath} target="_blank" rel="noopener noreferrer">
                          <Download className="h-3.5 w-3.5 mr-1" /> View
                        </a>
                      </Button>
                    </div>
                  ) : isPending && !readonly ? (
                    <label className="flex items-center gap-2 p-3 bg-white border border-dashed rounded cursor-pointer hover:bg-gray-50 transition-colors text-sm text-gray-500">
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
                    <div className="text-sm text-gray-400 italic">No document uploaded</div>
                  )}

                  {/* Assignment */}
                  {isPending && !readonly && (
                    <div className="flex items-center gap-2">
                      <UserPlus className="h-4 w-4 text-gray-400 shrink-0" />
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

                  {/* Previous verification result */}
                  {!isPending && (
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

                  {/* Verification actions (only for PENDING, hidden in readonly mode) */}
                  {isPending && !readonly && (
                    <div className="space-y-3 pt-2 border-t">
                      <div>
                        <Label className="text-xs">Remarks (Optional)</Label>
                        <Textarea
                          placeholder="Add observations..."
                          className="text-sm min-h-[60px]"
                          value={remarks[doc.id] || ''}
                          onChange={(e) =>
                            setRemarks((prev) => ({ ...prev, [doc.id]: e.target.value }))
                          }
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Rejection Reason (Required for Fail)</Label>
                        <Input
                          placeholder="Why verification failed..."
                          className="text-sm h-8"
                          value={rejectionReasons[doc.id] || ''}
                          onChange={(e) =>
                            setRejectionReasons((prev) => ({ ...prev, [doc.id]: e.target.value }))
                          }
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white flex-1"
                          onClick={() => handleVerify(doc.id, 'PASS')}
                          disabled={isVerifying}
                        >
                          <CheckCircle className="h-3.5 w-3.5 mr-1" /> Verified
                        </Button>
                        <Button
                          size="sm"
                          className="bg-red-600 hover:bg-red-700 text-white flex-1"
                          onClick={() => handleVerify(doc.id, 'FAIL')}
                          disabled={isVerifying}
                        >
                          <XCircle className="h-3.5 w-3.5 mr-1" /> Not Verified
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
