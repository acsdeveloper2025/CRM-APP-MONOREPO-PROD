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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFormSubmissions, useFormValidationStatus } from '@/hooks/useAnalytics';
import { FileText, CheckCircle, Clock, AlertCircle, Download, Filter } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { FormSubmissionQuery } from '@/services/analytics';

export const FormSubmissionsDashboard: React.FC = () => {
  const [filters, setFilters] = useState<FormSubmissionQuery>({
    limit: 50,
    offset: 0,
  });

  const { data: submissionsData, isLoading: submissionsLoading } = useFormSubmissions(filters);
  const { data: validationData, isLoading: validationLoading } = useFormValidationStatus({
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
  });

  const submissions = submissionsData?.data?.submissions || [];
  const summary = submissionsData?.data?.summary;
  const validationSummary = validationData?.data?.summary;

  const handleFilterChange = (key: keyof FormSubmissionQuery, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value || undefined,
      offset: 0, // Reset pagination when filters change
    }));
  };

  const getValidationStatusColor = (status: string) => {
    switch (status) {
      case 'VALID':
        return 'bg-green-100 text-green-800';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'INVALID':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-muted text-foreground';
    }
  };

  const getFormTypeColor = (type: string) => {
    switch (type) {
      case 'RESIDENCE':
        return 'bg-blue-100 text-blue-800';
      case 'OFFICE':
        return 'bg-purple-100 text-purple-800';
      case 'BUSINESS':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-muted text-foreground';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Form Submissions</h1>
          <p className="mt-2 text-muted-foreground">
            Track and analyze all form submissions with validation status
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
            <p className="text-xs text-muted-foreground">
              All form submissions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valid Submissions</CardTitle>
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
            <p className="text-xs text-muted-foreground">
              Awaiting validation
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Form Types</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(summary?.residenceForms || 0) + (summary?.officeForms || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {summary?.residenceForms || 0} residence, {summary?.officeForms || 0} office
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Filter className="h-5 w-5" />
            <span>Filters</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-5">
            <div className="space-y-2">
              <Label htmlFor="formType">Form Type</Label>
              <Select 
                value={filters.formType || ''} 
                onValueChange={(value) => handleFilterChange('formType', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All types</SelectItem>
                  <SelectItem value="RESIDENCE">Residence</SelectItem>
                  <SelectItem value="OFFICE">Office</SelectItem>
                  <SelectItem value="BUSINESS">Business</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="validationStatus">Status</Label>
              <Select 
                value={filters.validationStatus || ''} 
                onValueChange={(value) => handleFilterChange('validationStatus', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All statuses</SelectItem>
                  <SelectItem value="VALID">Valid</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="INVALID">Invalid</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateFrom">From Date</Label>
              <Input
                id="dateFrom"
                type="date"
                value={filters.dateFrom || ''}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateTo">To Date</Label>
              <Input
                id="dateTo"
                type="date"
                value={filters.dateTo || ''}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="caseId">Case ID</Label>
              <Input
                id="caseId"
                placeholder="Search by case..."
                value={filters.caseId || ''}
                onChange={(e) => handleFilterChange('caseId', e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Submissions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Form Submissions</CardTitle>
          <CardDescription>
            {submissions.length > 0 
              ? `Showing ${submissions.length} submission${submissions.length === 1 ? '' : 's'}`
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
                {submissionsLoading ? (
                  // Loading skeleton
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
                        Try adjusting your filters or check back later.
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
