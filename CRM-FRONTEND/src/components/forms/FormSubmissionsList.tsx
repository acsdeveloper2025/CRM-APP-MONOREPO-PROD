import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormSubmission } from '@/types/form';
import { Search, Filter, SortAsc, SortDesc, FileText, Clock, User, MapPin, Camera, Eye } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface FormSubmissionsListProps {
  submissions: FormSubmission[];
  isLoading?: boolean;
  onSubmissionSelect?: (submission: FormSubmission) => void;
  showSearch?: boolean;
  showFilters?: boolean;
  showSorting?: boolean;
}

type SortField = 'submittedAt' | 'formType' | 'status' | 'submittedByName';
type SortDirection = 'asc' | 'desc';

export const FormSubmissionsList: React.FC<FormSubmissionsListProps> = ({
  submissions,
  isLoading = false,
  onSubmissionSelect,
  showSearch = true,
  showFilters = true,
  showSorting = true,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [formTypeFilter, setFormTypeFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('submittedAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Get unique form types and statuses for filters
  const formTypes = useMemo(() => {
    const types = [...new Set(submissions.map(s => s.formType))];
    return types.sort();
  }, [submissions]);

  const statuses = useMemo(() => {
    const statusList = [...new Set(submissions.map(s => s.status))];
    return statusList.sort();
  }, [submissions]);

  // Filter and sort submissions
  const filteredAndSortedSubmissions = useMemo(() => {
    let filtered = submissions;

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(submission =>
        submission.formType.toLowerCase().includes(query) ||
        submission.submittedByName.toLowerCase().includes(query) ||
        submission.outcome.toLowerCase().includes(query) ||
        submission.caseId.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(submission => submission.status === statusFilter);
    }

    // Apply form type filter
    if (formTypeFilter !== 'all') {
      filtered = filtered.filter(submission => submission.formType === formTypeFilter);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      if (sortField === 'submittedAt') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      }

      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return filtered;
  }, [submissions, searchQuery, statusFilter, formTypeFilter, sortField, sortDirection]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SUBMITTED':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300';
      case 'UNDER_REVIEW':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300';
      case 'APPROVED':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
      case 'REJECTED':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getValidationColor = (status: string) => {
    switch (status) {
      case 'VALID':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
      case 'INVALID':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300';
      case 'WARNING':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getFormTypeLabel = (formType: string) => {
    return formType
      .split(/[-_]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2">Loading form submissions...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      {(showSearch || showFilters || showSorting) && (
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col space-y-4 md:flex-row md:space-y-0 md:space-x-4">
              {/* Search */}
              {showSearch && (
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search submissions..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              )}

              {/* Filters */}
              {showFilters && (
                <>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full md:w-40">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      {statuses.map(status => (
                        <SelectItem key={status} value={status}>
                          {status.replace('_', ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={formTypeFilter} onValueChange={setFormTypeFilter}>
                    <SelectTrigger className="w-full md:w-40">
                      <SelectValue placeholder="Form Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      {formTypes.map(type => (
                        <SelectItem key={type} value={type}>
                          {getFormTypeLabel(type)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              )}

              {/* Sort */}
              {showSorting && (
                <Select value={`${sortField}-${sortDirection}`} onValueChange={(value) => {
                  const [field, direction] = value.split('-') as [SortField, SortDirection];
                  setSortField(field);
                  setSortDirection(direction);
                }}>
                  <SelectTrigger className="w-full md:w-48">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="submittedAt-desc">Latest First</SelectItem>
                    <SelectItem value="submittedAt-asc">Oldest First</SelectItem>
                    <SelectItem value="formType-asc">Form Type A-Z</SelectItem>
                    <SelectItem value="formType-desc">Form Type Z-A</SelectItem>
                    <SelectItem value="status-asc">Status A-Z</SelectItem>
                    <SelectItem value="status-desc">Status Z-A</SelectItem>
                    <SelectItem value="submittedByName-asc">Submitter A-Z</SelectItem>
                    <SelectItem value="submittedByName-desc">Submitter Z-A</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Results count */}
            <div className="mt-4 text-sm text-muted-foreground">
              Showing {filteredAndSortedSubmissions.length} of {submissions.length} submissions
            </div>
          </CardContent>
        </Card>
      )}

      {/* Submissions List */}
      <div className="space-y-4">
        {filteredAndSortedSubmissions.length > 0 ? (
          filteredAndSortedSubmissions.map((submission) => (
            <Card key={submission.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-2">
                    {/* Header */}
                    <div className="flex items-center space-x-3">
                      <FileText className="h-5 w-5 text-blue-600" />
                      <h3 className="font-medium text-lg">
                        {getFormTypeLabel(submission.formType)} Form
                      </h3>
                      <Badge className={getStatusColor(submission.status)}>
                        {submission.status.replace('_', ' ')}
                      </Badge>
                      <Badge className={getValidationColor(submission.validationStatus)}>
                        {submission.validationStatus}
                      </Badge>
                    </div>

                    {/* Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4" />
                        <span>{submission.submittedByName}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Clock className="h-4 w-4" />
                        <span>{formatDistanceToNow(new Date(submission.submittedAt), { addSuffix: true })}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <MapPin className="h-4 w-4" />
                        <span>{submission.geoLocation.address || 'Location captured'}</span>
                      </div>
                      {submission.photos && submission.photos.length > 0 && (
                        <div className="flex items-center space-x-2">
                          <Camera className="h-4 w-4" />
                          <span>{submission.photos.length} photos</span>
                        </div>
                      )}
                    </div>

                    {/* Outcome */}
                    <div className="text-sm">
                      <span className="font-medium">Outcome:</span> {submission.outcome}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-2">
                    {onSubmissionSelect && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onSubmissionSelect(submission)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="p-6 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No Submissions Found</h3>
              <p className="text-muted-foreground">
                {submissions.length === 0
                  ? 'No form submissions have been made for this case yet.'
                  : 'No submissions match your current filters. Try adjusting your search criteria.'}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};
