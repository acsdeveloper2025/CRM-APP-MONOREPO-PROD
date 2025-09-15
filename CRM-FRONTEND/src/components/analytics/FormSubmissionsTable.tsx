import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { useFormSubmissions } from '@/hooks/useAnalytics';
import { FileText, CheckCircle, Clock, AlertCircle, Download } from 'lucide-react';
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
  const { data: submissionsData, isLoading } = useFormSubmissions({
    limit: 100,
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
      default: return 'bg-muted text-foreground';
    }
  };

  const getFormTypeColor = (type: string) => {
    switch (type) {
      case 'RESIDENCE': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300';
      case 'OFFICE': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300';
      case 'BUSINESS': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Form Submissions Analysis</h2>
          <p className="mt-1 text-muted-foreground">
            Comprehensive view of all form submissions with validation status and trends
          </p>
        </div>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export Data
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Submissions</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.totalSubmissions || 0}</div>
            <p className="text-xs text-muted-foreground">All form types</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valid Forms</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{summary?.validSubmissions || 0}</div>
            <p className="text-xs text-muted-foreground">
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
            <p className="text-xs text-muted-foreground">Awaiting validation</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Residence Forms</CardTitle>
            <AlertCircle className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{summary?.residenceForms || 0}</div>
            <p className="text-xs text-muted-foreground">
              {summary?.officeForms || 0} office forms
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid gap-6 md:grid-cols-2">
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
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
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
          <CardTitle>Recent Form Submissions</CardTitle>
          <CardDescription>
            {submissions.length > 0 
              ? `Showing ${submissions.length} recent submission${submissions.length === 1 ? '' : 's'}`
              : 'No submissions found'
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Form Type</TableHead>
                  <TableHead>Case</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Attachments</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={index}>
                      {Array.from({ length: 6 }).map((_, cellIndex) => (
                        <TableCell key={cellIndex}>
                          <div className="h-4 bg-muted rounded animate-pulse"></div>
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : submissions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
                      <h3 className="mt-4 text-lg font-semibold">No submissions found</h3>
                      <p className="text-muted-foreground">
                        Form submissions will appear here once agents start submitting data.
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  submissions.map((submission, index) => (
                    <TableRow key={`${submission.case_id}-${index}`}>
                      <TableCell>
                        <Badge className={getFormTypeColor(submission.form_type)}>
                          {submission.form_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">#{submission.caseNumber || 'N/A'}</div>
                          <div className="text-sm text-muted-foreground">{submission.customerName}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{submission.agentName || 'Unknown'}</div>
                          <div className="text-sm text-muted-foreground">{submission.employeeId}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getValidationStatusColor(submission.validation_status)}>
                          {submission.validation_status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {formatDistanceToNow(new Date(submission.submitted_at), { addSuffix: true })}
                        </div>
                      </TableCell>
                      <TableCell>
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
        </CardContent>
      </Card>
    </div>
  );
};
