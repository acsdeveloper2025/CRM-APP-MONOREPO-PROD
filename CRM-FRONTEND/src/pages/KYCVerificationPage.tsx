import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { LoadingState } from '@/components/ui/loading';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileText,
  User,
  Phone,
  Calendar,
  Download,
} from 'lucide-react';
import { useKYCTaskDetail, useVerifyKYCDocument } from '@/hooks/useKYC';
import { toast } from 'sonner';
import { format } from 'date-fns';

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  PASS: 'bg-green-100 text-green-800',
  FAIL: 'bg-red-100 text-red-800',
  REFER: 'bg-purple-100 text-purple-800',
};

export const KYCVerificationPage: React.FC = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const [remarks, setRemarks] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  const { data: task, isLoading } = useKYCTaskDetail(taskId || '');
  const { mutateAsync: verify, isPending: isVerifying } = useVerifyKYCDocument();

  const handleVerify = async (status: 'PASS' | 'FAIL' | 'REFER') => {
    if (!taskId) {return;}

    if (status === 'FAIL' && !rejectionReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }

    try {
      await verify({
        taskId,
        data: {
          status,
          remarks: remarks.trim() || undefined,
          rejectionReason: status === 'FAIL' ? rejectionReason.trim() : undefined,
        },
      });
      toast.success(`Document marked as ${status}`);
      navigate('/kyc');
    } catch {
      toast.error('Failed to verify document');
    }
  };

  if (isLoading) {return <LoadingState />;}
  if (!task) {return <div className="text-center py-8">KYC task not found</div>;}

  const isPending = task.verification_status === 'PENDING';

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => navigate('/kyc')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div>
          <h1 className="text-xl font-bold">KYC Document Verification</h1>
          <p className="text-sm text-gray-500">Case #{task.case_number} — {task.task_number}</p>
        </div>
        <Badge className={STATUS_COLORS[task.verification_status] || ''}>
          {task.verification_status}
        </Badge>
      </div>

      {/* Customer Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Customer Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Customer Name</p>
                <p className="font-medium">{task.customer_name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Phone</p>
                <p className="font-medium">{task.customer_phone || '-'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Case Status</p>
                <p className="font-medium">{task.case_status}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Created</p>
                <p className="font-medium">{format(new Date(task.created_at), 'dd MMM yyyy')}</p>
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
              <p className="text-xs text-gray-500">Document Type</p>
              <p className="font-medium">{task.document_type_name}</p>
              <Badge variant="outline" className="mt-1 text-xs">
                {task.document_category}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-gray-500">Document Number</p>
              <p className="font-medium font-mono">{task.document_number || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Document Holder</p>
              <p className="font-medium">{task.document_holder_name || task.customer_name}</p>
            </div>
          </div>

          {/* Custom Fields (from LOS) */}
          {task.document_details && Object.keys(task.document_details).length > 0 && (
            <div className="border rounded-lg p-3 bg-blue-50/50">
              <p className="text-xs font-semibold text-gray-600 mb-2">Verification Details</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {Object.entries(task.document_details).map(([key, value]) => (
                  <div key={key}>
                    <p className="text-xs text-gray-500">{key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
                    <p className="font-medium text-sm">{value || '-'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          {task.description && (
            <div className="border rounded-lg p-3 bg-gray-50">
              <p className="text-xs font-semibold text-gray-600 mb-1">Description</p>
              <p className="text-sm text-gray-700">{task.description}</p>
            </div>
          )}

          {/* Document File */}
          {task.document_file_path ? (
            <div className="border rounded-lg p-4 bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="font-medium">{task.document_file_name}</p>
                    <p className="text-xs text-gray-500">Uploaded document</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <a href={task.document_file_path} target="_blank" rel="noopener noreferrer">
                    <Download className="h-4 w-4 mr-1" /> View
                  </a>
                </Button>
              </div>
            </div>
          ) : (
            <div className="border rounded-lg p-4 bg-yellow-50 text-yellow-700 text-sm">
              No document uploaded yet
            </div>
          )}

          {/* Previous verification result */}
          {!isPending && (
            <div className={`border rounded-lg p-4 ${
              task.verification_status === 'PASS' ? 'bg-green-50 border-green-200' :
              task.verification_status === 'FAIL' ? 'bg-red-50 border-red-200' :
              'bg-purple-50 border-purple-200'
            }`}>
              <p className="font-medium">Verification Result: {task.verification_status}</p>
              {task.verified_by_name && <p className="text-sm mt-1">Verified by: {task.verified_by_name}</p>}
              {task.verified_at && <p className="text-sm">Date: {format(new Date(task.verified_at), 'dd MMM yyyy HH:mm')}</p>}
              {task.remarks && <p className="text-sm mt-2">Remarks: {task.remarks}</p>}
              {task.rejection_reason && <p className="text-sm text-red-600 mt-1">Reason: {task.rejection_reason}</p>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Verification Actions (only for PENDING) */}
      {isPending && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Verification Decision</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Remarks (Optional)</Label>
              <Textarea
                placeholder="Add any observations or notes..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={3}
              />
            </div>

            <div>
              <Label>Rejection Reason (Required for Fail)</Label>
              <Textarea
                placeholder="Explain why the document verification failed..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={2}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                className="bg-green-600 hover:bg-green-700 text-white flex-1"
                onClick={() => handleVerify('PASS')}
                disabled={isVerifying}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Pass
              </Button>
              <Button
                className="bg-red-600 hover:bg-red-700 text-white flex-1"
                onClick={() => handleVerify('FAIL')}
                disabled={isVerifying}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Fail
              </Button>
              <Button
                className="bg-purple-600 hover:bg-purple-700 text-white flex-1"
                onClick={() => handleVerify('REFER')}
                disabled={isVerifying}
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                Refer
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
