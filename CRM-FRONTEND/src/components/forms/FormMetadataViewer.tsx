import React from 'react';
import { User, Clock, FileText, CheckCircle, AlertCircle, Eye } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { FormSubmission } from '@/types/form';

interface FormMetadataViewerProps {
  submission: FormSubmission;
}

export function FormMetadataViewer({ submission }: FormMetadataViewerProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'REJECTED':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'UNDER_REVIEW':
        return <Eye className="h-4 w-4 text-blue-600" />;
      default:
        return <FileText className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      DRAFT: { variant: 'secondary' as const, label: 'Draft' },
      SUBMITTED: { variant: 'default' as const, label: 'Submitted' },
      UNDER_REVIEW: { variant: 'outline' as const, label: 'Under Review' },
      APPROVED: { variant: 'default' as const, label: 'Approved' },
      REJECTED: { variant: 'destructive' as const, label: 'Rejected' },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.DRAFT;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getFormTypeLabel = (formType: string) => {
    return formType
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getVerificationTypeLabel = (verificationType: string) => {
    return verificationType.replace(/([A-Z])/g, ' $1').trim();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <FileText className="h-5 w-5" />
          <span>Form Information</span>
        </CardTitle>
        <CardDescription>
          Submission details and verification metadata
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Basic Information */}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="font-medium text-sm mb-3">Form Details</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Form ID:</span>
                  <span className="font-mono">{submission.id}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Case ID:</span>
                  <span className="font-mono">{submission.caseId}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Form Type:</span>
                  <span>{getFormTypeLabel(submission.formType)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Verification:</span>
                  <span>{getVerificationTypeLabel(submission.verificationType)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Outcome:</span>
                  <Badge variant="outline">{submission.outcome}</Badge>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-medium text-sm mb-3">Status & Progress</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(submission.status)}
                    {getStatusBadge(submission.status)}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Sections:</span>
                  <span>{submission.sections.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Attachments:</span>
                  <span>{submission.attachments.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Location:</span>
                  <span>{submission.location ? 'Captured' : 'Not available'}</span>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Submission Information */}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="font-medium text-sm mb-3">Submission Details</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center space-x-2">
                  <User className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">Submitted by:</span>
                  <span className="font-medium">{submission.submittedByName || submission.submittedBy || 'Unknown Agent'}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">Submitted at:</span>
                  <span>{new Date(submission.submittedAt).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Review Information */}
            {(submission.reviewedBy || submission.reviewedAt) && (
              <div>
                <h4 className="font-medium text-sm mb-3">Review Details</h4>
                <div className="space-y-2 text-sm">
                  {submission.reviewedBy && (
                    <div className="flex items-center space-x-2">
                      <User className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground">Reviewed by:</span>
                      <span className="font-medium">{submission.reviewedBy}</span>
                    </div>
                  )}
                  {submission.reviewedAt && (
                    <div className="flex items-center space-x-2">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground">Reviewed at:</span>
                      <span>{new Date(submission.reviewedAt).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Form Statistics */}
          <div className="bg-muted/30 rounded-lg p-4">
            <h4 className="font-medium text-sm mb-3">Form Statistics</h4>
            <div className="grid gap-4 md:grid-cols-4 text-sm">
              <div className="text-center">
                <div className="text-lg font-bold text-primary">
                  {submission.sections.reduce((acc, section) => acc + section.fields.length, 0)}
                </div>
                <div className="text-xs text-muted-foreground">Total Fields</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-green-600">
                  {submission.sections.reduce((acc, section) => 
                    acc + section.fields.filter(field => field.value && field.value !== '').length, 0
                  )}
                </div>
                <div className="text-xs text-muted-foreground">Completed Fields</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-blue-600">
                  {submission.attachments.length}
                </div>
                <div className="text-xs text-muted-foreground">Attachments</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-purple-600">
                  {submission.location ? '1' : '0'}
                </div>
                <div className="text-xs text-muted-foreground">GPS Location</div>
              </div>
            </div>
          </div>

          {/* Completion Progress */}
          <div>
            <h4 className="font-medium text-sm mb-3">Completion Progress</h4>
            <div className="space-y-2">
              {submission.sections.map((section) => {
                const totalFields = section.fields.length;
                const completedFields = section.fields.filter(field => 
                  field.value && field.value !== ''
                ).length;
                const percentage = totalFields > 0 ? (completedFields / totalFields) * 100 : 0;

                return (
                  <div key={section.id} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>{section.title}</span>
                      <span className="text-muted-foreground">
                        {completedFields}/{totalFields} ({Math.round(percentage)}%)
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full transition-all duration-300" 
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
