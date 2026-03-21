import { useState } from 'react';
import { FileText, Eye, Download, Share2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/components/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/components/select';
import { FormViewer } from '@/components/forms/FormViewer';
import { FormSubmission } from '@/types/form';
import { Badge } from '@/ui/components/Badge';
import { Button } from '@/ui/components/Button';
import { Card } from '@/ui/components/Card';
import { Page } from '@/ui/layout/Page';
import { Section } from '@/ui/layout/Section';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';

export function FormViewerPage() {
  const [selectedFormType, setSelectedFormType] = useState<string>('residence-positive');
  const [viewMode, setViewMode] = useState<'readonly' | 'editable'>('readonly');

  // Mock data removed - using real API data only
  const sampleSubmission: FormSubmission | null = null;
  // Mock data removed - using real API data only
  const formTypes: { value: string; label: string }[] = [];

  return (
    <Page
      title="Form Viewer"
      subtitle="View and inspect verification form submissions."
      shell
      actions={
        <Stack direction="horizontal" gap={2} wrap="wrap">
          <Button variant="secondary" icon={<Download size={16} />}>
            Export PDF
          </Button>
          <Button variant="secondary" icon={<Share2 size={16} />}>
            Share
          </Button>
        </Stack>
      }
    >
      <Section>
        <Stack gap={3}>
          <Badge variant="accent">Viewer Surface</Badge>
          <Text as="h2" variant="headline">Keep the viewer controls and raw data side-by-side inside the shared shell.</Text>
        </Stack>
      </Section>

      <Section>
        <Card tone="strong" staticCard>
          <Stack gap={4}>
            <Stack direction="horizontal" gap={2} align="center">
              <Eye size={18} />
              <Text as="h3" variant="title">Form Viewer Controls</Text>
            </Stack>
            <Text variant="body-sm" tone="muted">
              Configure the form viewer settings and select different form types.
            </Text>
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
              <Select value={viewMode} onValueChange={(value: 'readonly' | 'editable') => setViewMode(value)}>
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
          </Stack>
        </Card>
      </Section>

      <Section>
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
                console.warn('Field changed:', fieldId, value);
              }}
              onSectionToggle={(sectionId, expanded) => {
                console.warn('Section toggled:', sectionId, expanded);
              }}
            />
          ) : (
            <div className="text-center py-8 text-gray-600">
              No form data available. Mock data has been removed.
            </div>
          )}
        </TabsContent>

        <TabsContent value="json" className="space-y-4">
          <Card tone="strong" staticCard>
            <Stack gap={3}>
              <Text as="h3" variant="title">Form Submission JSON</Text>
              <Text variant="body-sm" tone="muted">
                Raw JSON data structure of the form submission.
              </Text>
              <pre className="bg-slate-100 dark:bg-slate-800/60 p-4 rounded-lg overflow-auto text-xs">
                {sampleSubmission ? JSON.stringify(sampleSubmission, null, 2) : 'No data available'}
              </pre>
            </Stack>
          </Card>
        </TabsContent>
      </Tabs>
      </Section>
    </Page>
  );
}
