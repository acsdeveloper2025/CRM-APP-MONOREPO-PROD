import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Download, Receipt, DollarSign, TrendingUp, Calendar, AlertTriangle } from 'lucide-react';
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

export function BillingPage() {
  const [activeTab, setActiveTab] = useState('invoices');
  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Unified search with 800ms debounce
  const {
    searchValue: _searchValue,
    debouncedSearchValue,
    setSearchValue: _setSearchValue,
    clearSearch: _clearSearch,
    isDebouncing: _isDebouncing,
  } = useUnifiedSearch({
    syncWithUrl: true,
  });

  // Reset to page 1 when search changes or tab changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchValue, activeTab]);

  const { data: invoicesData, isLoading: invoicesLoading } = useQuery({
    queryKey: ['invoices', debouncedSearchValue, currentPage, pageSize],
    queryFn: () => billingService.getInvoices({
      search: debouncedSearchValue || undefined,
      page: currentPage,
      limit: pageSize,
    }),
    enabled: activeTab === 'invoices',
  });

  const { data: commissionsData, isLoading: commissionsLoading } = useQuery({
    queryKey: ['commissions', debouncedSearchValue, currentPage, pageSize],
    queryFn: () => billingService.getCommissions({
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

  const handleDownloadReport = async () => {
    try {
      let blob: Blob;
      let filename: string;

      if (activeTab === 'invoices') {
        blob = await billingService.downloadInvoiceReport({});
        filename = `invoices_report_${new Date().toISOString().split('T')[0]}.pdf`;
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

  const getTabStats = () => {
    const invoices = invoicesData?.data || [];
    const commissions = commissionsData?.data || [];
    
    return {
      invoices: {
        total: invoices.length,
        totalAmount: invoices.reduce((sum, inv) => sum + inv.totalAmount, 0),
        draft: invoices.filter(inv => inv.status === 'DRAFT').length,
        draftAmount: invoices
          .filter(inv => inv.status === 'DRAFT')
          .reduce((sum, inv) => sum + inv.totalAmount, 0),
        overdue: invoices.filter(inv => inv.status === 'OVERDUE').length,
      },
      commissions: {
        total: commissions.length,
        totalAmount: commissions.reduce((sum, comm) => sum + comm.amount, 0),
        pending: commissions.filter(comm => comm.status === 'PENDING').length,
        paid: commissions.filter(comm => comm.status === 'PAID').length,
      }
    };
  };

  const stats = getTabStats();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Billing & Commission</h1>
          <p className="text-gray-600">
            Manage invoices, track payments, and monitor commission payouts
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
            <Receipt className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.invoices.total}</div>
            <p className="text-xs text-gray-600">
              ₹{stats.invoices.totalAmount.toLocaleString()}
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
            <p className="text-xs text-gray-600">
              {stats.invoices.overdue} overdue
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Commissions</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.commissions.total}</div>
            <p className="text-xs text-gray-600">
              ₹{stats.commissions.totalAmount.toLocaleString()}
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
            <p className="text-xs text-gray-600">
              {stats.commissions.paid} paid
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue Amount</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              ₹{(stats.invoices.draftAmount || 0).toLocaleString()}
            </div>
            <p className="text-xs text-gray-600">
              Draft invoice value
            </p>
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
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadReport}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Report
                </Button>
                
                {activeTab === 'invoices' && (
                  <Button
                    size="sm"
                    onClick={() => setShowCreateInvoice(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Invoice
                  </Button>
                )}
              </div>
            </div>



            <TabsContent value="invoices" className="space-y-4">
              <InvoicesTable
                data={invoicesData?.data || []}
                isLoading={invoicesLoading}
              />
              {invoicesData?.pagination && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
                  <div className="text-sm text-gray-600">
                    Showing {invoicesData.data?.length || 0} of {invoicesData.pagination.total} invoices
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
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
                      onClick={() => setCurrentPage(prev => prev + 1)}
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
              <CommissionsTable
                data={commissionsData?.data || []}
                isLoading={commissionsLoading}
              />
              {commissionsData?.pagination && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
                  <div className="text-sm text-gray-600">
                    Showing {commissionsData.data?.length || 0} of {commissionsData.pagination.total} commissions
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
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
                      onClick={() => setCurrentPage(prev => prev + 1)}
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
      <CreateInvoiceDialog
        open={showCreateInvoice}
        onOpenChange={setShowCreateInvoice}
      />
    </div>
  );
}
