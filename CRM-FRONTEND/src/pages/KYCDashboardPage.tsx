import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Download,
  RefreshCw,
  Search,
  Eye,
  AlertTriangle,
} from 'lucide-react';
import { useKYCTasks, useKYCDocumentTypes } from '@/hooks/useKYC';
import { kycService } from '@/services/kyc';
import { format } from 'date-fns';

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  PASS: 'bg-green-100 text-green-800 border-green-200',
  FAIL: 'bg-red-100 text-red-800 border-red-200',
  REFER: 'bg-purple-100 text-purple-800 border-purple-200',
};

const CATEGORY_COLORS: Record<string, string> = {
  IDENTITY: 'bg-blue-100 text-blue-700',
  FINANCIAL: 'bg-emerald-100 text-emerald-700',
  BUSINESS: 'bg-violet-100 text-violet-700',
  ADDRESS: 'bg-orange-100 text-orange-700',
  PROPERTY: 'bg-teal-100 text-teal-700',
  LEGAL: 'bg-red-100 text-red-700',
  VERIFICATION: 'bg-indigo-100 text-indigo-700',
  MEDICAL: 'bg-pink-100 text-pink-700',
  OTHER: 'bg-gray-100 text-gray-700',
};

export const KYCDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [docTypeFilter, setDocTypeFilter] = useState('ALL');

  const { data: docTypes = [] } = useKYCDocumentTypes();
  const { data: taskData, isLoading, refetch } = useKYCTasks({
    page,
    limit: 20,
    search: search || undefined,
    status: statusFilter !== 'ALL' ? statusFilter : undefined,
    documentType: docTypeFilter !== 'ALL' ? docTypeFilter : undefined,
  });

  const tasks = taskData?.data || [];
  const pagination = taskData?.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 };
  const stats = taskData?.statistics || { total: 0, pending: 0, passed: 0, failed: 0, referred: 0 };

  const handleExport = () => {
    const url = kycService.getExportUrl({
      status: statusFilter !== 'ALL' ? statusFilter : undefined,
      documentType: docTypeFilter !== 'ALL' ? docTypeFilter : undefined,
    });
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">KYC Document Verification</h1>
          <p className="text-sm text-gray-500 mt-1">Verify identity, financial, and address documents</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-1" /> Export Excel
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
            <FileText className="h-8 w-8 text-blue-500" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Pending</p>
              <p className="text-2xl font-bold">{stats.pending}</p>
            </div>
            <Clock className="h-8 w-8 text-yellow-500" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Passed</p>
              <p className="text-2xl font-bold">{stats.passed}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-500" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Failed</p>
              <p className="text-2xl font-bold">{stats.failed}</p>
            </div>
            <XCircle className="h-8 w-8 text-red-500" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Referred</p>
              <p className="text-2xl font-bold">{stats.referred}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-purple-500" />
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Customer name, document number..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                />
              </div>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="PASS">Passed</SelectItem>
                  <SelectItem value="FAIL">Failed</SelectItem>
                  <SelectItem value="REFER">Referred</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Document Type</Label>
              <Select value={docTypeFilter} onValueChange={(v) => { setDocTypeFilter(v); setPage(1); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Types</SelectItem>
                  {docTypes.map((dt) => (
                    <SelectItem key={dt.code} value={dt.code}>{dt.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>KYC Tasks ({pagination.total})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No KYC tasks found</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Case #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Document</TableHead>
                    <TableHead>Doc Number</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.map((task) => (
                    <TableRow key={task.id} className="hover:bg-gray-50">
                      <TableCell className="font-medium">#{task.caseNumber}</TableCell>
                      <TableCell>{task.customerName}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_COLORS[task.documentCategory] || 'bg-gray-100 text-gray-700'}`}>
                          {task.documentCategory}
                        </span>
                      </TableCell>
                      <TableCell>{task.documentTypeName}</TableCell>
                      <TableCell className="font-mono text-sm">{task.documentNumber || '-'}</TableCell>
                      <TableCell>
                        <Badge className={STATUS_COLORS[task.verificationStatus] || ''}>
                          {task.verificationStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>{task.assignedToName || <span className="text-gray-400">Unassigned</span>}</TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {format(new Date(task.createdAt), 'dd MMM yyyy')}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/kyc/verify/${task.id}`)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          {task.verificationStatus === 'PENDING' ? 'Verify' : 'View'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <span className="text-sm text-gray-500">
                    Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
                  </span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                      Previous
                    </Button>
                    <Button variant="outline" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)}>
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
