import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { FormSubmission } from '@/types/form';
import VerificationImages from '@/components/VerificationImages';
import { TemplateReportCard } from '@/components/forms/TemplateReportCard';

import {
  FileText,
  User,
  Clock,
  Camera,

  CheckCircle,
  AlertCircle,
  Smartphone,

  Calendar,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

interface OptimizedFormSubmissionViewerProps {
  submission: FormSubmission;
  caseId: string;
}

export const OptimizedFormSubmissionViewer: React.FC<OptimizedFormSubmissionViewerProps> = ({
  submission,
  caseId
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Helper functions
  const getFormTypeLabel = (formType: string) => {
    return formType.replace('_', ' ').toUpperCase();
  };



  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SUBMITTED':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
      case 'DRAFT':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300';
      case 'PENDING':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300';
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
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getOutcomeColor = (outcome: string) => {
    switch (outcome?.toLowerCase()) {
      case 'positive':
        return 'text-green-600 dark:text-green-400';
      case 'negative':
        return 'text-red-600 dark:text-red-400';
      case 'untraceable':
        return 'text-orange-600 dark:text-orange-400';
      default:
        return 'text-muted-foreground';
    }
  };

  // Extract key information
  const submissionDate = (() => {
    // Try submittedAt first, then metadata.submissionTimestamp
    const dateStr = submission.submittedAt || submission.metadata?.submissionTimestamp;
    if (!dateStr) return null;

    // Clean up the malformed date string (remove duplicate timezone info)
    const cleanDateStr = dateStr.replace(/T00:00:00\.000Z$/, '').replace(/GMT\+0530 \(India Standard Time\)/, '');
    const date = new Date(cleanDateStr);
    return isNaN(date.getTime()) ? null : date;
  })();
  const agentName = submission.submittedByName || submission.submittedBy || 'Unknown Agent';
  const formSections = submission.sections || [];
  const totalFields = formSections.reduce((total, section) => total + (section.fields?.length || 0), 0);
  const verificationOutcome = submission.sections?.[0]?.fields?.find(
    field => field.id === 'verification_outcome' || field.label?.toLowerCase().includes('outcome')
  )?.value || 'Not specified';

  return (
    <div className="space-y-6">
      {/* Header Card with Summary */}
      <Card className="border-l-4 border-l-blue-500">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-xl">
                  {getFormTypeLabel(submission.formType)} Verification
                </CardTitle>
                <div className="flex items-center space-x-2 mt-2">
                  <Badge className={getStatusColor(submission.status)}>
                    {submission.status}
                  </Badge>
                  <Badge className={getValidationColor(submission.validationStatus)}>
                    {submission.validationStatus}
                  </Badge>
                  <span className={`text-sm font-medium ${getOutcomeColor(verificationOutcome)}`}>
                    Outcome: {verificationOutcome}
                  </span>
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center space-x-2"
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              <span>{isExpanded ? 'Collapse' : 'Expand'} Details</span>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {/* Key Information Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="flex items-center space-x-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Agent</p>
                <p className="text-sm font-medium">{agentName}</p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Submitted</p>
                <p className="text-sm font-medium">
                  {submissionDate ? formatDistanceToNow(submissionDate, { addSuffix: true }) : 'Unknown time'}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Camera className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Photos</p>
                <p className="text-sm font-medium">{submission.photos?.length || 0} captured</p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Form Data</p>
                <p className="text-sm font-medium">{formSections.length} sections, {totalFields} fields</p>
              </div>
            </div>
          </div>

          {/* Submission Details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Full Date & Time</p>
                <p className="text-sm font-medium">
                  {submissionDate ? format(submissionDate, 'MMM dd, yyyy HH:mm') : 'Unknown date'}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Smartphone className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Platform</p>
                <p className="text-sm font-medium">{submission.metadata?.deviceInfo?.platform || 'Unknown'}</p>
              </div>
            </div>


          </div>
        </CardContent>
      </Card>

      {/* Expanded Content - All Data in Single Page */}
      {isExpanded && (
        <div className="space-y-6">
          {/* Form Data Sections */}
          {formSections.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center space-x-2 mb-4">
                <FileText className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-semibold">Form Data</h3>
                <Badge variant="outline">{formSections.length} sections, {totalFields} fields</Badge>
              </div>

              {formSections.map((section, sectionIndex) => (
                <Card key={sectionIndex} className="border-l-4 border-l-green-500">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center space-x-2">
                      <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center text-sm font-medium text-green-600">
                        {sectionIndex + 1}
                      </div>
                      <span>{section.title}</span>
                      <Badge variant="outline">{section.fields?.length || 0} fields</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {section.fields?.map((field, fieldIndex) => (
                        <div key={fieldIndex} className="space-y-3">
                          {/* Field Label with Enhanced Styling */}
                          <div className="flex items-center justify-between">
                            <Label className="text-sm font-semibold text-foreground flex items-center space-x-2">
                              <span className="bg-muted text-muted-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                                {fieldIndex + 1}
                              </span>
                              <span>{field.label}</span>
                              {field.isRequired && <span className="text-red-500 text-lg">*</span>}
                            </Label>
                            <Badge variant="secondary" className="text-xs">
                              {field.type}
                            </Badge>
                          </div>

                          {/* Field Value Display with Enhanced Styling */}
                          <div className="min-h-[50px] p-4 bg-muted border-2 border-border rounded-lg">
                            <div className="text-sm text-foreground">
                              {field.value || <span className="text-muted-foreground italic">Not provided</span>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-6 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No Form Data</h3>
                <p className="text-muted-foreground">No form fields were captured in this submission.</p>
              </CardContent>
            </Card>
          )}

          {/* Verification Images */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Camera className="h-5 w-5 text-purple-600" />
              <h3 className="text-lg font-semibold">Verification Photos</h3>
              <Badge variant="outline">{submission.photos?.length || 0} photos</Badge>
            </div>

            <Card className="border-l-4 border-l-purple-500">
              <CardContent className="p-4">
                <VerificationImages
                  caseId={caseId}
                  submissionId={submission.id}
                  title=""
                  showStats={false}
                  submissionAddress={submission.geoLocation?.address}
                />
              </CardContent>
            </Card>
          </div>

          {/* Template-Based Report */}
          <TemplateReportCard
            caseId={caseId}
            submissionId={submission.id}
            verificationType={submission.verificationType || 'RESIDENCE'}
            outcome={submission.verificationOutcome || 'Positive & Door Locked'}
          />

        </div>
      )}
    </div>
  );
};
