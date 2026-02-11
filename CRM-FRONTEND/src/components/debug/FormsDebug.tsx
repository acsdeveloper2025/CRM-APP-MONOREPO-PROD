import React from 'react';
import { useCaseFormSubmissions } from '@/hooks/useForms';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

interface FormsDebugProps {
  caseId: string;
}

export const FormsDebug: React.FC<FormsDebugProps> = ({ caseId }) => {
  const { data, isLoading, error } = useCaseFormSubmissions(caseId);

  return (
    <Card className="border-amber-200 bg-amber-50/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center text-amber-800">
          <AlertCircle className="h-4 w-4 mr-2" />
          Forms System Debug Output
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <p className="text-xs text-amber-700 italic">Fetching debug data...</p>
        )}
        
        {error && (
          <div className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-100 mb-2">
            Error fetching debug info: {error.message}
          </div>
        )}

        {data && (
          <div className="space-y-2">
            <div className="flex justify-between items-center text-[10px] text-amber-600 uppercase font-bold tracking-wider">
              <span>Form Submissions Response</span>
              <span>Case ID: {caseId}</span>
            </div>
            <pre className="text-[11px] font-mono bg-white p-3 rounded border border-amber-100 overflow-auto max-h-[300px] text-gray-800">
              {JSON.stringify(data, null, 2)}
            </pre>
          </div>
        )}

        {!isLoading && !data && !error && (
          <p className="text-xs text-amber-700">No data available for debug view.</p>
        )}
      </CardContent>
    </Card>
  );
};
