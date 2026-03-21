import React, { useState } from 'react';
import { useCaseFormSubmissions } from '@/hooks/useForms';
import { FormViewer } from '@/components/forms/FormViewer';
import { FormSubmissionsList } from '@/components/forms/FormSubmissionsList';
import { FormsDebug } from '@/components/debug/FormsDebug';
import { FileText, TestTube, AlertCircle, CheckCircle } from 'lucide-react';
import { LoadingSpinner } from '@/ui/components/Loading';
import { Badge } from '@/ui/components/Badge';
import { Button } from '@/ui/components/Button';
import { Card } from '@/ui/components/Card';
import { Input } from '@/ui/components/Input';
import { Page } from '@/ui/layout/Page';
import { Section } from '@/ui/layout/Section';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';

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
    <Page
      title="Forms System Test"
      subtitle="Validate form submission display, viewer behavior, and API responses."
      shell
      actions={<Badge variant="warning">Test Environment</Badge>}
    >
      <Section>
        <Stack gap={3}>
          <Badge variant="accent">QA Surface</Badge>
          <Text as="h2" variant="headline">Keep form-debugging, viewer validation, and submission testing in one place.</Text>
        </Stack>
      </Section>

      <Section>
        <Card tone="strong" staticCard>
          <Stack gap={4}>
            <Text as="h3" variant="title">Test Case Selection</Text>
            <Stack direction="horizontal" gap={4} align="center" wrap="wrap">
            <Input
              placeholder="Enter Case ID"
              value={testCaseId}
              onChange={(e) => setTestCaseId(e.target.value)}
              style={{ width: '12rem' }}
            />
              <Text tone="muted">or select from test cases:</Text>
            </Stack>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {testCases.map((testCase) => (
              <Button
                key={testCase.id}
                variant={testCaseId === testCase.id ? 'primary' : 'secondary'}
                onClick={() => setTestCaseId(testCase.id)}
                style={{ justifyContent: 'flex-start' }}
                icon={<FileText size={16} />}
              >
                {testCase.name}
              </Button>
            ))}
          </div>
          </Stack>
        </Card>
      </Section>

      <Section>
        <Card tone="strong" staticCard>
          <Stack gap={3}>
            <Text as="h3" variant="title">API Status</Text>
            <Stack direction="horizontal" gap={4} align="center" wrap="wrap">
            {isLoading && (
              <Stack direction="horizontal" gap={2} align="center">
                <LoadingSpinner size="sm" />
                <Text variant="body-sm" tone="muted">Loading...</Text>
              </Stack>
            )}
            
            {error && (
              <Stack direction="horizontal" gap={2} align="center">
                <AlertCircle size={16} style={{ color: 'var(--ui-danger)' }} />
                <Text variant="body-sm" tone="danger">Error: {error.message}</Text>
              </Stack>
            )}
            
            {!isLoading && !error && (
              <Stack direction="horizontal" gap={2} align="center">
                <CheckCircle size={16} style={{ color: 'var(--ui-positive)' }} />
                <Text variant="body-sm" tone="positive">API Connected - {submissions.length} submissions found</Text>
              </Stack>
            )}
            </Stack>
          </Stack>
        </Card>
      </Section>

      <Section>
      <FormsDebug caseId={testCaseId} />
      </Section>

      {submissions.length > 0 && (
        <Section>
          <Card tone="strong" staticCard>
            <Stack gap={4}>
              <Text as="h3" variant="title">Form Submissions List Component Test</Text>
            <FormSubmissionsList
              submissions={submissions}
              isLoading={isLoading}
              onSubmissionSelect={(submission) => setSelectedSubmissionId(submission.id)}
              showSearch={true}
              showFilters={true}
              showSorting={true}
            />
            </Stack>
          </Card>
        </Section>
      )}

      {selectedSubmission && (
        <Section>
          <Card tone="strong" staticCard>
            <Stack gap={4}>
              <Text as="h3" variant="title">Form Viewer Component Test</Text>
            <FormViewer
              submission={selectedSubmission}
              readonly={true}
              showAttachments={true}
              showPhotos={true}
              showLocation={true}
              showMetadata={true}
            />
            </Stack>
          </Card>
        </Section>
      )}

      {!isLoading && !error && submissions.length === 0 && (
        <Section>
          <Card tone="strong" staticCard>
            <Stack gap={3} style={{ textAlign: 'center', padding: '2rem 0' }}>
            <FileText size={48} style={{ color: 'var(--ui-muted)' }} />
              <Text as="h3" variant="title">No Form Submissions</Text>
              <Text tone="muted">
              No form submissions found for case ID: {testCaseId}
              </Text>
              <Text variant="body-sm" tone="muted">
              Try selecting one of the test cases above, or ensure the case has form submissions.
              </Text>
            </Stack>
          </Card>
        </Section>
      )}

      <Section>
        <Card tone="strong" staticCard>
          <Stack gap={2}>
            <Text as="h3" variant="title">Testing Instructions</Text>
            <Text variant="body-sm"><strong>1.</strong> Select a test case ID from the buttons above</Text>
            <Text variant="body-sm"><strong>2.</strong> Check the API Status to ensure connection is working</Text>
            <Text variant="body-sm"><strong>3.</strong> Review the Debug Panel for detailed API responses</Text>
            <Text variant="body-sm"><strong>4.</strong> Test the Form Submissions List component functionality</Text>
            <Text variant="body-sm"><strong>5.</strong> Click on a submission to test the Form Viewer component</Text>
            <Text variant="body-sm"><strong>6.</strong> Test search, filtering, and sorting features</Text>
          </Stack>
        </Card>
      </Section>
    </Page>
  );
};
