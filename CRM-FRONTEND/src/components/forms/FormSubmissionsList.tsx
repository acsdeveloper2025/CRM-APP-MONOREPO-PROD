import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/ui/components/card';
import { Input } from '@/ui/components/input';
import { Button } from '@/ui/components/button';
import { Badge } from '@/ui/components/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/components/select';
import { FormSubmission } from '@/types/form';
import { Search, FileText, Clock, User, MapPin, Camera, Eye } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Box } from '@/ui/primitives/Box';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';

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

  const formTypes = useMemo(() => [...new Set(submissions.map((s) => s.formType))].sort(), [submissions]);
  const statuses = useMemo(() => [...new Set(submissions.map((s) => s.status))].sort(), [submissions]);

  const filteredAndSortedSubmissions = useMemo(() => {
    let filtered = submissions;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((submission) =>
        submission.formType.toLowerCase().includes(query) ||
        submission.submittedByName.toLowerCase().includes(query) ||
        submission.outcome.toLowerCase().includes(query) ||
        submission.caseId.toLowerCase().includes(query)
      );
    }
    if (statusFilter !== 'all') {
      filtered = filtered.filter((submission) => submission.status === statusFilter);
    }
    if (formTypeFilter !== 'all') {
      filtered = filtered.filter((submission) => submission.formType === formTypeFilter);
    }
    filtered.sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];
      if (sortField === 'submittedAt') {
        const aTime = new Date(aValue as string).getTime();
        const bTime = new Date(bValue as string).getTime();
        return sortDirection === 'asc' ? aTime - bTime : bTime - aTime;
      }
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const result = aValue.toLowerCase() > bValue.toLowerCase() ? 1 : -1;
        return sortDirection === 'asc' ? result : -result;
      }
      return 0;
    });
    return filtered;
  }, [submissions, searchQuery, statusFilter, formTypeFilter, sortField, sortDirection]);

  const getStatusVariant = (status: string) =>
    status === 'COMPLETED' ? 'status-completed' : status === 'DRAFT' ? 'warning' : 'neutral';
  const getValidationVariant = (status: string) =>
    status === 'VALID' ? 'positive' : status === 'INVALID' ? 'danger' : status === 'WARNING' ? 'warning' : 'neutral';
  const getFormTypeLabel = (formType: string) =>
    formType.split(/[-_]/).map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

  if (isLoading) {
    return (
      <Card>
        <CardContent style={{ padding: '1.5rem' }}>
          <Stack direction="horizontal" gap={2} align="center" justify="center">
            <Box style={{ width: '2rem', height: '2rem', borderRadius: '999px', border: '2px solid var(--ui-accent)', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />
            <Text>Loading form submissions...</Text>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  return (
    <Stack gap={4}>
      {(showSearch || showFilters || showSorting) ? (
        <Card>
          <CardContent style={{ padding: '1rem' }}>
            <Stack gap={4}>
              <Box style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                {showSearch ? (
                  <Box style={{ position: 'relative', minWidth: 0 }}>
                    <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--ui-text-muted)' }} />
                    <Input
                      placeholder="Search submissions..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{ paddingLeft: '2.5rem' }}
                    />
                  </Box>
                ) : null}

                {showFilters ? (
                  <>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        {statuses.map((status) => <SelectItem key={status} value={status}>{status.replace('_', ' ')}</SelectItem>)}
                      </SelectContent>
                    </Select>

                    <Select value={formTypeFilter} onValueChange={setFormTypeFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Form Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        {formTypes.map((type) => <SelectItem key={type} value={type}>{getFormTypeLabel(type)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </>
                ) : null}

                {showSorting ? (
                  <Select value={`${sortField}-${sortDirection}`} onValueChange={(value) => {
                    const [field, direction] = value.split('-') as [SortField, SortDirection];
                    setSortField(field);
                    setSortDirection(direction);
                  }}>
                    <SelectTrigger>
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
                ) : null}
              </Box>

              <Text variant="body-sm" tone="muted">
                Showing {filteredAndSortedSubmissions.length} of {submissions.length} submissions
              </Text>
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      <Stack gap={4}>
        {filteredAndSortedSubmissions.length > 0 ? filteredAndSortedSubmissions.map((submission) => (
          <Card key={submission.id}>
            <CardContent style={{ padding: '1rem' }}>
              <Box style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <Stack gap={2} style={{ flex: 1, minWidth: '260px' }}>
                  <Stack direction="horizontal" gap={3} align="center" wrap="wrap">
                    <FileText size={20} style={{ color: 'var(--ui-accent)' }} />
                    <Text as="h3" variant="title">{getFormTypeLabel(submission.formType)} Form</Text>
                    <Badge variant={getStatusVariant(submission.status)}>{submission.status.replace('_', ' ')}</Badge>
                    <Badge variant={getValidationVariant(submission.validationStatus)}>{submission.validationStatus}</Badge>
                  </Stack>

                  <Box style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
                    <Stack direction="horizontal" gap={2} align="center">
                      <User size={16} />
                      <Text variant="body-sm" tone="muted">{submission.submittedByName}</Text>
                    </Stack>
                    <Stack direction="horizontal" gap={2} align="center">
                      <Clock size={16} />
                      <Text variant="body-sm" tone="muted">{formatDistanceToNow(new Date(submission.submittedAt), { addSuffix: true })}</Text>
                    </Stack>
                    <Stack direction="horizontal" gap={2} align="center">
                      <MapPin size={16} />
                      <Text variant="body-sm" tone="muted">{submission.geoLocation.address || 'Location captured'}</Text>
                    </Stack>
                    {submission.photos && submission.photos.length > 0 ? (
                      <Stack direction="horizontal" gap={2} align="center">
                        <Camera size={16} />
                        <Text variant="body-sm" tone="muted">{submission.photos.length} photos</Text>
                      </Stack>
                    ) : null}
                  </Box>

                  <Text variant="body-sm"><strong>Outcome:</strong> {submission.outcome}</Text>
                </Stack>

                {onSubmissionSelect ? (
                  <Stack direction="horizontal" gap={2} align="center">
                    <Button variant="outline" onClick={() => onSubmissionSelect(submission)} icon={<Eye size={16} />}>
                      View
                    </Button>
                  </Stack>
                ) : null}
              </Box>
            </CardContent>
          </Card>
        )) : (
          <Card>
            <CardContent style={{ padding: '1.5rem' }}>
              <Stack gap={2} align="center" style={{ textAlign: 'center' }}>
                <FileText size={48} style={{ color: 'var(--ui-text-muted)' }} />
                <Text as="h3" variant="title">No Submissions Found</Text>
                <Text tone="muted">
                  {submissions.length === 0
                    ? 'No form submissions have been made for this case yet.'
                    : 'No submissions match your current filters. Try adjusting your search criteria.'}
                </Text>
              </Stack>
            </CardContent>
          </Card>
        )}
      </Stack>
    </Stack>
  );
};
