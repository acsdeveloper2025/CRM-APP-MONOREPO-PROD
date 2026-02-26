import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { useFormSubmissions } from '@/hooks/useAnalytics';
import { FileText, CheckCircle, Clock, AlertCircle, Download, Calendar } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const COLORS = {
  VALID: '#10b981',
  PENDING: '#f59e0b', 
  INVALID: '#ef4444',
  RESIDENCE: '#3b82f6',
  OFFICE: '#8b5cf6',
  BUSINESS: '#f97316'
};

export const FormSubmissionsTable: React.FC = () => {
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Reset to page 1 when date range changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [dateRange.from, dateRange.to]);

  const { data: submissionsData, isLoading } = useFormSubmissions({
    page: currentPage,
    limit: pageSize,
    dateFrom: dateRange.from || undefined,
    dateTo: dateRange.to || undefined,
  });

  const submissions = submissionsData?.data?.submissions || [];
  const summary = submissionsData?.data?.summary;

  // Prepare chart data
  const validationStatusData = [
    { name: 'Valid', value: summary?.validSubmissions || 0, color: COLORS.VALID },
    { name: 'Pending', value: summary?.pendingSubmissions || 0, color: COLORS.PENDING },
    { name: 'Invalid', value: (summary?.totalSubmissions || 0) - (summary?.validSubmissions || 0) - (summary?.pendingSubmissions || 0), color: COLORS.INVALID }
  ].filter(item => item.value > 0);

  const formTypeData = [
    { name: 'Residence', value: summary?.residenceForms || 0, color: COLORS.RESIDENCE },
    { name: 'Office', value: summary?.officeForms || 0, color: COLORS.OFFICE },
    { name: 'Business', value: (summary?.totalSubmissions || 0) - (summary?.residenceForms || 0) - (summary?.officeForms || 0), color: COLORS.BUSINESS }
  ].filter(item => item.value > 0);

  const getValidationStatusColor = (status: string) => {
    switch (status) {
      case 'VALID': return 'bg-green-100 text-green-800';
      case 'PENDING': return 'bg-yellow-100 text-yellow-800';
      case 'INVALID': return 'bg-red-100 text-red-800';
      default: return 'bg-slate-100 text-slate-900 dark:bg-slate-800/60 dark:text-slate-100';
    }
  };

  const getFormTypeColor = (type: string) => {
    switch (type) {
      case 'RESIDENCE': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
      case 'OFFICE': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
      case 'BUSINESS': return 'bg-yellow-100 text-orange-800 dark:bg-yellow-900/20 dark:text-yellow-300';
      default: return 'bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-200';
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">Form Submissions Analysis</h2>
          <p className="mt-1 text-sm sm:text-base text-gray-600">
            Comprehensive view of all form submissions with validation status and trends
          </p>
        </div>
        <Button variant="outline" className="w-full sm:w-auto">
          <Download className="h-4 w-4 mr-2" />
          Export Data
        </Button>
      </div>

      {/* Date Range Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">Filter by Date Range</CardTitle>
          <CardDescription>Select a date range to filter submissions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="date-from">From Date</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-600 pointer-events-none" />
                <Input
                  id="date-from"
                  type="date"
                  value={dateRange.from}
                  onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="date-to">To Date</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-600 pointer-events-none" />
                <Input
                  id="date-to"
                  type="date"
                  value={dateRange.to}
                  onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => setDateRange({ from: '', to: '' })}
                className="w-full"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Submissions</CardTitle>
            <FileText className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.totalSubmissions || 0}</div>
            <p className="text-xs text-gray-600">All form types</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valid Forms</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{summary?.validSubmissions || 0}</div>
            <p className="text-xs text-gray-600">
              {summary?.validationRate ? `${summary.validationRate.toFixed(1)}% validation rate` : 'No data'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{summary?.pendingSubmissions || 0}</div>
            <p className="text-xs text-gray-600">Awaiting validation</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Residence Forms</CardTitle>
            <AlertCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{summary?.residenceForms || 0}</div>
            <p className="text-xs text-gray-600">
              {summary?.officeForms || 0} office forms
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2">
        {/* Validation Status Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Validation Status Distribution</CardTitle>
            <CardDescription>Current status of all form submissions</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={validationStatusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry: { name?: string; percent?: number }) => `${entry.name || ''} ${((entry.percent || 0) * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {validationStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Form Type Distribution Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Form Type Distribution</CardTitle>
            <CardDescription>Breakdown by form categories</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={formTypeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#8884d8">
                  {formTypeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">Recent Form Submissions</CardTitle>
          <CardDescription>
            {submissions.length > 0
              ? `Showing ${submissions.length} recent submission${submissions.length === 1 ? '' : 's'}`
              : 'No submissions found'
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {/* Responsive table wrapper */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Form Type</TableHead>
                  <TableHead className="whitespace-nowrap">Case</TableHead>
                  <TableHead className="whitespace-nowrap hidden sm:table-cell">Agent</TableHead>
                  <TableHead className="whitespace-nowrap">Status</TableHead>
                  <TableHead className="whitespace-nowrap hidden md:table-cell">Submitted</TableHead>
                  <TableHead className="whitespace-nowrap hidden lg:table-cell">Attachments</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={index}>
                      {Array.from({ length: 6 }).map((_, cellIndex) => (
                        <TableCell key={cellIndex}>
                          <div className="h-4 bg-slate-100 dark:bg-slate-800/60 rounded animate-pulse" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : submissions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <FileText className="mx-auto h-12 w-12 text-gray-600" />
                      <h3 className="mt-4 text-lg font-semibold">No submissions found</h3>
                      <p className="text-gray-600">
                        Form submissions will appear here once agents start submitting data.
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  submissions.map((submission, index) => (
                    <TableRow key={`${submission.case_id}-${index}`}>
                      <TableCell className="whitespace-nowrap">
                        <Badge className={getFormTypeColor(submission.form_type)}>
                          {submission.form_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">#{submission.caseNumber || 'N/A'}</div>
                          <div className="text-sm text-gray-600 truncate max-w-[150px]">{submission.customerName}</div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <div>
                          <div className="font-medium">{submission.agentName || 'Unknown'}</div>
                          <div className="text-sm text-gray-600">{submission.employeeId}</div>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge className={getValidationStatusColor(submission.validation_status)}>
                          {submission.validation_status}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell whitespace-nowrap">
                        <div className="text-sm">
                          {formatDistanceToNow(new Date(submission.submitted_at), { addSuffix: true })}
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="text-sm">
                          {submission.attachmentCount || 0} files
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Controls */}
          {submissionsData?.data?.pagination && (() => {
            const { total, limit } = submissionsData.data.pagination;
            const totalPages = Math.ceil(total / limit);
            return (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t">
                <div className="text-sm text-gray-600 text-center sm:text-left">
                  Showing {submissions.length} of {total} submissions
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="min-w-20"
                  >
                    Previous
                  </Button>
                  <div className="text-sm px-2">
                    Page {currentPage} of {totalPages}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => prev + 1)}
                    disabled={currentPage >= totalPages}
                    className="min-w-20"
                  >
                    Next
                  </Button>
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
};
