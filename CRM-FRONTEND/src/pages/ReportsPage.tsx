import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Download, BarChart3, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { reportsService } from '@/services/reports';
import { MISReportsTable } from '@/components/reports/MISReportsTable';
import { ReportSummaryCards } from '@/components/reports/ReportSummaryCards';
import { GenerateReportDialog } from '@/components/reports/GenerateReportDialog';
import { TurnaroundTimeChart } from '@/components/reports/TurnaroundTimeChart';
import { CompletionRateChart } from '@/components/reports/CompletionRateChart';
import { MISDashboard } from '@/components/reports/MISDashboard';
import { logger } from '@/utils/logger';

export function ReportsPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [showGenerateReport, setShowGenerateReport] = useState(false);
  const [misReportsPage, setMisReportsPage] = useState(1);
  const pageSize = 20;

  // Reset to page 1 when search or tab changes
  React.useEffect(() => {
    setMisReportsPage(1);
  }, [activeTab]);

  const { data: misReportsData, isLoading: misReportsLoading } = useQuery({
    queryKey: ['mis-reports', misReportsPage, pageSize],
    queryFn: () => reportsService.getMISReports({
      page: misReportsPage,
      limit: pageSize,
    }),
    enabled: activeTab === 'mis-reports',
  });

  const { data: reportSummariesData } = useQuery({
    queryKey: ['report-summaries'],
    queryFn: () => reportsService.getReportSummaries(),
    enabled: activeTab === 'overview',
  });

  const { data: dashboardData } = useQuery({
    queryKey: ['reports-dashboard'],
    queryFn: () => reportsService.getReportsDashboardData({}),
    enabled: activeTab === 'overview',
  });

  const { data: turnaroundData } = useQuery({
    queryKey: ['turnaround-time'],
    queryFn: () => reportsService.getTurnaroundTimeReport({}),
    enabled: activeTab === 'analytics',
  });

  const { data: completionData } = useQuery({
    queryKey: ['completion-rate'],
    queryFn: () => reportsService.getCompletionRateReport({}),
    enabled: activeTab === 'analytics',
  });

  const handleExportData = async (format: 'PDF' | 'EXCEL' | 'CSV' = 'EXCEL') => {
    try {
      const blob = await reportsService.exportMISReports({}, format);
      const filename = `mis_reports_${format.toLowerCase()}_${new Date().toISOString().split('T')[0]}.${format === 'EXCEL' ? 'xlsx' : format.toLowerCase()}`;

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      logger.error('Failed to export data:', error);
    }
  };

  const stats = useMemo(() => {
    const misReports = misReportsData?.data || [];
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    return {
      misReports: {
        total: misReports.length,
        recent: misReports.filter(report => new Date(report.generatedAt) >= weekAgo).length,
      },
    };
  }, [misReportsData]);

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">MIS Reports</h1>
          <p className="text-gray-600">
            Generate MIS reports and analyze operational performance metrics
          </p>
        </div>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Reports & Analytics</CardTitle>
              <CardDescription>
                Comprehensive reporting dashboard for financial and operational insights
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <div className="flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="overview">
                  Overview
                </TabsTrigger>
                <TabsTrigger value="mis-reports">
                  MIS Reports
                  {stats.misReports.total > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {stats.misReports.total}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="mis-dashboard">
                  MIS Dashboard
                </TabsTrigger>
                <TabsTrigger value="analytics">
                  Analytics
                </TabsTrigger>
              </TabsList>

              {/* Actions */}
              <div className="flex items-center space-x-2">
                {activeTab === 'mis-reports' && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExportData('EXCEL')}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setShowGenerateReport(true)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Generate Report
                    </Button>
                  </>
                )}
              </div>
            </div>



            <TabsContent value="overview" className="space-y-4">
              <ReportSummaryCards summaries={reportSummariesData?.data || []} />
              
              {/* Quick Stats */}
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Generated Reports</CardTitle>
                    <BarChart3 className="h-4 w-4 text-gray-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{dashboardData?.data?.totalReports || 0}</div>
                    <p className="text-xs text-gray-600">
                      {dashboardData?.data?.recentReports || 0} this week
                    </p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">MIS Reports</CardTitle>
                    <TrendingUp className="h-4 w-4 text-blue-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">
                      {stats.misReports.total}
                    </div>
                    <p className="text-xs text-gray-600">
                      {stats.misReports.recent} generated in the last 7 days
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Avg Turnaround</CardTitle>
                    <TrendingUp className="h-4 w-4 text-gray-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {dashboardData?.data?.averageTurnaround || 0}h
                    </div>
                    <p className="text-xs text-gray-600">
                      Target: 24h
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
                    <BarChart3 className="h-4 w-4 text-gray-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {completionData?.data?.completionRate || 0}%
                    </div>
                    <p className="text-xs text-gray-600">
                      {completionData?.data?.completedCases || 0} completed cases
                    </p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="mis-reports" className="space-y-4">
              <MISReportsTable
                data={misReportsData?.data || []}
                isLoading={misReportsLoading}
              />
              {misReportsData?.pagination && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
                  <div className="text-sm text-gray-600">
                    Showing {misReportsData.data?.length || 0} of {misReportsData.pagination.total} MIS reports
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setMisReportsPage(prev => Math.max(1, prev - 1))}
                      disabled={misReportsPage === 1}
                    >
                      Previous
                    </Button>
                    <div className="text-sm">
                      Page {misReportsPage} of {misReportsData.pagination.totalPages || 1}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setMisReportsPage(prev => prev + 1)}
                      disabled={misReportsPage >= (misReportsData.pagination.totalPages || 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="mis-dashboard" className="space-y-4">
              <MISDashboard />
            </TabsContent>

            <TabsContent value="analytics" className="space-y-4">
              <div className="grid gap-6 md:grid-cols-2">
                <TurnaroundTimeChart data={turnaroundData?.data} />
                <CompletionRateChart data={completionData?.data} />
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <GenerateReportDialog
        open={showGenerateReport}
        onOpenChange={setShowGenerateReport}
      />
    </div>
  );
}
