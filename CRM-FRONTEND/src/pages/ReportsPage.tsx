import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Download, FileText, BarChart3, TrendingUp, Clock, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { reportsService } from '@/services/reports';
import { BankBillsTable } from '@/components/reports/BankBillsTable';
import { MISReportsTable } from '@/components/reports/MISReportsTable';
import { ReportSummaryCards } from '@/components/reports/ReportSummaryCards';
import { CreateBankBillDialog } from '@/components/reports/CreateBankBillDialog';
import { GenerateReportDialog } from '@/components/reports/GenerateReportDialog';
import { TurnaroundTimeChart } from '@/components/reports/TurnaroundTimeChart';
import { CompletionRateChart } from '@/components/reports/CompletionRateChart';

export function ReportsPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [showCreateBankBill, setShowCreateBankBill] = useState(false);
  const [showGenerateReport, setShowGenerateReport] = useState(false);

  const { data: bankBillsData, isLoading: bankBillsLoading } = useQuery({
    queryKey: ['bank-bills'],
    queryFn: () => reportsService.getBankBills({}),
    enabled: activeTab === 'bank-bills',
  });

  const { data: misReportsData, isLoading: misReportsLoading } = useQuery({
    queryKey: ['mis-reports'],
    queryFn: () => reportsService.getMISReports({}),
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

  const handleExportData = async (type: 'bank-bills' | 'mis-reports', format: 'PDF' | 'EXCEL' | 'CSV' = 'EXCEL') => {
    try {
      let blob: Blob;
      let filename: string;

      if (type === 'bank-bills') {
        blob = await reportsService.exportBankBills({}, format);
        filename = `bank_bills_${format.toLowerCase()}_${new Date().toISOString().split('T')[0]}.${format === 'EXCEL' ? 'xlsx' : format.toLowerCase()}`;
      } else {
        blob = await reportsService.exportMISReports({}, format);
        filename = `mis_reports_${format.toLowerCase()}_${new Date().toISOString().split('T')[0]}.${format === 'EXCEL' ? 'xlsx' : format.toLowerCase()}`;
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export data:', error);
    }
  };

  const getTabStats = () => {
    const bankBills = bankBillsData?.data || [];
    const misReports = misReportsData?.data || [];
    
    return {
      bankBills: {
        total: bankBills.length,
        totalAmount: bankBills.reduce((sum, bill) => sum + bill.totalAmount, 0),
        pending: bankBills.filter(bill => bill.status === 'PENDING').length,
        overdue: bankBills.filter(bill => bill.status === 'OVERDUE').length,
      },
      misReports: {
        total: misReports.length,
        recent: misReports.filter(report => {
          const reportDate = new Date(report.generatedAt);
          const weekAgo = addDays(new Date(), -7);
          return reportDate >= weekAgo;
        }).length,
      }
    };
  };

  const stats = getTabStats();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bank Bills & MIS Reports</h1>
          <p className="text-muted-foreground">
            Manage bank bills, generate MIS reports, and analyze performance metrics
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
                <TabsTrigger value="bank-bills">
                  Bank Bills
                  {stats.bankBills.total > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {stats.bankBills.total}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="mis-reports">
                  MIS Reports
                  {stats.misReports.total > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {stats.misReports.total}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="analytics">
                  Analytics
                </TabsTrigger>
              </TabsList>

              {/* Actions */}
              <div className="flex items-center space-x-2">
                {activeTab === 'bank-bills' && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExportData('bank-bills', 'EXCEL')}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setShowCreateBankBill(true)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create Bank Bill
                    </Button>
                  </>
                )}
                
                {activeTab === 'mis-reports' && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExportData('mis-reports', 'EXCEL')}
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
                    <CardTitle className="text-sm font-medium">Total Bank Bills</CardTitle>
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{dashboardData?.data?.totalBankBills || 0}</div>
                    <p className="text-xs text-muted-foreground">
                      ₹{(dashboardData?.data?.totalBillAmount || 0).toLocaleString()} total value
                    </p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Pending Bills</CardTitle>
                    <Clock className="h-4 w-4 text-orange-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-orange-600">
                      {dashboardData?.data?.pendingBills || 0}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Awaiting payment
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Generated Reports</CardTitle>
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{dashboardData?.data?.totalReports || 0}</div>
                    <p className="text-xs text-muted-foreground">
                      {dashboardData?.data?.recentReports || 0} this week
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Avg Turnaround</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {dashboardData?.data?.averageTurnaround || 0}h
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Target: 24h
                    </p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="bank-bills" className="space-y-4">
              <BankBillsTable
                data={bankBillsData?.data || []}
                isLoading={bankBillsLoading}
              />
            </TabsContent>

            <TabsContent value="mis-reports" className="space-y-4">
              <MISReportsTable
                data={misReportsData?.data || []}
                isLoading={misReportsLoading}
              />
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
      <CreateBankBillDialog
        open={showCreateBankBill}
        onOpenChange={setShowCreateBankBill}
      />
      
      <GenerateReportDialog
        open={showGenerateReport}
        onOpenChange={setShowGenerateReport}
      />
    </div>
  );
}
