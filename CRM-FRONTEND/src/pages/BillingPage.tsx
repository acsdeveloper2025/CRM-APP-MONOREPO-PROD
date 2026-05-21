import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Plus,
  Download,
  Receipt,
  DollarSign,
  TrendingUp,
  Calendar,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { billingService } from '@/services/billing';
import { InvoicesTable } from '@/components/billing/InvoicesTable';
import { CommissionsTable } from '@/components/billing/CommissionsTable';
import { CreateInvoiceDialog } from '@/components/billing/CreateInvoiceDialog';
import { CommissionSummaryCard } from '@/components/billing/CommissionSummaryCard';
import { useUnifiedSearch } from '@/hooks/useUnifiedSearch';
import { logger } from '@/utils/logger';

// URL segment under /billing-and-commission/ ↔ tab value
const URL_TO_TAB: Record<string, string> = {
  invoices: 'invoices',
  commissions: 'commissions',
  'commission-management': 'commission-management',
};

export function BillingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const seg = location.pathname.split('/').pop() || '';
  const initialTab = URL_TO_TAB[seg] || 'invoices';

  const [activeTab, setActiveTab] = useState(initialTab);
  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Sync activeTab when the URL changes (sidebar navigation)
  useEffect(() => {
    const newTab = URL_TO_TAB[seg];
    if (newTab && newTab !== activeTab) {
      setActiveTab(newTab);
    }
  }, [seg, activeTab]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    navigate(`/billing-and-commission/${value}`);
  };

  // Unified search with 800ms debounce
  const { debouncedSearchValue } = useUnifiedSearch({
    syncWithUrl: true,
  });

  // Reset to page 1 when search changes or tab changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchValue, activeTab]);

  const { data: invoicesData, isLoading: invoicesLoading } = useQuery({
    queryKey: ['invoices', debouncedSearchValue, currentPage, pageSize],
    queryFn: () =>
      billingService.getInvoices({
        search: debouncedSearchValue || undefined,
        page: currentPage,
        limit: pageSize,
      }),
    enabled: activeTab === 'invoices',
  });

  const { data: commissionsData, isLoading: commissionsLoading } = useQuery({
    queryKey: ['commissions', debouncedSearchValue, currentPage, pageSize],
    queryFn: () =>
      billingService.getCommissions({
        search: debouncedSearchValue || undefined,
        page: currentPage,
        limit: pageSize,
      }),
    enabled: activeTab === 'commissions',
  });

  const { data: commissionSummaryData } = useQuery({
    queryKey: ['commission-summary'],
    queryFn: () => billingService.getCommissionSummary(undefined, undefined),
    enabled: activeTab === 'commissions',
  });

  // DB-wide aggregates (page-independent) drive the 5 header stat cards.
  // Without these, the cards previously summed only the current paginated
  // page (max 20 rows) and silently mis-reported totals as the user
  // navigated pages.
  const { data: invoiceStatsData } = useQuery({
    queryKey: ['invoice-stats'],
    queryFn: () => billingService.getInvoiceStats(),
  });

  const { data: commissionStatsData } = useQuery({
    queryKey: ['commission-summary', 'stats'],
    queryFn: () => billingService.getCommissionSummary(undefined, undefined),
  });

  const handleDownloadReport = async () => {
    try {
      let blob: Blob;
      let filename: string;

      if (activeTab === 'invoices') {
        blob = await billingService.exportInvoicesToExcel({});
        filename = `invoices_${new Date().toISOString().split('T')[0]}.xlsx`;
      } else {
        blob = await billingService.downloadCommissionReport({});
        filename = `commissions_report_${new Date().toISOString().split('T')[0]}.pdf`;
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      logger.error('Failed to download report:', error);
    }
  };

  // Header stat cards read from DB-wide aggregate endpoints, NOT the
  // paginated invoicesData / commissionsData. Falls back to zero while
  // the queries load.
  const invoiceStats = invoiceStatsData?.data;
  const commissionStats = commissionStatsData?.data;
  const stats = {
    invoices: {
      total: invoiceStats?.totalInvoices ?? 0,
      totalAmount: invoiceStats?.totalAmount ?? 0,
      draft: invoiceStats?.statusDistribution?.DRAFT ?? 0,
      // pendingAmount = outstandingAmount on BE (SENT + unpaid).
      outstandingAmount: invoiceStats?.pendingAmount ?? 0,
      overdue: invoiceStats?.overdueInvoices ?? 0,
    },
    commissions: {
      total: commissionStats?.totalCommissions ?? 0,
      totalAmount: commissionStats?.totalAmount ?? 0,
      pending: commissionStats?.pendingCommissions ?? 0,
      paid: commissionStats?.paidCommissions ?? 0,
    },
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            {(
              {
                invoices: 'Invoices',
                commissions: 'Commissions',
                'commission-management': 'Commission Management',
              } as Record<string, string>
            )[activeTab] || 'Billing & Commission'}
          </h1>
          <p className="text-muted-foreground">
            Manage invoices, track payments, and monitor commission payouts
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.invoices.total}</div>
            <p className="text-xs text-muted-foreground">
              ₹{Number(stats.invoices.totalAmount || 0).toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Draft Invoices</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.invoices.draft}</div>
            <p className="text-xs text-muted-foreground">{stats.invoices.overdue} overdue</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Commissions</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.commissions.total}</div>
            <p className="text-xs text-muted-foreground">
              ₹{Number(stats.commissions.totalAmount || 0).toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Commissions</CardTitle>
            <Calendar className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.commissions.pending}</div>
            <p className="text-xs text-muted-foreground">{stats.commissions.paid} paid</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding Amount</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              ₹{(stats.invoices.outstandingAmount || 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Sent &amp; unpaid</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Financial Management</CardTitle>
              <CardDescription>
                Track invoices, payments, and commission distributions
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
            <div className="flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="invoices">
                  Invoices
                  {stats.invoices.total > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {stats.invoices.total}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="commissions">
                  Commissions
                  {stats.commissions.total > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {stats.commissions.total}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              {/* Actions */}
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm" onClick={handleDownloadReport}>
                  <Download className="h-4 w-4 mr-2" />
                  Download Report
                </Button>

                {activeTab === 'invoices' && (
                  <Button size="sm" onClick={() => setShowCreateInvoice(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Invoice
                  </Button>
                )}
              </div>
            </div>

            <TabsContent value="invoices" className="space-y-4">
              <InvoicesTable data={invoicesData?.data || []} isLoading={invoicesLoading} />
              {invoicesData?.pagination && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
                  <div className="text-sm text-muted-foreground">
                    Showing {invoicesData.data?.length || 0} of {invoicesData.pagination.total}{' '}
                    invoices
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <div className="text-sm">
                      Page {currentPage} of {invoicesData.pagination.totalPages || 1}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((prev) => prev + 1)}
                      disabled={currentPage >= (invoicesData.pagination.totalPages || 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="commissions" className="space-y-4">
              {commissionSummaryData?.data && (
                <CommissionSummaryCard summary={commissionSummaryData.data} />
              )}
              <CommissionsTable data={commissionsData?.data || []} isLoading={commissionsLoading} />
              {commissionsData?.pagination && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
                  <div className="text-sm text-muted-foreground">
                    Showing {commissionsData.data?.length || 0} of{' '}
                    {commissionsData.pagination.total} commissions
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <div className="text-sm">
                      Page {currentPage} of {commissionsData.pagination.totalPages || 1}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((prev) => prev + 1)}
                      disabled={currentPage >= (commissionsData.pagination.totalPages || 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <CreateInvoiceDialog open={showCreateInvoice} onOpenChange={setShowCreateInvoice} />
    </div>
  );
}
