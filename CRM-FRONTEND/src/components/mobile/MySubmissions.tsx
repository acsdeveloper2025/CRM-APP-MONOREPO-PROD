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
  Filter, 
  Calendar,
  MapPin,
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle,
  Eye,
  Download,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface FormSubmission {
  id: string;
  caseId: string;
  customerName: string;
  formType: 'RESIDENCE' | 'OFFICE' | 'BUSINESS';
  status: 'PENDING' | 'VALID' | 'INVALID' | 'REQUIRES_REVIEW';
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
  const { user } = useAuth();
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

  useEffect(() => {
    filterSubmissions();
  }, [submissions, searchTerm, statusFilter, formTypeFilter, dateFilter]);

  const fetchMySubmissions = async () => {
    try {
      setIsLoading(true);
      
      // Mock data - replace with actual API call
      const mockSubmissions: FormSubmission[] = [
        {
          id: '1',
          caseId: 'CASE-001',
          customerName: 'John Doe',
          formType: 'RESIDENCE',
          status: 'VALID',
          submittedAt: '2024-01-15T10:30:00Z',
          validatedAt: '2024-01-15T11:15:00Z',
          location: {
            address: '123 Main St, Bangalore',
            coordinates: { lat: 12.9716, lng: 77.5946 }
          },
          photos: 5,
          attachments: 2,
          qualityScore: 92,
          timeSpent: 25,
          networkQuality: 'EXCELLENT'
        },
        {
          id: '2',
          caseId: 'CASE-002',
          customerName: 'Jane Smith',
          formType: 'OFFICE',
          status: 'PENDING',
          submittedAt: '2024-01-15T14:20:00Z',
          location: {
            address: '456 Business Park, Bangalore',
            coordinates: { lat: 12.9716, lng: 77.5946 }
          },
          photos: 8,
          attachments: 3,
          timeSpent: 35,
          networkQuality: 'GOOD'
        },
        {
          id: '3',
          caseId: 'CASE-003',
          customerName: 'Mike Johnson',
          formType: 'BUSINESS',
          status: 'REQUIRES_REVIEW',
          submittedAt: '2024-01-14T16:45:00Z',
          validatedAt: '2024-01-14T17:30:00Z',
          location: {
            address: '789 Industrial Area, Bangalore',
            coordinates: { lat: 12.9716, lng: 77.5946 }
          },
          photos: 12,
          attachments: 5,
          qualityScore: 78,
          timeSpent: 45,
          networkQuality: 'POOR'
        },
        {
          id: '4',
          caseId: 'CASE-004',
          customerName: 'Sarah Wilson',
          formType: 'RESIDENCE',
          status: 'INVALID',
          submittedAt: '2024-01-14T09:15:00Z',
          validatedAt: '2024-01-14T10:00:00Z',
          location: {
            address: '321 Residential Complex, Bangalore',
            coordinates: { lat: 12.9716, lng: 77.5946 }
          },
          photos: 3,
          attachments: 1,
          qualityScore: 65,
          timeSpent: 20,
          networkQuality: 'EXCELLENT'
        }
      ];

      setSubmissions(mockSubmissions);
    } catch (error) {
      console.error('Error fetching submissions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filterSubmissions = () => {
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
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'VALID':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'PENDING':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'INVALID':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'REQUIRES_REVIEW':
        return <AlertCircle className="h-4 w-4 text-orange-600" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'VALID':
        return 'bg-green-100 text-green-800';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'INVALID':
        return 'bg-red-100 text-red-800';
      case 'REQUIRES_REVIEW':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-muted text-foreground';
    }
  };

  const getFormTypeColor = (formType: string) => {
    switch (formType) {
      case 'RESIDENCE':
        return 'bg-blue-100 text-blue-800';
      case 'OFFICE':
        return 'bg-purple-100 text-purple-800';
      case 'BUSINESS':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-muted text-foreground';
    }
  };

  const getNetworkQualityColor = (quality: string) => {
    switch (quality) {
      case 'EXCELLENT':
        return 'text-green-600';
      case 'GOOD':
        return 'text-blue-600';
      case 'POOR':
        return 'text-yellow-600';
      case 'OFFLINE':
        return 'text-red-600';
      default:
        return 'text-muted-foreground';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
          <span className="ml-2 text-muted-foreground">Loading submissions...</span>
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
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
                <SelectItem value="VALID">Valid</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="INVALID">Invalid</SelectItem>
                <SelectItem value="REQUIRES_REVIEW">Review</SelectItem>
              </SelectContent>
            </Select>

            <Select value={formTypeFilter} onValueChange={setFormTypeFilter}>
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="RESIDENCE">Residence</SelectItem>
                <SelectItem value="OFFICE">Office</SelectItem>
                <SelectItem value="BUSINESS">Business</SelectItem>
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
                  <p className="text-xs text-muted-foreground">Case: {submission.caseId}</p>
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
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{submission.location.address}</span>
                </div>
              )}

              {/* Metrics */}
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div className="flex items-center space-x-2">
                  <FileText className="h-4 w-4 text-blue-600" />
                  <span className="text-xs text-muted-foreground">
                    {submission.photos} photos, {submission.attachments} files
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-purple-600" />
                  <span className="text-xs text-muted-foreground">{submission.timeSpent}min</span>
                </div>
              </div>

              {/* Quality Score */}
              {submission.qualityScore && (
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-muted-foreground">Quality Score:</span>
                  <Badge 
                    className={
                      submission.qualityScore >= 90 ? 'bg-green-100 text-green-800' :
                      submission.qualityScore >= 80 ? 'bg-blue-100 text-blue-800' :
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
                  <span className="text-xs text-muted-foreground">
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
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No submissions found</h3>
            <p className="text-muted-foreground">
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
