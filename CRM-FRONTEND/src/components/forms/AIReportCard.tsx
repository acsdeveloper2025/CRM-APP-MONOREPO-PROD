import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/components/card';
import { Button } from '@/ui/components/button';
import { Badge } from '@/ui/components/badge';
import { Separator } from '@/ui/components/separator';
import { Brain, FileText, CheckCircle, Clock, Download, RefreshCw, TrendingUp, Shield, Target } from 'lucide-react';
import { toast } from 'sonner';
import { aiReportsService } from '@/services/aiReports';
import { Box } from '@/ui/primitives/Box';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';

interface AIReport {
  id: string;
  executiveSummary: string;
  keyFindings: string[];
  verificationDetails: string;
  riskAssessment: string;
  recommendations: string[];
  conclusion: string;
  confidence: number;
  templateReport?: string;
  templateInsights?: {
    verificationType: string;
    statusCategory: string;
    riskAssessment: {
      level: 'LOW' | 'MEDIUM' | 'HIGH';
      factors: string[];
      mitigation: string[];
    };
  };
  metadata?: {
    generatedAt: string;
    generatedBy: string;
    verificationType: string;
    outcome: string;
  };
}

interface AIReportCardProps {
  caseId: string;
  submissionId: string;
  className?: string;
}

export const AIReportCard: React.FC<AIReportCardProps> = ({ caseId, submissionId }) => {
  const [report, setReport] = useState<AIReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadExistingReport = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await aiReportsService.getFormSubmissionReport(caseId, submissionId);
      if (response.success && response.data) {
        setReport(response.data.report);
      }
    } catch (err: unknown) {
      const errorResponse = err as { response?: { status?: number } };
      if (errorResponse.response?.status !== 404) {
        setError('Failed to load AI report');
      }
    } finally {
      setIsLoading(false);
    }
  }, [caseId, submissionId]);

  useEffect(() => {
    loadExistingReport();
  }, [loadExistingReport]);

  const generateReport = async () => {
    try {
      setIsGenerating(true);
      setError(null);
      toast.info('Generating AI report...', { description: 'This may take a few moments' });
      const response = await aiReportsService.generateFormSubmissionReport(caseId, submissionId);
      if (response.success && response.data) {
        setReport(response.data.report);
        toast.success('AI report generated successfully');
      } else {
        throw new Error(response.message || 'Failed to generate report');
      }
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
      const errorMessage = errorObj.response?.data?.message || errorObj.message || 'Failed to generate AI report';
      setError(errorMessage);
      toast.error('Failed to generate AI report', { description: errorMessage });
    } finally {
      setIsGenerating(false);
    }
  };

  const getRiskTone = (level: string) => {
    switch (level) {
      case 'LOW': return 'positive';
      case 'MEDIUM': return 'warning';
      case 'HIGH': return 'danger';
      default: return 'neutral';
    }
  };

  const getConfidenceTone = (confidence: number) => {
    if (confidence >= 85) {return 'positive';}
    if (confidence >= 70) {return 'warning';}
    return 'danger';
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent style={{ padding: '1.5rem' }}>
          <Stack direction="horizontal" gap={2} align="center" justify="center">
            <RefreshCw size={20} style={{ color: 'var(--ui-accent)' }} />
            <Text variant="body-sm" tone="muted">Loading AI report...</Text>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  if (!report) {
    return (
      <Card>
        <CardHeader>
          <Box style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <Stack direction="horizontal" gap={2} align="center">
              <Brain size={20} style={{ color: 'var(--ui-accent)' }} />
              <CardTitle>AI Verification Report</CardTitle>
            </Stack>
            <Badge variant="outline">Powered by Gemini AI</Badge>
          </Box>
        </CardHeader>
        <CardContent>
          <Stack gap={4} align="center" style={{ textAlign: 'center', paddingBlock: '1.5rem' }}>
            <Brain size={48} style={{ color: 'var(--ui-accent)' }} />
            <Text as="h3" variant="title">Generate AI-Powered Report</Text>
            <Text variant="body-sm" tone="muted" style={{ maxWidth: '32rem' }}>
              Get comprehensive insights and analysis of this verification using advanced AI technology.
            </Text>
            <Button onClick={generateReport} disabled={isGenerating} icon={isGenerating ? <RefreshCw size={16} /> : <Brain size={16} />}>
              {isGenerating ? 'Generating Report...' : 'Generate AI Report'}
            </Button>
            {error ? (
              <Box style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'color-mix(in srgb, var(--ui-danger) 8%, transparent)', border: '1px solid var(--ui-danger)', borderRadius: 'var(--ui-radius-md)' }}>
                <Text variant="body-sm" tone="danger">{error}</Text>
              </Box>
            ) : null}
          </Stack>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <Box style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <Stack direction="horizontal" gap={2} align="center">
            <Brain size={20} style={{ color: 'var(--ui-accent)' }} />
            <CardTitle>AI Verification Report</CardTitle>
          </Stack>
          <Stack direction="horizontal" gap={2} align="center" wrap="wrap">
            <Badge variant="outline">Powered by Gemini AI</Badge>
            <Badge variant={getConfidenceTone(report.confidence)}>{report.confidence}% Confidence</Badge>
          </Stack>
        </Box>
      </CardHeader>

      <CardContent>
        <Stack gap={6}>
          <Stack gap={2}>
            <Text as="h3" variant="label">
              <Stack direction="horizontal" gap={2} align="center">
                <FileText size={16} style={{ color: 'var(--ui-accent)' }} />
                <span>Executive Summary</span>
              </Stack>
            </Text>
            <Text variant="body-sm">{report.executiveSummary}</Text>
          </Stack>

          <Separator />

          {report.templateInsights?.riskAssessment ? (
            <>
              <Stack gap={3}>
                <Stack direction="horizontal" gap={2} align="center" wrap="wrap">
                  <Shield size={16} style={{ color: 'var(--ui-warning)' }} />
                  <Text as="h3" variant="label">Risk Assessment</Text>
                  <Badge variant={getRiskTone(report.templateInsights.riskAssessment.level)}>{report.templateInsights.riskAssessment.level} RISK</Badge>
                </Stack>
                <Text variant="body-sm">{report.riskAssessment}</Text>
                {report.templateInsights.riskAssessment.factors.length > 0 ? (
                  <Box style={{ padding: '0.75rem', borderRadius: 'var(--ui-radius-md)', border: '1px solid var(--ui-warning)', background: 'color-mix(in srgb, var(--ui-warning) 10%, transparent)' }}>
                    <Stack gap={2}>
                      <Text variant="body-sm" tone="warning" style={{ fontWeight: 600 }}>Risk Factors:</Text>
                      <Stack gap={1}>
                        {report.templateInsights.riskAssessment.factors.map((factor, index) => (
                          <Stack key={index} direction="horizontal" gap={2} align="flex-start">
                            <Text as="span" tone="warning">•</Text>
                            <Text variant="body-sm">{factor}</Text>
                          </Stack>
                        ))}
                      </Stack>
                    </Stack>
                  </Box>
                ) : null}
              </Stack>
              <Separator />
            </>
          ) : null}

          <Stack gap={3}>
            <Text as="h3" variant="label">
              <Stack direction="horizontal" gap={2} align="center">
                <Target size={16} style={{ color: 'var(--ui-accent)' }} />
                <span>Key Findings</span>
              </Stack>
            </Text>
            <Stack gap={2}>
              {report.keyFindings.map((finding, index) => (
                <Stack key={index} direction="horizontal" gap={2} align="flex-start">
                  <CheckCircle size={16} style={{ color: 'var(--ui-success)', marginTop: '0.125rem' }} />
                  <Text variant="body-sm">{finding}</Text>
                </Stack>
              ))}
            </Stack>
          </Stack>

          <Separator />

          <Stack gap={3}>
            <Text as="h3" variant="label">
              <Stack direction="horizontal" gap={2} align="center">
                <TrendingUp size={16} style={{ color: 'var(--ui-accent)' }} />
                <span>Recommendations</span>
              </Stack>
            </Text>
            <Stack gap={2}>
              {report.recommendations.map((recommendation, index) => (
                <Stack key={index} direction="horizontal" gap={2} align="flex-start">
                  <Text as="span" tone="positive">•</Text>
                  <Text variant="body-sm">{recommendation}</Text>
                </Stack>
              ))}
            </Stack>
          </Stack>

          <Separator />

          <Stack gap={2}>
            <Text as="h3" variant="label">Conclusion</Text>
            <Text variant="body-sm">{report.conclusion}</Text>
          </Stack>

          {report.templateReport ? (
            <>
              <Separator />
              <Box style={{ background: 'var(--ui-surface-muted)', borderRadius: 'var(--ui-radius-lg)', padding: '1rem' }}>
                <Stack gap={3}>
                  <Stack direction="horizontal" gap={2} align="center" wrap="wrap">
                    <FileText size={16} style={{ color: 'var(--ui-accent)' }} />
                    <Text as="h3" variant="label">Residence Verification Report</Text>
                    <Badge variant="outline">Template-Based</Badge>
                  </Stack>
                  <Text as="pre" style={{ whiteSpace: 'pre-wrap', fontFamily: 'ui-monospace, SFMono-Regular, monospace', margin: 0 }}>
                    {report.templateReport}
                  </Text>
                </Stack>
              </Box>
            </>
          ) : null}

          {report.metadata ? (
            <Box style={{ background: 'var(--ui-surface-muted)', borderRadius: 'var(--ui-radius-lg)', padding: '1rem', border: '1px solid var(--ui-border)' }}>
              <Stack gap={2}>
                <Text as="h3" variant="label">
                  <Stack direction="horizontal" gap={2} align="center">
                    <Clock size={16} style={{ color: 'var(--ui-text-muted)' }} />
                    <span>Report Details</span>
                  </Stack>
                </Text>
                <Box style={{ display: 'grid', gap: '0.5rem 1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                  <Text variant="caption" tone="muted">Generated: {new Date(report.metadata.generatedAt).toLocaleString()}</Text>
                  <Text variant="caption" tone="muted">Type: {report.metadata.verificationType}</Text>
                  <Text variant="caption" tone="muted">Outcome: {report.metadata.outcome}</Text>
                  <Text variant="caption" tone="muted">Confidence: {report.confidence}%</Text>
                </Box>
              </Stack>
            </Box>
          ) : null}

          <Stack direction="horizontal" justify="space-between" gap={2} wrap="wrap">
            <Button variant="outline" onClick={generateReport} disabled={isGenerating} icon={<RefreshCw size={16} />}>
              {isGenerating ? 'Regenerating...' : 'Regenerate Report'}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                toast.info('Download feature coming soon');
              }}
              icon={<Download size={16} />}
            >
              Download Report
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
};
