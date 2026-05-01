import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FormField, FormSubmission } from '@/types/form';
import VerificationImages from '@/components/verification-tasks/VerificationImages';
import { TemplateReportCard } from '@/components/forms/TemplateReportCard';
import { baseBadgeStyle } from '@/lib/badgeStyles';

import {
  FileText,
  User,
  Clock,
  Camera,
  Smartphone,
  Calendar,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

interface OptimizedFormSubmissionViewerProps {
  submission: FormSubmission;
  caseId: string;
}

const getFieldValue = (field: FormField): React.ReactNode => {
  if (field.displayValue) {
    return field.displayValue;
  }

  const val = field.value;
  if (val === null || val === undefined || val === '') {
    return null;
  }

  if (typeof val === 'string' || typeof val === 'number') {
    return val;
  }
  if (typeof val === 'boolean') {
    return val ? 'Yes' : 'No';
  }
  if (Array.isArray(val)) {
    return val.join(', ');
  }

  if (typeof val === 'object') {
    // Try to be smart about objects - if it has a url, likely a file
    const objVal = val as Record<string, unknown>;
    if ('url' in objVal && typeof objVal.url === 'string') {
      return (
        <a
          href={objVal.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 underline"
        >
          View File
        </a>
      );
    }
    try {
      return JSON.stringify(val);
    } catch {
      return '[Complex Object]';
    }
  }

  return String(val);
};

export const OptimizedFormSubmissionViewer: React.FC<OptimizedFormSubmissionViewerProps> = ({
  submission,
  caseId,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Helper functions
  const getFormTypeLabel = (formType: string) => {
    return formType.replace('_', ' ').toUpperCase();
  };

  // Extract key information
  const submissionDate = (() => {
    // Try submittedAt first, then metadata.submissionTimestamp
    const dateStr = submission.submittedAt || submission.metadata?.submissionTimestamp;
    if (!dateStr) {
      return null;
    }

    // Clean up the malformed date string (remove duplicate timezone info)
    const cleanDateStr = dateStr
      .replace(/T00:00:00\.000Z$/, '')
      .replace(/GMT\+0530 \(India Standard Time\)/, '');
    const date = new Date(cleanDateStr);
    return isNaN(date.getTime()) ? null : date;
  })();
  const agentName = submission.submittedByName || submission.submittedBy || 'Unknown Agent';
  const formSections = submission.sections || [];
  const totalFields = formSections.reduce(
    (total, section) => total + (section.fields?.length || 0),
    0
  );

  // Try to get outcome from multiple sources
  const verificationOutcome = (() => {
    if (submission.outcome) {
      return submission.outcome;
    }
    if (submission.formType) {
      return submission.formType;
    }

    const field = formSections
      .flatMap((s) => s.fields || [])
      .find(
        (f) =>
          f.id === 'finalStatus' ||
          f.id === 'verificationOutcome' ||
          f.label?.toLowerCase().includes('outcome') ||
          f.label?.toLowerCase().includes('final status')
      );

    if (field?.value && typeof field.value === 'string') {
      return field.value;
    }

    return 'Not specified';
  })();

  return (
    <div className="space-y-6">
      {/* Header Card with Summary */}
      <Card className="border-l-4 border-l-blue-500">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <FileText className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <CardTitle className="text-xl">
                  {getFormTypeLabel(submission.formType)} Verification
                </CardTitle>
                <div className="flex items-center space-x-2 mt-2">
                  <Badge className={baseBadgeStyle}>{submission.status.toUpperCase()}</Badge>
                  <Badge className={baseBadgeStyle}>
                    {submission.validationStatus.toUpperCase()}
                  </Badge>
                  <Badge className={baseBadgeStyle}>
                    OUTCOME: {verificationOutcome.toUpperCase()}
                  </Badge>
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
              <User className="h-4 w-4 text-gray-600" />
              <div>
                <p className="text-xs text-gray-600">Agent</p>
                <p className="text-sm font-medium">{agentName}</p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-gray-600" />
              <div>
                <p className="text-xs text-gray-600">Submitted</p>
                <p className="text-sm font-medium">
                  {submissionDate
                    ? formatDistanceToNow(submissionDate, { addSuffix: true })
                    : 'Unknown time'}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Camera className="h-4 w-4 text-gray-600" />
              <div>
                <p className="text-xs text-gray-600">Photos</p>
                <p className="text-sm font-medium">{submission.photos?.length || 0} captured</p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <FileText className="h-4 w-4 text-gray-600" />
              <div>
                <p className="text-xs text-gray-600">Form Data</p>
                <p className="text-sm font-medium">
                  {formSections.length} sections, {totalFields} fields
                </p>
              </div>
            </div>
          </div>

          {/* Submission Details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-gray-600" />
              <div>
                <p className="text-xs text-gray-600">Full Date & Time</p>
                <p className="text-sm font-medium">
                  {submissionDate ? format(submissionDate, 'MMM dd, yyyy HH:mm') : 'Unknown date'}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Smartphone className="h-4 w-4 text-gray-600" />
              <div>
                <p className="text-xs text-gray-600">Platform</p>
                <p className="text-sm font-medium">
                  {submission.metadata?.deviceInfo?.platform || 'Unknown'}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Expanded Content - All Data in Single Page */}
      {isExpanded && (
        <div className="space-y-6">
          {/* Form Data Sections - All in Single Card */}
          {formSections.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <FileText className="h-5 w-5 text-green-600" />
                <h3 className="text-lg font-semibold">Form Data</h3>
                <Badge className={baseBadgeStyle}>
                  {formSections.length} SECTIONS, {totalFields} FIELDS
                </Badge>
              </div>

              <Card className="border-l-4 border-l-green-500">
                <CardContent className="p-6 space-y-6">
                  {formSections.map((section, sectionIndex) => (
                    <div
                      key={sectionIndex}
                      className={sectionIndex > 0 ? 'pt-6 border-t border-gray-200' : ''}
                    >
                      {/* Section Header - Compact */}
                      <div className="flex items-center space-x-2 mb-3">
                        <div className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                          {sectionIndex + 1}
                        </div>
                        <h4 className="text-base font-semibold text-gray-900">{section.title}</h4>
                        <Badge className={baseBadgeStyle}>
                          {section.fields?.length || 0} FIELDS
                        </Badge>
                      </div>

                      {/* Fields - Inline Single Column */}
                      <div className="grid grid-cols-1 gap-y-2">
                        {section.fields?.map((field, fieldIndex) => (
                          <div key={fieldIndex} className="flex items-baseline py-1">
                            {/* Label and Value Inline */}
                            <span className="text-sm font-medium text-gray-600 min-w-[140px] shrink-0">
                              {field.label}:
                            </span>
                            <span className="text-sm text-gray-900 ml-2 flex-1">
                              {getFieldValue(field) || (
                                <span className="text-gray-400 italic">Not provided</span>
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="p-6 text-center">
                <FileText className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Form Data</h3>
                <p className="text-gray-600">No form fields were captured in this submission.</p>
              </CardContent>
            </Card>
          )}

          {/* Verification Images */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Camera className="h-5 w-5 text-green-600" />
              <h3 className="text-lg font-semibold">Verification Photos</h3>
              <Badge className={baseBadgeStyle}>{submission.photos?.length || 0} PHOTOS</Badge>
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
            outcome={submission.outcome || 'Positive &amp; Door Locked'}
          />
        </div>
      )}
    </div>
  );
};
