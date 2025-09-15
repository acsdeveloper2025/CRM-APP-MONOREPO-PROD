import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCaseFormSubmissions } from '@/hooks/useForms';

interface FormsDebugProps {
  caseId: string;
}

export const FormsDebug: React.FC<FormsDebugProps> = ({ caseId }) => {
  const { data, isLoading, error } = useCaseFormSubmissions(caseId);

  const testFormsService = async () => {
    try {
      console.log('Testing forms service...');
      const { formsService } = await import('@/services/forms');
      const result = await formsService.getCaseFormSubmissions(caseId);
      console.log('Forms service result:', result);
    } catch (error) {
      console.error('Forms service error:', error);
    }
  };

  return (
    <Card className="m-4">
      <CardHeader>
        <CardTitle>Forms Debug Panel</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <strong>Case ID:</strong> {caseId}
        </div>
        
        <div>
          <strong>Loading:</strong> {isLoading ? 'Yes' : 'No'}
        </div>
        
        <div>
          <strong>Error:</strong> {error ? error.message : 'None'}
        </div>
        
        <div>
          <strong>Data:</strong>
          <pre className="bg-muted p-2 rounded text-xs overflow-auto max-h-40">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
        
        <Button onClick={testFormsService}>
          Test Forms Service
        </Button>
      </CardContent>
    </Card>
  );
};
