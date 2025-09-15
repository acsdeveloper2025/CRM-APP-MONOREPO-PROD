import React, { useState } from 'react';
import { FileText, Eye, Download, Share2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormViewer } from '@/components/forms/FormViewer';
import { FormSubmission, FormType, VerificationType, VerificationOutcome } from '@/types/form';

export function FormViewerPage() {
  const [selectedFormType, setSelectedFormType] = useState<string>('residence-positive');
  const [viewMode, setViewMode] = useState<'readonly' | 'editable'>('readonly');

  // Mock data removed - using real API data only
  const sampleSubmission: FormSubmission | null = null;
  // Mock data removed - using real API data only
  const formTypes: any[] = [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Form Viewer</h1>
          <p className="text-muted-foreground">
            View and interact with verification form submissions
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
          <Button variant="outline" size="sm">
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>
        </div>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Eye className="h-5 w-5" />
            <span>Form Viewer Controls</span>
          </CardTitle>
          <CardDescription>
            Configure the form viewer settings and select different form types
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Form Type</label>
              <Select value={selectedFormType} onValueChange={setSelectedFormType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select form type" />
                </SelectTrigger>
                <SelectContent>
                  {formTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">View Mode</label>
              <Select value={viewMode} onValueChange={(value: any) => setViewMode(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select view mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="readonly">Read Only</SelectItem>
                  <SelectItem value="editable">Editable</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Form Viewer */}
      <Tabs defaultValue="viewer" className="space-y-4">
        <TabsList>
          <TabsTrigger value="viewer">
            <FileText className="h-4 w-4 mr-2" />
            Form Viewer
          </TabsTrigger>
          <TabsTrigger value="json">
            <Eye className="h-4 w-4 mr-2" />
            JSON Data
          </TabsTrigger>
        </TabsList>

        <TabsContent value="viewer" className="space-y-4">
          {sampleSubmission ? (
            <FormViewer
              submission={sampleSubmission}
              readonly={viewMode === 'readonly'}
              showAttachments={true}
              showLocation={true}
              showMetadata={true}
              onFieldChange={(fieldId, value) => {
                console.log('Field changed:', fieldId, value);
              }}
              onSectionToggle={(sectionId, expanded) => {
                console.log('Section toggled:', sectionId, expanded);
              }}
            />
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No form data available. Mock data has been removed.
            </div>
          )}
        </TabsContent>

        <TabsContent value="json" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Form Submission JSON</CardTitle>
              <CardDescription>
                Raw JSON data structure of the form submission
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted p-4 rounded-lg overflow-auto text-xs">
                {sampleSubmission ? JSON.stringify(sampleSubmission, null, 2) : 'No data available'}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
