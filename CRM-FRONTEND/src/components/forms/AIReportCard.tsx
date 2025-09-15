import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Brain, 
  FileText, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Download,
  RefreshCw,
  TrendingUp,
  Shield,
  Target
} from 'lucide-react';
import { toast } from 'sonner';
import { aiReportsService } from '@/services/aiReports';

interface AIReport {
  id: string;
  executiveSummary: string;
  keyFindings: string[];
  verificationDetails: string;
  riskAssessment: string;
  recommendations: string[];
  conclusion: string;
  confidence: number;
  templateReport?: string; // Template-based report for residence verification
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

export const AIReportCard: React.FC<AIReportCardProps> = ({
  caseId,
  submissionId,
  className = ''
}) => {
  const [report, setReport] = useState<AIReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load existing report on component mount
  useEffect(() => {
    loadExistingReport();
  }, [caseId, submissionId]);

  const loadExistingReport = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await aiReportsService.getFormSubmissionReport(caseId, submissionId);
      if (response.success && response.data) {
        setReport(response.data.report);
      }
    } catch (err: any) {
      // Don't show error for 404 (no report exists yet)
      if (err.response?.status !== 404) {
        setError('Failed to load AI report');
        console.error('Error loading AI report:', err);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const generateReport = async () => {
    try {
      setIsGenerating(true);
      setError(null);
      
      toast.info('Generating AI report...', {
        description: 'This may take a few moments'
      });

      const response = await aiReportsService.generateFormSubmissionReport(caseId, submissionId);
      
      if (response.success && response.data) {
        setReport(response.data.report);
        toast.success('AI report generated successfully');
      } else {
        throw new Error(response.message || 'Failed to generate report');
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to generate AI report';
      setError(errorMessage);
      toast.error('Failed to generate AI report', {
        description: errorMessage
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const getRiskBadgeColor = (level: string) => {
    switch (level) {
      case 'LOW': return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-800';
      case 'HIGH': return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 85) return 'text-green-600 dark:text-green-400';
    if (confidence >= 70) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  if (isLoading) {
    return (
      <Card className={`border-l-4 border-l-blue-500 ${className}`}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center space-x-2">
            <RefreshCw className="h-5 w-5 animate-spin text-blue-600" />
            <span className="text-sm text-muted-foreground">Loading AI report...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!report) {
    return (
      <Card className={`border-l-4 border-l-purple-500 ${className}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Brain className="h-5 w-5 text-purple-600" />
              <CardTitle className="text-lg">AI Verification Report</CardTitle>
            </div>
            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
              Powered by Gemini AI
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-center py-6">
            <Brain className="h-12 w-12 text-purple-400 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              Generate AI-Powered Report
            </h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
              Get comprehensive insights and analysis of this verification using advanced AI technology.
            </p>
            <Button 
              onClick={generateReport}
              disabled={isGenerating}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Generating Report...
                </>
              ) : (
                <>
                  <Brain className="h-4 w-4 mr-2" />
                  Generate AI Report
                </>
              )}
            </Button>
            {error && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`border-l-4 border-l-purple-500 ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Brain className="h-5 w-5 text-purple-600" />
            <CardTitle className="text-lg">AI Verification Report</CardTitle>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
              Powered by Gemini AI
            </Badge>
            <Badge 
              variant="outline" 
              className={`${getConfidenceColor(report.confidence)} border-current`}
            >
              {report.confidence}% Confidence
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Executive Summary */}
        <div>
          <div className="flex items-center space-x-2 mb-2">
            <FileText className="h-4 w-4 text-blue-600" />
            <h3 className="font-semibold text-foreground">Executive Summary</h3>
          </div>
          <p className="text-sm text-foreground leading-relaxed">
            {report.executiveSummary}
          </p>
        </div>

        <Separator />

        {/* Risk Assessment */}
        {report.templateInsights?.riskAssessment && (
          <div>
            <div className="flex items-center space-x-2 mb-3">
              <Shield className="h-4 w-4 text-orange-600" />
              <h3 className="font-semibold text-foreground">Risk Assessment</h3>
              <Badge className={getRiskBadgeColor(report.templateInsights.riskAssessment.level)}>
                {report.templateInsights.riskAssessment.level} RISK
              </Badge>
            </div>
            <p className="text-sm text-foreground mb-3">
              {report.riskAssessment}
            </p>
            {report.templateInsights.riskAssessment.factors.length > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-md p-3">
                <h4 className="text-sm font-medium text-orange-800 mb-2">Risk Factors:</h4>
                <ul className="text-sm text-orange-700 space-y-1">
                  {report.templateInsights.riskAssessment.factors.map((factor, index) => (
                    <li key={index} className="flex items-start space-x-2">
                      <span className="text-orange-500 mt-1">•</span>
                      <span>{factor}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <Separator />

        {/* Key Findings */}
        <div>
          <div className="flex items-center space-x-2 mb-3">
            <Target className="h-4 w-4 text-green-600" />
            <h3 className="font-semibold text-foreground">Key Findings</h3>
          </div>
          <ul className="space-y-2">
            {report.keyFindings.map((finding, index) => (
              <li key={index} className="flex items-start space-x-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-foreground">{finding}</span>
              </li>
            ))}
          </ul>
        </div>

        <Separator />

        {/* Recommendations */}
        <div>
          <div className="flex items-center space-x-2 mb-3">
            <TrendingUp className="h-4 w-4 text-blue-600" />
            <h3 className="font-semibold text-foreground">Recommendations</h3>
          </div>
          <ul className="space-y-2">
            {report.recommendations.map((recommendation, index) => (
              <li key={index} className="flex items-start space-x-2 text-sm">
                <span className="text-blue-500 mt-1 flex-shrink-0">•</span>
                <span className="text-foreground">{recommendation}</span>
              </li>
            ))}
          </ul>
        </div>

        <Separator />

        {/* Conclusion */}
        <div>
          <h3 className="font-semibold text-foreground mb-2">Conclusion</h3>
          <p className="text-sm text-foreground leading-relaxed">
            {report.conclusion}
          </p>
        </div>

        {/* Template Report for Residence Verification */}
        {report.templateReport && (
          <>
            <Separator />
            <div>
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-4 w-4 text-blue-600" />
                <h3 className="font-semibold text-foreground">Residence Verification Report</h3>
                <Badge variant="outline" className="text-xs">Template-Based</Badge>
              </div>
              <div className="bg-muted rounded-lg p-4">
                <pre className="text-sm text-foreground whitespace-pre-wrap font-mono leading-relaxed">
                  {report.templateReport}
                </pre>
              </div>
            </div>
          </>
        )}

        {/* Metadata */}
        {report.metadata && (
          <div className="bg-muted border border-border rounded-md p-3">
            <div className="flex items-center space-x-2 mb-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Report Details</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div>Generated: {new Date(report.metadata.generatedAt).toLocaleString()}</div>
              <div>Type: {report.metadata.verificationType}</div>
              <div>Outcome: {report.metadata.outcome}</div>
              <div>Confidence: {report.confidence}%</div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={generateReport}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Regenerate Report
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              // TODO: Implement download functionality
              toast.info('Download feature coming soon');
            }}
          >
            <Download className="h-4 w-4 mr-2" />
            Download Report
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
