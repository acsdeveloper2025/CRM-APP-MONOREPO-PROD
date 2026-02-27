import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  FileText,
  Search,
  MapPin,
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle,
  Eye,
  Download,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { MobileReportsService } from '@/services/mobileReports';

interface FormSubmission {
  id: string;
  caseId: string;
  customerName: string;
  formType: string;
  status: string;
  submittedAt: string;
  validatedAt?: string;
  location?: {
    address: string;
    coordinates: { lat: number; lng: number };
  };
  photos: number;
  attachments: number;
  qualityScore?: number;
  timeSpent: number; // minutes
  networkQuality: 'EXCELLENT' | 'GOOD' | 'POOR' | 'OFFLINE';
}

export const MySubmissions: React.FC = () => {
  const { user: _user } = useAuth();
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [filteredSubmissions, setFilteredSubmissions] = useState<FormSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [formTypeFilter, setFormTypeFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');

  useEffect(() => {
    fetchMySubmissions();
  }, []);



  const fetchMySubmissions = async () => {
    try {
      setIsLoading(true);
      const tasks = await MobileReportsService.fetchMobileTasks();
      const liveSubmissions: FormSubmission[] = tasks.map(task => {
        const submittedAt = task.completedAt || task.updatedAt || task.assignedAt || new Date().toISOString();
        const submittedDate = new Date(submittedAt);
        const startedDate = task.inProgressAt ? new Date(task.inProgressAt) : null;
        const spentMinutes =
          startedDate && !Number.isNaN(submittedDate.getTime())
            ? Math.max(0, Math.round((submittedDate.getTime() - startedDate.getTime()) / (1000 * 60)))
            : 0;

        return {
          id: task.verificationTaskId || task.id,
          caseId: String(task.caseId || '-'),
          customerName: task.customerName || 'Unknown',
          formType: task.verificationTypeDetails?.name || task.verificationType || 'UNKNOWN',
          status: String(task.status || 'PENDING').toUpperCase(),
          submittedAt,
          location: task.addressStreet
            ? {
                address: task.addressStreet,
                coordinates: { lat: 0, lng: 0 },
              }
            : undefined,
          photos: Number(task.attachmentCount || 0),
          attachments: Number(task.attachmentCount || 0),
          qualityScore: undefined,
          timeSpent: spentMinutes,
          networkQuality: 'EXCELLENT',
        };
      });

      setSubmissions(liveSubmissions);
    } catch (error) {
      console.error('Error fetching submissions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filterSubmissions = React.useCallback(() => {
    let filtered = submissions;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(submission =>
        submission.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        submission.caseId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        submission.location?.address.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(submission => submission.status === statusFilter);
    }

    // Form type filter
    if (formTypeFilter !== 'all') {
      filtered = filtered.filter(submission => submission.formType === formTypeFilter);
    }

    // Date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      const filterDate = new Date();
      
      switch (dateFilter) {
        case 'today':
          filterDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          filterDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          filterDate.setMonth(now.getMonth() - 1);
          break;
      }

      if (dateFilter !== 'all') {
        filtered = filtered.filter(submission => 
          new Date(submission.submittedAt) >= filterDate
        );
      }
    }

    setFilteredSubmissions(filtered);
  }, [submissions, searchTerm, statusFilter, formTypeFilter, dateFilter]);

  useEffect(() => {
    filterSubmissions();
  }, [filterSubmissions]);

  const availableFormTypes = React.useMemo(() => {
    return Array.from(new Set(submissions.map(submission => submission.formType))).sort();
  }, [submissions]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'PENDING':
      case 'ASSIGNED':
      case 'IN_PROGRESS':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'REVOKED':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'REQUIRES_REVIEW':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      case 'PENDING':
      case 'ASSIGNED':
      case 'IN_PROGRESS':
        return 'bg-yellow-100 text-yellow-800';
      case 'REVOKED':
        return 'bg-red-100 text-red-800';
      case 'REQUIRES_REVIEW':
        return 'bg-yellow-100 text-orange-800';
      default:
        return 'bg-slate-100 text-slate-900 dark:bg-slate-800/60 dark:text-slate-100';
    }
  };

  const getFormTypeColor = (formType: string) => {
    switch (formType) {
      case 'RESIDENCE':
        return 'bg-green-100 text-green-800';
      case 'OFFICE':
        return 'bg-green-100 text-green-800';
      case 'BUSINESS':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-slate-100 text-slate-900 dark:bg-slate-800/60 dark:text-slate-100';
    }
  };

  const getNetworkQualityColor = (quality: string) => {
    switch (quality) {
      case 'EXCELLENT':
        return 'text-green-600';
      case 'GOOD':
        return 'text-green-600';
      case 'POOR':
        return 'text-yellow-600';
      case 'OFFLINE':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin text-green-600" />
          <span className="ml-2 text-gray-600">Loading submissions...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">My Form Submissions</CardTitle>
          <CardDescription>
            {filteredSubmissions.length} of {submissions.length} submissions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-600" />
            <Input
              placeholder="Search by customer, case ID, or address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filters */}
          <div className="grid grid-cols-3 gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="ASSIGNED">Assigned</SelectItem>
                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="REVOKED">Revoked</SelectItem>
              </SelectContent>
            </Select>

            <Select value={formTypeFilter} onValueChange={setFormTypeFilter}>
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {availableFormTypes.map(type => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="Date" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Submissions List */}
      <div className="space-y-3">
        {filteredSubmissions.map((submission) => (
          <Card key={submission.id} className="border-l-4 border-l-blue-500">
            <CardContent className="p-4">
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <h3 className="font-semibold text-sm">{submission.customerName}</h3>
                    <Badge className={getFormTypeColor(submission.formType)} variant="secondary">
                      {submission.formType}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-600">Case: {submission.caseId}</p>
                </div>
                <div className="flex items-center space-x-1">
                  {getStatusIcon(submission.status)}
                  <Badge className={getStatusBadge(submission.status)} variant="secondary">
                    {submission.status.replace('_', ' ')}
                  </Badge>
                </div>
              </div>

              {/* Location */}
              {submission.location && (
                <div className="flex items-center space-x-2 mb-3">
                  <MapPin className="h-4 w-4 text-gray-600" />
                  <span className="text-xs text-gray-600">{submission.location.address}</span>
                </div>
              )}

              {/* Metrics */}
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div className="flex items-center space-x-2">
                  <FileText className="h-4 w-4 text-green-600" />
                  <span className="text-xs text-gray-600">
                    {submission.photos} photos, {submission.attachments} files
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-green-600" />
                  <span className="text-xs text-gray-600">{submission.timeSpent}min</span>
                </div>
              </div>

              {/* Quality Score */}
              {submission.qualityScore && (
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-gray-600">Quality Score:</span>
                  <Badge 
                    className={
                      submission.qualityScore >= 90 ? 'bg-green-100 text-green-800' :
                      submission.qualityScore >= 80 ? 'bg-green-100 text-green-800' :
                      submission.qualityScore >= 70 ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }
                    variant="secondary"
                  >
                    {submission.qualityScore}%
                  </Badge>
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between pt-3 border-t">
                <div className="flex items-center space-x-4">
                  <span className="text-xs text-gray-600">
                    {new Date(submission.submittedAt).toLocaleDateString()}
                  </span>
                  <span className={`text-xs ${getNetworkQualityColor(submission.networkQuality)}`}>
                    {submission.networkQuality}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <Button variant="ghost" size="sm">
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm">
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredSubmissions.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <FileText className="h-12 w-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No submissions found</h3>
            <p className="text-gray-600">
              {searchTerm || statusFilter !== 'all' || formTypeFilter !== 'all' || dateFilter !== 'all'
                ? 'Try adjusting your search or filters'
                : 'You haven\'t submitted any forms yet'
              }
            </p>
          </CardContent>
        </Card>
      )}

      {/* Refresh Button */}
      <div className="flex justify-center pt-4">
        <Button 
          variant="outline" 
          onClick={fetchMySubmissions}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>
    </div>
  );
};
