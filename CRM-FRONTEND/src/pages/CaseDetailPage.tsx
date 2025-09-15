import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCase, useAssignCase } from '@/hooks/useCases';
import { useCaseFormSubmissions } from '@/hooks/useForms';
import { ReassignCaseModal } from '@/components/cases/ReassignCaseModal';
import { EnhancedCaseStatus } from '@/components/cases/EnhancedCaseStatus';
import { FormViewer } from '@/components/forms/FormViewer';
import { OptimizedFormSubmissionViewer } from '@/components/forms/OptimizedFormSubmissionViewer';
import { ArrowLeft, MapPin, Phone, Mail, Calendar, User, Building2, FileText, Edit, UserCheck, FormInput, Camera, Clock } from 'lucide-react';
import { CaseAttachmentsSection } from '@/components/attachments/CaseAttachmentsSection';
import { formatDistanceToNow } from 'date-fns';

// Helper function to safely format dates
const safeFormatDistanceToNow = (dateValue: string | null | undefined): string => {
  if (!dateValue) return 'Unknown';
  try {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return 'Invalid date';
    return formatDistanceToNow(date, { addSuffix: true });
  } catch (error) {
    return 'Invalid date';
  }
};

export const CaseDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isReassignModalOpen, setIsReassignModalOpen] = useState(false);



  const { data: caseData, isLoading, refetch } = useCase(id!);
  const { data: formSubmissionsData, isLoading: formSubmissionsLoading } = useCaseFormSubmissions(id!);
  const assignCaseMutation = useAssignCase();
  // const { data: historyData } = useCaseHistory(id!);

  const caseItem = caseData?.data;
  const formSubmissions = formSubmissionsData?.data?.submissions || [];
  // const history = historyData?.data || [];

  // Handler functions
  const handleEditCase = () => {
    navigate(`/cases/new?edit=${id}`);
  };

  const handleReassignCase = async (assignedToId: string, reason: string) => {
    try {
      await assignCaseMutation.mutateAsync({
        id: id!,
        assignedToId,
        reason
      });
      setIsReassignModalOpen(false);
      refetch(); // Refresh case data to show updated assignment
    } catch (error) {
      console.error('Failed to reassign case:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <div className="h-8 w-8 bg-muted rounded animate-pulse"></div>
          <div className="h-8 bg-muted rounded w-48 animate-pulse"></div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="h-64 bg-muted rounded animate-pulse"></div>
            <div className="h-48 bg-muted rounded animate-pulse"></div>
          </div>
          <div className="space-y-6">
            <div className="h-32 bg-muted rounded animate-pulse"></div>
            <div className="h-48 bg-muted rounded animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!caseItem) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-foreground">Case not found</h2>
        <p className="mt-2 text-muted-foreground">The case you're looking for doesn't exist.</p>
        <Link to="/cases">
          <Button className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Cases
          </Button>
        </Link>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ASSIGNED':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300';
      case 'IN_PROGRESS':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300';
      case 'COMPLETED':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getPriorityColor = (priority: number | string) => {
    const priorityNum = typeof priority === 'string' ?
      (priority === 'LOW' ? 1 : priority === 'MEDIUM' ? 2 : priority === 'HIGH' ? 3 : priority === 'URGENT' ? 4 : parseInt(priority))
      : priority;

    switch (priorityNum) {
      case 1:
        return 'bg-muted text-muted-foreground';
      case 2:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300';
      case 3:
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300';
      case 4:
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getPriorityLabel = (priority: number | string) => {
    const priorityNum = typeof priority === 'string' ?
      (priority === 'LOW' ? 1 : priority === 'MEDIUM' ? 2 : priority === 'HIGH' ? 3 : priority === 'URGENT' ? 4 : parseInt(priority))
      : priority;

    switch (priorityNum) {
      case 1:
        return 'Low';
      case 2:
        return 'Medium';
      case 3:
        return 'High';
      case 4:
        return 'Urgent';
      default:
        return typeof priority === 'string' ? priority : 'Unknown';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link to="/cases">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Case #{caseItem.caseId || caseItem.id?.slice(-8) || 'N/A'}
            </h1>
            <p className="mt-2 text-muted-foreground">{caseItem.title || 'Case Details'}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Badge className={getStatusColor(caseItem.status)}>
            {caseItem.status.replace('_', ' ')}
          </Badge>
          <Badge className={getPriorityColor(caseItem.priority)}>
            {getPriorityLabel(caseItem.priority)}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="details" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="details" className="flex items-center space-x-2">
                <FileText className="h-4 w-4" />
                <span>Case Details</span>
              </TabsTrigger>
              <TabsTrigger value="status" className="flex items-center space-x-2">
                <Clock className="h-4 w-4" />
                <span>Status & Progress</span>
              </TabsTrigger>
              <TabsTrigger value="forms" className="flex items-center space-x-2">
                <FormInput className="h-4 w-4" />
                <span>Form Submissions</span>
                {formSubmissions.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {formSubmissions.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="attachments" className="flex items-center space-x-2">
                <Camera className="h-4 w-4" />
                <span>Attachments</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="details">
              <Card>
                <CardHeader>
                  <CardTitle>Case Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-medium text-blue-900">Applicant Information</h4>
                      <div className="mt-2 space-y-2">
                        <div className="flex items-center space-x-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{caseItem.applicantName}</span>
                        </div>
                        {caseItem.applicantPhone && (
                          <div className="flex items-center space-x-2">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{caseItem.applicantPhone}</span>
                          </div>
                        )}
                        {caseItem.applicantEmail && (
                          <div className="flex items-center space-x-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{caseItem.applicantEmail}</span>
                          </div>
                        )}
                        {caseItem.applicantType && (
                          <div className="flex items-center space-x-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">Type: {caseItem.applicantType}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium text-blue-900">Address</h4>
                      <div className="mt-2">
                        <div className="flex items-start space-x-2">
                          <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <div className="text-sm">
                            <div>{caseItem.address}</div>
                            <div>Pincode: {caseItem.pincode}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center space-x-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Created By Backend User</span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {caseItem.createdByBackendUser?.name || 'System'}
                    </p>
                  </div>

                  <div>
                    <h4 className="font-medium text-blue-900">Case Details</h4>
                    <div className="mt-2 space-y-2">
                      <div className="flex items-center space-x-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">Case ID: {caseItem.caseId}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">Client: {caseItem.clientName}</span>
                      </div>
                      {caseItem.backendContactNumber && (
                        <div className="flex items-center space-x-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">Backend Contact: {caseItem.backendContactNumber}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {(caseItem.trigger || caseItem.notes) && (
                    <div>
                      <h4 className="font-medium text-blue-900">TRIGGER</h4>
                      <p className="mt-1 text-muted-foreground">{caseItem.trigger || caseItem.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="status">
              <EnhancedCaseStatus
                caseId={caseItem.caseId?.toString() || id!}
                currentStatus={caseItem.status}
                submissionProgress={undefined} // TODO: Connect to real submission progress
                retryQueueStatus={undefined} // TODO: Connect to real retry queue status
                onRetrySubmission={() => {
                  console.log('Retry submission for case:', id);
                  // TODO: Implement retry logic
                }}
                onClearRetryQueue={() => {
                  console.log('Clear retry queue for case:', id);
                  // TODO: Implement clear retry queue logic
                }}
              />
            </TabsContent>

            <TabsContent value="forms">
              <div className="space-y-6">
                {formSubmissionsLoading ? (
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <span className="ml-2">Loading form submissions...</span>
                      </div>
                    </CardContent>
                  </Card>
                ) : formSubmissions.length > 0 ? (
                  formSubmissions.map((submission, index) => (
                    <OptimizedFormSubmissionViewer
                      key={submission.id}
                      submission={submission}
                      caseId={id!}
                    />
                  ))
                ) : (
                  <Card>
                    <CardContent className="p-6 text-center">
                      <FormInput className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-foreground mb-2">No Form Submissions</h3>
                      <p className="text-muted-foreground">
                        No verification forms have been submitted for this case yet.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="attachments">
              <Card>
                <CardHeader>
                  <CardTitle>Case Attachments</CardTitle>
                </CardHeader>
                <CardContent>
                  <CaseAttachmentsSection caseId={id!} />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Assignment Info */}
          <Card>
            <CardHeader>
              <CardTitle>Assignment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center space-x-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Assigned To</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {caseItem.assignedTo?.name || 'Not assigned'}
                </p>
              </div>



              <div>
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Last Updated</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {safeFormatDistanceToNow(caseItem.updatedAt)}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                className="w-full"
                variant="outline"
                onClick={handleEditCase}
              >
                <Edit className="mr-2 h-4 w-4" />
                Edit Case
              </Button>
              <Button
                className="w-full"
                variant="outline"
                onClick={() => setIsReassignModalOpen(true)}
              >
                <UserCheck className="mr-2 h-4 w-4" />
                Reassign
              </Button>
              {caseItem.status !== 'COMPLETED' && (
                <Button className="w-full">
                  Mark Complete
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Reassign Case Modal */}
      {caseItem && (
        <ReassignCaseModal
          isOpen={isReassignModalOpen}
          onClose={() => setIsReassignModalOpen(false)}
          onReassign={handleReassignCase}
          case={caseItem}
          isLoading={assignCaseMutation.isPending}
        />
      )}
    </div>
  );
};
