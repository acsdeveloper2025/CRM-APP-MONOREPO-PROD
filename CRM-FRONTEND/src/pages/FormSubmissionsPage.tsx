import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useCaseFormSubmissions } from '@/hooks/useForms';
import { FormViewer } from '@/components/forms/FormViewer';
import { FormSubmission } from '@/types/form';
import {
  Camera,
  Clock,
  User,
  AlertCircle,
  Eye,
  FileText
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export const FormSubmissionsPage: React.FC = () => {
  const { caseId } = useParams<{ caseId: string }>();
  const [selectedSubmission, setSelectedSubmission] = useState<FormSubmission | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  const { data: formSubmissionsData, isLoading, error } = useCaseFormSubmissions(caseId!);
  const submissions = formSubmissionsData?.data?.submissions || [];

  const handleSubmissionSelect = (submission: FormSubmission) => {
    setSelectedSubmission(submission);
    setIsViewerOpen(true);
  };

  const handleCloseViewer = () => {
    setSelectedSubmission(null);
    setIsViewerOpen(false);
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
      case 'approved':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
      case 'pending':
      case 'under_review':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300';
      case 'failed':
      case 'rejected':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getValidationColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'valid':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
      case 'invalid':
      case 'flagged':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300';
      case 'warning':
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <div className="h-8 w-8 bg-muted rounded animate-pulse"></div>
          <div className="h-8 bg-muted rounded w-48 animate-pulse"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-64 bg-muted rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-foreground mb-2">Error Loading Form Submissions</h2>
        <p className="text-muted-foreground">There was an error loading the form submissions for this case.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Form Submissions</h1>
          <p className="mt-2 text-muted-foreground">Case #{caseId}</p>
        </div>
        <Badge variant="outline" className="text-lg px-3 py-1">
          {submissions.length} Submissions
        </Badge>
      </div>

      {/* Form Submissions by Agent Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {submissions.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No Form Submissions</h3>
            <p className="text-muted-foreground">No form submissions found for this case.</p>
          </div>
        ) : (
          submissions.map((submission) => (
            <Card
              key={submission.id}
              className="hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-l-blue-500"
              onClick={() => handleSubmissionSelect(submission)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <User className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{submission.submittedByName}</CardTitle>
                      <p className="text-sm text-muted-foreground">Field Agent</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end space-y-1">
                    <Badge className={getStatusColor(submission.status)}>
                      {submission.status.replace('_', ' ')}
                    </Badge>
                    <Badge className={getValidationColor(submission.validationStatus)}>
                      {submission.validationStatus}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>
                      {formatDistanceToNow(new Date(submission.submittedAt), { addSuffix: true })}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                    <FileText className="h-4 w-4" />
                    <span>{submission.formType} Form</span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                    <Camera className="h-4 w-4" />
                    <span>{submission.photos?.length || 0} photos captured</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Image Cards Section */}
      {submissions.some(s => s.photos && s.photos.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Camera className="h-5 w-5" />
              <span>Captured Images</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              {submissions.flatMap(submission =>
                (submission.photos || []).map(photo => (
                  <div
                    key={`${submission.id}-${photo.id}`}
                    className="group relative cursor-pointer"
                    onClick={() => handleSubmissionSelect(submission)}
                  >
                    <div className="aspect-square bg-muted rounded-lg overflow-hidden">
                      <img
                        src={photo.thumbnailUrl || photo.url}
                        alt={`Photo by ${submission.submittedByName}`}
                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      />
                    </div>
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-opacity rounded-lg flex items-center justify-center">
                      <Eye className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="absolute top-2 left-2">
                      <Badge className="text-xs bg-black bg-opacity-70 text-white">
                        {photo.type}
                      </Badge>
                    </div>
                    <div className="absolute bottom-2 left-2 right-2">
                      <div className="bg-black bg-opacity-70 text-white text-xs p-1 rounded truncate">
                        {submission.submittedByName}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Form Viewer Modal */}
      {selectedSubmission && (
        <Dialog open={isViewerOpen} onOpenChange={handleCloseViewer}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-auto">
            <DialogHeader>
              <DialogTitle>Form Submission Details</DialogTitle>
            </DialogHeader>
            <FormViewer
              submission={selectedSubmission}
              readonly={true}
              showAttachments={true}
              showPhotos={true}
              showLocation={true}
              showMetadata={true}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
