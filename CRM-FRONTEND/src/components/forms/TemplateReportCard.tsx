import React, { useState, useEffect, useCallback } from 'react';
import { FileText, Download, RefreshCw, Clock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { apiService } from '@/services/api';
import { Card, CardContent } from '@/ui/components/Card';
import { Button } from '@/ui/components/Button';
import { Badge } from '@/ui/components/Badge';
import { Box } from '@/ui/primitives/Box';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';

interface TemplateReport {
  id: string;
  content: string;
  metadata: {
    verificationType: string;
    outcome: string;
    generatedAt: string;
    templateUsed: string;
  };
  createdAt: string;
}

interface TemplateReportCardProps {
  caseId: string;
  submissionId: string;
  verificationType: string;
  outcome: string;
}

export const TemplateReportCard: React.FC<TemplateReportCardProps> = ({
  caseId,
  submissionId,
  verificationType: _verificationType,
  outcome: _outcome
}) => {
  const [report, setReport] = useState<TemplateReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const loadExistingReport = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getRaw<{ success: boolean; report: TemplateReport }>(
        `/template-reports/cases/${caseId}/submissions/${submissionId}`
      );
      if (response.status === 200 && response.data.success) {
        setReport(response.data.report);
      } else if (response.status === 404) {
        setReport(null);
      } else {
        throw new Error(`Failed to load template report: ${response.status}`);
      }
    } catch (err: unknown) {
      const errorObj = err as { response?: { status: number } };
      if (errorObj.response?.status === 404) {
        setReport(null);
      } else {
        setError('Failed to load existing template report. You can still generate a new one.');
      }
    } finally {
      setLoading(false);
    }
  }, [caseId, submissionId]);

  useEffect(() => {
    loadExistingReport();
  }, [loadExistingReport]);

  const generateReport = async () => {
    try {
      setGenerating(true);
      setError(null);
      const response = await apiService.post<{
        success: boolean;
        reportId: string;
        report: string;
        metadata: TemplateReport['metadata'];
        error?: string;
      }>(`/template-reports/cases/${caseId}/submissions/${submissionId}/generate`);

      if (response.success && response.data) {
        setReport({
          id: response.data.reportId,
          content: response.data.report,
          metadata: response.data.metadata,
          createdAt: new Date().toISOString(),
        });
      } else {
        throw new Error(response.message || 'Failed to generate report');
      }
    } catch (err: unknown) {
      const errorObj = err as Error;
      setError(errorObj.message || 'Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  const downloadReport = () => {
    if (!report) {return;}
    const content = `VERIFICATION REPORT\nGenerated: ${new Date(report.createdAt).toLocaleString()}\nVerification Type: ${report.metadata.verificationType}\nOutcome: ${report.metadata.outcome}\nTemplate Used: ${report.metadata.templateUsed}\n\n${report.content}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `template-report-case-${caseId}-${submissionId}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

  if (loading) {
    return (
      <Card>
        <CardContent style={{ padding: '1.5rem' }}>
          <Stack direction="horizontal" gap={2} align="center" justify="center">
            <Loader2 size={24} style={{ color: 'var(--ui-accent)' }} />
            <Text tone="muted">Loading template report...</Text>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent style={{ padding: '1.5rem' }}>
        <Stack gap={6}>
          <Box style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <Stack direction="horizontal" gap={3} align="center">
              <Box style={{ padding: '0.5rem', background: 'color-mix(in srgb, var(--ui-accent) 12%, transparent)', borderRadius: 'var(--ui-radius-lg)' }}>
                <FileText size={20} style={{ color: 'var(--ui-accent)' }} />
              </Box>
              <Stack gap={1}>
                <Text as="h3" variant="title">Template Verification Report</Text>
                <Text variant="body-sm" tone="muted">Structured report based on predefined templates</Text>
              </Stack>
            </Stack>
            <Stack direction="horizontal" gap={2} align="center">
              <CheckCircle size={16} style={{ color: 'var(--ui-success)' }} />
              <Text variant="body-sm" tone="muted">Template-Based</Text>
            </Stack>
          </Box>

          {error ? (
            <Box style={{ padding: '1rem', border: '1px solid var(--ui-danger)', borderRadius: 'var(--ui-radius-lg)', background: 'color-mix(in srgb, var(--ui-danger) 8%, transparent)' }}>
              <Stack direction="horizontal" gap={2} align="center">
                <AlertCircle size={20} style={{ color: 'var(--ui-danger)' }} />
                <Text tone="danger">{error}</Text>
              </Stack>
            </Box>
          ) : null}

          {report ? (
            <Stack gap={6}>
              <Box style={{ background: 'var(--ui-surface-muted)', borderRadius: 'var(--ui-radius-lg)', padding: '1rem' }}>
                <Stack gap={3}>
                  <Text as="h4" variant="label">Report Content</Text>
                  <Text style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{report.content}</Text>
                </Stack>
              </Box>

              <Box style={{ background: 'var(--ui-surface-muted)', borderRadius: 'var(--ui-radius-lg)', padding: '1rem' }}>
                <Stack gap={3}>
                  <Text as="h4" variant="label">
                    <Stack direction="horizontal" gap={2} align="center">
                      <Clock size={16} style={{ color: 'var(--ui-text-muted)' }} />
                      <span>Report Details</span>
                    </Stack>
                  </Text>
                  <Box style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                    <Text variant="body-sm" tone="muted"><strong>Generated:</strong> {formatDate(report.createdAt)}</Text>
                    <Text variant="body-sm" tone="muted"><strong>Type:</strong> {report.metadata.verificationType}</Text>
                    <Text variant="body-sm" tone="muted"><strong>Outcome:</strong> {report.metadata.outcome}</Text>
                    <Text variant="body-sm" tone="muted"><strong>Template:</strong> {report.metadata.templateUsed}</Text>
                  </Box>
                </Stack>
              </Box>

              <Stack direction="horizontal" gap={3} wrap="wrap">
                <Button onClick={generateReport} disabled={generating} icon={generating ? <Loader2 size={16} /> : <RefreshCw size={16} />}>
                  {generating ? 'Regenerating...' : 'Regenerate Report'}
                </Button>
                <Button variant="secondary" onClick={downloadReport} icon={<Download size={16} />}>
                  Download Report
                </Button>
              </Stack>
            </Stack>
          ) : (
            <Stack gap={4} align="center" style={{ textAlign: 'center', paddingBlock: '1.5rem' }}>
              <FileText size={48} style={{ color: 'var(--ui-text-soft)' }} />
              <Text as="h4" variant="title">No Template Report Generated</Text>
              <Text tone="muted">Generate a structured verification report using predefined templates</Text>
              <Button onClick={generateReport} disabled={generating} icon={generating ? <Loader2 size={20} /> : <FileText size={20} />}>
                {generating ? 'Generating Report...' : 'Generate Template Report'}
              </Button>
            </Stack>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};
