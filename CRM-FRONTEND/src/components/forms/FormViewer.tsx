/* eslint-disable id-match */
import { FileText, Clock, User, Eye, Camera, Smartphone, Wifi, WifiOff, Download, MapPin, Grid, BarChart3, CheckCircle, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { FormSubmission } from '@/types/form';
import { FormFieldViewer } from './FormFieldViewer';
import { FormAttachmentsViewer } from './FormAttachmentsViewer';
import { FormLocationViewer } from './FormLocationViewer';
import { FormPhotosGallery } from './FormPhotosGallery';
import VerificationImages from '@/components/VerificationImages';
import { formatDistanceToNow } from 'date-fns';

interface EnhancedFormViewerProps {
  submission: FormSubmission;
  readonly?: boolean;
  showAttachments?: boolean;
  showPhotos?: boolean;
  showLocation?: boolean;
  showMetadata?: boolean;
  onFieldChange?: (fieldId: string, value: unknown) => void;
}

export function FormViewer({
  submission,
  readonly = true,
  showAttachments = true,
  showPhotos = true,
  showLocation = true,
  showMetadata = true,
  onFieldChange,
}: EnhancedFormViewerProps) {


  // Helper functions for styling
  const getOutcomeColor = (outcome: string) => {
    switch (outcome.toLowerCase()) {
      case 'positive':
        return 'text-green-600 dark:text-green-400';
      case 'negative':
        return 'text-red-600 dark:text-red-400';
      case 'nsp':
        return 'text-yellow-600 dark:text-yellow-400';
      default:
        return 'text-muted-foreground';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'submitted':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300';
      case 'reviewed':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300';
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
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300';
      default:
        return 'bg-muted text-muted-foreground';
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
      .split(/[-_]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getValidationBadge = (status: string) => {
    const statusConfig = {
      VALID: { variant: 'default' as const, label: 'Valid', color: 'text-green-600' },
      INVALID: { variant: 'destructive' as const, label: 'Invalid', color: 'text-red-600' },
      WARNING: { variant: 'outline' as const, label: 'Warning', color: 'text-yellow-600' },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.VALID;
    return <Badge variant={config.variant} className={config.color}>{config.label}</Badge>;
  };

  const getDeviceIcon = (platform: string) => {
    switch (platform) {
      case 'IOS':
        return <Smartphone className="h-4 w-4" />;
      case 'ANDROID':
        return <Smartphone className="h-4 w-4" />;
      default:
        return <Smartphone className="h-4 w-4" />;
    }
  };

  const getNetworkIcon = (type: string) => {
    switch (type) {
      case 'WIFI':
        return <Wifi className="h-4 w-4 text-green-600" />;
      case 'CELLULAR':
        return <Wifi className="h-4 w-4 text-blue-600" />;
      case 'OFFLINE':
        return <WifiOff className="h-4 w-4 text-red-600" />;
      default:
        return <Wifi className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Executive Summary Header */}
      <Card className="border-l-4 border-l-primary bg-gradient-to-r from-primary/5 to-transparent">
        <CardHeader className="pb-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-4">
              <div className="p-3 bg-primary/10 rounded-xl">
                <FileText className="h-8 w-8 text-primary" />
              </div>
              <div>
                <CardTitle className="text-3xl font-bold text-foreground">
                  {getFormTypeLabel(submission.formType)} Verification
                </CardTitle>
                <CardDescription className="text-lg mt-2 space-y-2">
                  <div className="flex items-center space-x-4">
                    <span className="font-semibold text-foreground">{submission.verificationType}</span>
                    <span className="text-muted-foreground">•</span>
                    <span className={`font-bold ${getOutcomeColor(submission.outcome)}`}>
                      {submission.outcome}
                    </span>
                  </div>
                  <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                    <div className="flex items-center space-x-1">
                      <User className="h-4 w-4" />
                      <span>Agent: {submission.submittedByName}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Clock className="h-4 w-4" />
                      <span>
                        {submission.submittedAt && !isNaN(new Date(submission.submittedAt).getTime())
                          ? formatDistanceToNow(new Date(submission.submittedAt), { addSuffix: true })
                          : 'Unknown time'
                        }
                      </span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Camera className="h-4 w-4" />
                      <span>{submission.photos?.length || 0} photos</span>
                    </div>
                  </div>
                </CardDescription>
              </div>
            </div>
            <div className="flex flex-col items-end space-y-2">
              <div className="flex items-center space-x-2">
                {getStatusBadge(submission.status)}
                {getValidationBadge(submission.validationStatus)}
              </div>
              <Badge variant="default" className="bg-primary text-white">
                Case #{submission.caseId}
              </Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Key Metrics Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Form Sections</div>
              <div className="text-2xl font-bold text-foreground">{submission.sections.length}</div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Camera className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Photos Captured</div>
              <div className="text-2xl font-bold text-foreground">{submission.photos?.length || 0}</div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <MapPin className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">GPS Accuracy</div>
              <div className="text-2xl font-bold text-foreground">
                {submission.geoLocation?.accuracy ? `±${submission.geoLocation.accuracy}m` : 'N/A'}
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Smartphone className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Platform</div>
              <div className="text-lg font-bold text-foreground">
                {submission.metadata?.deviceInfo?.platform || 'Unknown'}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Main Content Layout - Two Column */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left Column - Form Data (2/3 width) */}
        <div className="xl:col-span-2 space-y-6">
          {/* Form Sections */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Grid className="h-5 w-5" />
                <span>Form Data</span>
              </CardTitle>
              <CardDescription>
                Complete form submission with all field values
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {submission.sections.map((section, sectionIndex) => (
                <div key={section.id} className="border rounded-lg overflow-hidden">
                  {/* Section Header */}
                  <div className="bg-muted px-4 py-3 border-b">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-foreground flex items-center space-x-2">
                        <span className="bg-primary text-white rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold">
                          {sectionIndex + 1}
                        </span>
                        <span>{section.title}</span>
                      </h3>
                      <Badge variant="outline" className="text-xs">
                        {section.fields.length} fields
                      </Badge>
                    </div>
                    {section.description && (
                      <p className="text-sm text-muted-foreground mt-1 ml-9">{section.description}</p>
                    )}
                  </div>

                  {/* Section Fields in Grid */}
                  <div className="p-4 bg-white">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {section.fields.map((field, fieldIndex) => (
                        <div key={field.id} className="space-y-2">
                          {/* Field Label */}
                          <div className="flex items-center justify-between">
                            <Label className="text-sm font-medium text-foreground flex items-center space-x-2">
                              <span className="bg-muted text-muted-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs">
                                {fieldIndex + 1}
                              </span>
                              <span>{field.label}</span>
                              {field.isRequired && <span className="text-red-500">*</span>}
                            </Label>
                            <Badge variant="secondary" className="text-xs">
                              {field.type}
                            </Badge>
                          </div>

                          {/* Field Value */}
                          <div className="min-h-[40px] p-3 bg-muted border rounded-md">
                            <FormFieldViewer
                              field={field}
                              readonly={true}
                              onChange={(value) => onFieldChange?.(field.id, value)}
                            />
                          </div>

                          {/* Validation Status */}
                          {field.validation && (
                            <div className="flex items-center space-x-1 text-xs">
                              {field.validation.isValid ? (
                                <Badge variant="outline" className="text-green-600 border-green-200">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Valid
                                </Badge>
                              ) : (
                                <Badge variant="destructive" className="text-red-600">
                                  <AlertCircle className="h-3 w-3 mr-1" />
                                  Invalid
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Photos Gallery */}
          {showPhotos && submission.photos && submission.photos.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Camera className="h-5 w-5" />
                  <span>Verification Photos ({submission.photos.length})</span>
                </CardTitle>
                <CardDescription>
                  Photos captured during verification with geo-location data
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FormPhotosGallery photos={submission.photos} />
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Metadata & Summary (1/3 width) */}
        <div className="space-y-6">
          {/* Quick Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <BarChart3 className="h-5 w-5" />
                <span>Summary</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Status</span>
                  {getStatusBadge(submission.status)}
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Outcome</span>
                  <span className={`font-semibold ${getOutcomeColor(submission.outcome)}`}>
                    {submission.outcome}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Validation</span>
                  {getValidationBadge(submission.validationStatus)}
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Sections</span>
                  <span className="font-semibold">{submission.sections.length}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Device & Network Info */}
          {showMetadata && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Smartphone className="h-5 w-5" />
                  <span>Device Info</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <div className="text-sm font-medium text-foreground mb-1">Platform</div>
                    <div className="text-sm text-muted-foreground">{submission.metadata.deviceInfo.platform}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-foreground mb-1">App Version</div>
                    <div className="text-sm text-muted-foreground">v{submission.metadata.deviceInfo.appVersion}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-foreground mb-1">Network</div>
                    <div className="flex items-center space-x-2">
                      {getNetworkIcon(submission.metadata.networkInfo.type)}
                      <span className="text-sm text-muted-foreground">{submission.metadata.networkInfo.type}</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-foreground mb-1">Form Version</div>
                    <div className="text-sm text-muted-foreground">{submission.metadata.formVersion}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Validation Errors */}
          {submission.validationErrors && submission.validationErrors.length > 0 && (
            <Card className="border-red-200">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-red-800">
                  <AlertCircle className="h-5 w-5" />
                  <span>Validation Issues</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="text-sm text-red-700 space-y-1">
                  {submission.validationErrors.map((error, index) => (
                    <li key={index} className="flex items-start space-x-2">
                      <span className="text-red-500 mt-0.5">•</span>
                      <span>{error}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Exact Form as Filled by Field Agent */}
      <Card className="border-2 border-primary/20">
        <CardHeader className="bg-primary/5">
          <CardTitle className="text-xl flex items-center space-x-2">
            <FileText className="h-6 w-6 text-primary" />
            <span>Form as Submitted by Field Agent</span>
          </CardTitle>
          <CardDescription>
            Exact replica of the form filled by {submission.submittedByName} on {
              submission.submittedAt && !isNaN(new Date(submission.submittedAt).getTime())
                ? new Date(submission.submittedAt).toLocaleDateString()
                : 'Unknown date'
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          {/* Form Header with Key Information */}
          <div className="mb-8 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-200">
            <h2 className="text-2xl font-bold text-center text-foreground mb-4">
              {getFormTypeLabel(submission.formType)} Verification Form
            </h2>

            {/* Key Form Metadata */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              <div className="bg-white p-3 rounded-lg border">
                <div className="font-medium text-muted-foreground">Case ID</div>
                <div className="text-lg font-bold text-primary">{submission.caseId}</div>
              </div>
              <div className="bg-white p-3 rounded-lg border">
                <div className="font-medium text-muted-foreground">Field Agent</div>
                <div className="text-lg font-semibold text-foreground">{submission.submittedByName}</div>
              </div>
              <div className="bg-white p-3 rounded-lg border">
                <div className="font-medium text-muted-foreground">Verification Outcome</div>
                <div className={`text-lg font-bold ${getOutcomeColor(submission.outcome)}`}>
                  {submission.outcome}
                </div>
              </div>
              <div className="bg-white p-3 rounded-lg border">
                <div className="font-medium text-muted-foreground">Total Images</div>
                <div className="text-lg font-bold text-green-600">
                  {submission.photos?.length || 0} photos
                </div>
              </div>
            </div>

            {/* Submission Timestamp */}
            <div className="mt-4 text-center">
              <div className="inline-flex items-center space-x-2 bg-white px-4 py-2 rounded-full border">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Submitted on {
                    submission.submittedAt && !isNaN(new Date(submission.submittedAt).getTime())
                      ? new Date(submission.submittedAt).toLocaleDateString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })
                      : 'Unknown date'
                  } at {
                    submission.submittedAt && !isNaN(new Date(submission.submittedAt).getTime())
                      ? new Date(submission.submittedAt).toLocaleTimeString()
                      : 'Unknown time'
                  }
                </span>
              </div>
            </div>
          </div>

          {/* Form Sections - Exact Layout */}
          <div className="space-y-6">
            {submission.sections.map((section, sectionIndex) => (
              <div key={section.id} className="border rounded-lg overflow-hidden">
                {/* Section Header */}
                <div className="bg-gradient-to-r from-gray-100 to-gray-50 px-6 py-4 border-b">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-foreground flex items-center space-x-2">
                        <span className="bg-primary text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">
                          {sectionIndex + 1}
                        </span>
                        <span>{section.title}</span>
                      </h3>
                      {section.description && (
                        <p className="text-sm text-muted-foreground mt-1 ml-10">{section.description}</p>
                      )}
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {section.fields.length} fields
                    </Badge>
                  </div>
                </div>

                {/* Section Fields */}
                <div className="p-6 bg-white">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {section.fields.map((field, fieldIndex) => (
                      <div key={field.id} className="space-y-3">
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
                          <FormFieldViewer
                            field={field}
                            readonly={true}
                            onChange={(value) => onFieldChange?.(field.id, value)}
                          />
                        </div>

                        {/* Field Validation Status */}
                        {field.validation && (
                          <div className="flex items-center space-x-2 text-xs">
                            {field.validation.isValid ? (
                              <Badge variant="outline" className="text-green-600 border-green-200">
                                ✓ Valid
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="text-red-600">
                                ✗ Invalid
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Form Summary Footer */}
          <div className="mt-8 p-6 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border-2 border-border">
            <h4 className="text-lg font-bold text-foreground mb-4 flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <span>Form Submission Summary</span>
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-lg border">
                <div className="text-sm font-medium text-foreground">Status</div>
                <Badge className={getStatusColor(submission.status)} variant="outline">
                  {submission.status.replace('_', ' ')}
                </Badge>
              </div>
              <div className="bg-white p-4 rounded-lg border">
                <div className="text-sm font-medium text-foreground">Verification Outcome</div>
                <span className={`text-lg font-bold ${getOutcomeColor(submission.outcome)}`}>
                  {submission.outcome}
                </span>
              </div>
              <div className="bg-white p-4 rounded-lg border">
                <div className="text-sm font-medium text-foreground">Validation Status</div>
                <Badge className={getValidationColor(submission.validationStatus)} variant="outline">
                  {submission.validationStatus}
                </Badge>
              </div>
              <div className="bg-white p-4 rounded-lg border">
                <div className="text-sm font-medium text-foreground">Form Sections</div>
                <div className="text-lg font-bold text-blue-600">
                  {submission.sections.length} sections
                </div>
              </div>
            </div>

            {/* Additional Metadata */}
            {submission.metadata && (
              <div className="mt-4 p-4 bg-white rounded-lg border">
                <h5 className="text-sm font-bold text-foreground mb-2">Submission Metadata</h5>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-muted-foreground">
                  <div>
                    <span className="font-medium">Platform:</span> {submission.metadata.deviceInfo?.platform || 'Unknown'}
                  </div>
                  <div>
                    <span className="font-medium">App Version:</span> {submission.metadata.deviceInfo?.appVersion || 'Unknown'}
                  </div>
                  <div>
                    <span className="font-medium">Network:</span> {submission.metadata.networkInfo?.type || 'Unknown'}
                  </div>
                  {(submission.metadata as any).totalImages && (
                    <div>
                      <span className="font-medium">Images Captured:</span> {(submission.metadata as any).totalImages}
                    </div>
                  )}
                  {(submission.metadata as any).formType && (
                    <div>
                      <span className="font-medium">Form Type:</span> {(submission.metadata as any).formType}
                    </div>
                  )}
                  <div>
                    <span className="font-medium">Submission Attempts:</span> {submission.metadata.submissionAttempts || 1}
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Verification Images - Captured during form submission */}
      {submission.caseId && (
        <VerificationImages
          caseId={submission.caseId}
          submissionId={submission.id}
          title="Captured Verification Images"
          showStats={true}
          submissionAddress={submission.geoLocation?.address}
        />
      )}

      {/* Form Attachments */}
      {showAttachments && submission.attachments.length > 0 && (
        <FormAttachmentsViewer
          attachments={submission.attachments}
          readonly={readonly}
        />
      )}

      {/* Form Location */}
      {showLocation && submission.geoLocation && (
        <FormLocationViewer
          location={submission.geoLocation}
          readonly={readonly}
        />
      )}

      {/* Review Comments */}
      {submission.reviewNotes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center space-x-2">
              <Eye className="h-5 w-5" />
              <span>Review Comments</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm whitespace-pre-wrap">{submission.reviewNotes}</p>
              {submission.reviewedBy && submission.reviewedAt && (
                <div className="flex items-center justify-between mt-3 pt-3 border-t">
                  <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                    <User className="h-3 w-3" />
                    <span>Reviewed by {submission.reviewedBy}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>{new Date(submission.reviewedAt).toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Form Actions */}
      {!readonly && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Last updated: {new Date(submission.submittedAt).toLocaleString()}
              </div>
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export PDF
                </Button>
                <Button variant="outline" size="sm">
                  <FileText className="h-4 w-4 mr-2" />
                  Print Form
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
