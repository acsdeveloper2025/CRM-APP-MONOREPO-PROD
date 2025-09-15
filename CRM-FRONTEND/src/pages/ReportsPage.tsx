import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, Download, FileText, BarChart3, TrendingUp, Clock, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { reportsService } from '@/services/reports';
import { BankBillsTable } from '@/components/reports/BankBillsTable';
import { MISReportsTable } from '@/components/reports/MISReportsTable';
import { ReportSummaryCards } from '@/components/reports/ReportSummaryCards';
import { CreateBankBillDialog } from '@/components/reports/CreateBankBillDialog';
import { GenerateReportDialog } from '@/components/reports/GenerateReportDialog';
import { TurnaroundTimeChart } from '@/components/reports/TurnaroundTimeChart';
import { CompletionRateChart } from '@/components/reports/CompletionRateChart';
import { addDays, format as formatDate } from 'date-fns';

export function ReportsPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedClient, setSelectedClient] = useState<string>('all');
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: addDays(new Date(), -30),
    to: new Date(),
  });
  const [showCreateBankBill, setShowCreateBankBill] = useState(false);
  const [showGenerateReport, setShowGenerateReport] = useState(false);

  // Fetch bank bills data
  const { data: bankBillsData, isLoading: bankBillsLoading } = useQuery({
    queryKey: ['bank-bills', searchQuery, selectedStatus, selectedClient, dateRange],
    queryFn: () => reportsService.getBankBills({
      search: searchQuery,
      status: selectedStatus !== 'all' ? selectedStatus : undefined,
      clientId: selectedClient !== 'all' ? selectedClient : undefined,
      dateFrom: dateRange.from ? formatDate(dateRange.from, 'yyyy-MM-dd') : undefined,
      dateTo: dateRange.to ? formatDate(dateRange.to, 'yyyy-MM-dd') : undefined,
    }),
    enabled: activeTab === 'bank-bills',
  });

  // Fetch MIS reports data
  const { data: misReportsData, isLoading: misReportsLoading } = useQuery({
    queryKey: ['mis-reports', searchQuery, dateRange],
    queryFn: () => reportsService.getMISReports({
      search: searchQuery,
      dateFrom: dateRange.from ? formatDate(dateRange.from, 'yyyy-MM-dd') : undefined,
      dateTo: dateRange.to ? formatDate(dateRange.to, 'yyyy-MM-dd') : undefined,
    }),
    enabled: activeTab === 'mis-reports',
  });

  // Fetch report summaries
  const { data: reportSummariesData } = useQuery({
    queryKey: ['report-summaries'],
    queryFn: () => reportsService.getReportSummaries(),
    enabled: activeTab === 'overview',
  });

  // Fetch dashboard data
  const { data: dashboardData } = useQuery({
    queryKey: ['reports-dashboard', dateRange],
    queryFn: () => reportsService.getReportsDashboardData({
      dateFrom: dateRange.from ? formatDate(dateRange.from, 'yyyy-MM-dd') : undefined,
      dateTo: dateRange.to ? formatDate(dateRange.to, 'yyyy-MM-dd') : undefined,
    }),
    enabled: activeTab === 'overview',
  });

  // Fetch turnaround time data
  const { data: turnaroundData } = useQuery({
    queryKey: ['turnaround-time', dateRange],
    queryFn: () => reportsService.getTurnaroundTimeReport({
      dateFrom: dateRange.from ? formatDate(dateRange.from, 'yyyy-MM-dd') : undefined,
      dateTo: dateRange.to ? formatDate(dateRange.to, 'yyyy-MM-dd') : undefined,
    }),
    enabled: activeTab === 'analytics',
  });

  // Fetch completion rate data
  const { data: completionData } = useQuery({
    queryKey: ['completion-rate', dateRange],
    queryFn: () => reportsService.getCompletionRateReport({
      dateFrom: dateRange.from ? formatDate(dateRange.from, 'yyyy-MM-dd') : undefined,
      dateTo: dateRange.to ? formatDate(dateRange.to, 'yyyy-MM-dd') : undefined,
    }),
    enabled: activeTab === 'analytics',
  });

  const handleExportData = async (type: 'bank-bills' | 'mis-reports', format: 'PDF' | 'EXCEL' | 'CSV' = 'EXCEL') => {
    try {
      let blob: Blob;
      let filename: string;

      if (type === 'bank-bills') {
        blob = await reportsService.exportBankBills({
          search: searchQuery,
          status: selectedStatus || undefined,
          clientId: selectedClient || undefined,
          dateFrom: dateRange.from ? formatDate(dateRange.from, 'yyyy-MM-dd') : undefined,
          dateTo: dateRange.to ? formatDate(dateRange.to, 'yyyy-MM-dd') : undefined,
        }, format);
        filename = `bank_bills_${format.toLowerCase()}_${formatDate(new Date(), 'yyyy-MM-dd')}.${format === 'EXCEL' ? 'xlsx' : format.toLowerCase()}`;
      } else {
        blob = await reportsService.exportMISReports({
          search: searchQuery,
          dateFrom: dateRange.from ? formatDate(dateRange.from, 'yyyy-MM-dd') : undefined,
          dateTo: dateRange.to ? formatDate(dateRange.to, 'yyyy-MM-dd') : undefined,
        }, format);
        filename = `mis_reports_${format.toLowerCase()}_${formatDate(new Date(), 'yyyy-MM-dd')}.${format === 'EXCEL' ? 'xlsx' : format.toLowerCase()}`;
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

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedStatus('all');
    setSelectedClient('all');
    setDateRange({
      from: addDays(new Date(), -30),
      to: new Date(),
    });
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

            {/* Filters */}
            {(activeTab === 'bank-bills' || activeTab === 'mis-reports') && (
              <div className="flex items-center space-x-4">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8"
                  />
                </div>
                
                {activeTab === 'bank-bills' && (
                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="PENDING">Pending</SelectItem>
                      <SelectItem value="PARTIALLY_PAID">Partially Paid</SelectItem>
                      <SelectItem value="PAID">Paid</SelectItem>
                      <SelectItem value="OVERDUE">Overdue</SelectItem>
                    </SelectContent>
                  </Select>
                )}

                <DatePickerWithRange
                  date={dateRange}
                  onDateChange={setDateRange}
                />

                {(searchQuery || selectedStatus !== 'all' || selectedClient !== 'all') && (
                  <Button variant="outline" size="sm" onClick={clearFilters}>
                    Clear Filters
                  </Button>
                )}
              </div>
            )}

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
