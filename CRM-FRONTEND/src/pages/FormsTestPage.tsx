import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useCaseFormSubmissions } from '@/hooks/useForms';
import { FormViewer } from '@/components/forms/FormViewer';
import { FormSubmissionsList } from '@/components/forms/FormSubmissionsList';
import { FormsDebug } from '@/components/debug/FormsDebug';
import { FileText, TestTube, AlertCircle, CheckCircle } from 'lucide-react';

export const FormsTestPage: React.FC = () => {
  const [testCaseId, setTestCaseId] = useState('22'); // One of our newly created cases
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  
  const { data: formSubmissionsData, isLoading, error } = useCaseFormSubmissions(testCaseId);
  const submissions = formSubmissionsData?.data?.submissions || [];
  const selectedSubmission = submissions.find(s => s.id === selectedSubmissionId);

  const testCases = [
    { id: '22', name: 'Rajesh Kumar - Residence' },
    { id: '23', name: 'Priya Sharma - Office' },
    { id: '24', name: 'Amit Patel - Business' },
    { id: '25', name: 'Sunita Reddy - Residence cum Office' },
    { id: '26', name: 'Vikram Singh - Builder' },
    { id: '27', name: 'Meera Joshi - DSA Connector' },
    { id: '28', name: 'Ravi Gupta - Property Individual' },
    { id: '29', name: 'Kavita Nair - Property APF' },
    { id: '30', name: 'Deepak Agarwal - NOC' },
  ];

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center space-x-2">
            <TestTube className="h-8 w-8 text-blue-600" />
            <span>Forms System Test Page</span>
          </h1>
          <p className="mt-2 text-muted-foreground">Test the comprehensive form data display system</p>
        </div>
        <Badge variant="outline" className="text-lg px-3 py-1">
          Test Environment
        </Badge>
      </div>

      {/* Test Case Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Test Case Selection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-4">
            <Input
              placeholder="Enter Case ID"
              value={testCaseId}
              onChange={(e) => setTestCaseId(e.target.value)}
              className="w-48"
            />
            <span className="text-muted-foreground">or select from test cases:</span>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {testCases.map((testCase) => (
              <Button
                key={testCase.id}
                variant={testCaseId === testCase.id ? "default" : "outline"}
                size="sm"
                onClick={() => setTestCaseId(testCase.id)}
                className="justify-start"
              >
                <FileText className="h-4 w-4 mr-2" />
                {testCase.name}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* API Status */}
      <Card>
        <CardHeader>
          <CardTitle>API Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            {isLoading && (
              <div className="flex items-center space-x-2 text-blue-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span>Loading...</span>
              </div>
            )}
            
            {error && (
              <div className="flex items-center space-x-2 text-red-600">
                <AlertCircle className="h-4 w-4" />
                <span>Error: {error.message}</span>
              </div>
            )}
            
            {!isLoading && !error && (
              <div className="flex items-center space-x-2 text-green-600">
                <CheckCircle className="h-4 w-4" />
                <span>API Connected - {submissions.length} submissions found</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Debug Panel */}
      <FormsDebug caseId={testCaseId} />

      {/* Form Submissions List */}
      {submissions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Form Submissions List Component Test</CardTitle>
          </CardHeader>
          <CardContent>
            <FormSubmissionsList
              submissions={submissions}
              isLoading={isLoading}
              onSubmissionSelect={(submission) => setSelectedSubmissionId(submission.id)}
              showSearch={true}
              showFilters={true}
              showSorting={true}
            />
          </CardContent>
        </Card>
      )}

      {/* Form Viewer */}
      {selectedSubmission && (
        <Card>
          <CardHeader>
            <CardTitle>Form Viewer Component Test</CardTitle>
          </CardHeader>
          <CardContent>
            <FormViewer
              submission={selectedSubmission}
              readonly={true}
              showAttachments={true}
              showPhotos={true}
              showLocation={true}
              showMetadata={true}
            />
          </CardContent>
        </Card>
      )}

      {/* No Data State */}
      {!isLoading && !error && submissions.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No Form Submissions</h3>
            <p className="text-muted-foreground mb-4">
              No form submissions found for case ID: {testCaseId}
            </p>
            <p className="text-sm text-muted-foreground">
              Try selecting one of the test cases above, or ensure the case has form submissions.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Testing Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p><strong>1.</strong> Select a test case ID from the buttons above</p>
          <p><strong>2.</strong> Check the API Status to ensure connection is working</p>
          <p><strong>3.</strong> Review the Debug Panel for detailed API responses</p>
          <p><strong>4.</strong> Test the Form Submissions List component functionality</p>
          <p><strong>5.</strong> Click on a submission to test the Form Viewer component</p>
          <p><strong>6.</strong> Test search, filtering, and sorting features</p>
        </CardContent>
      </Card>
    </div>
  );
};
