import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Download, Receipt, DollarSign, TrendingUp, Calendar, AlertTriangle } from 'lucide-react';
import { Button } from '@/ui/components/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/components/Card';
import { Badge } from '@/ui/components/Badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/components/Tabs';
import { billingService } from '@/services/billing';
import { InvoicesTable } from '@/components/billing/InvoicesTable';
import { CommissionsTable } from '@/components/billing/CommissionsTable';
import { CreateInvoiceDialog } from '@/components/billing/CreateInvoiceDialog';
import { CommissionSummaryCard } from '@/components/billing/CommissionSummaryCard';
import { useUnifiedSearch } from '@/hooks/useUnifiedSearch';
import { MetricCardGrid } from '@/components/shared/MetricCardGrid';
import { PaginationStatusCard } from '@/components/shared/PaginationStatusCard';
import { Page } from '@/ui/layout/Page';
import { Section } from '@/ui/layout/Section';
import { Stack } from '@/ui/primitives/Stack';

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
      console.error('Failed to download report:', error);
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
    <Page
      title="Billing & Commission"
      subtitle="Manage invoices, payouts, and financial reporting from one workspace."
      shell
      actions={
        <Stack direction="horizontal" gap={2} wrap="wrap">
          <Button variant="secondary" onClick={handleDownloadReport}>
            <Download className="mr-2 h-4 w-4" />
            Download report
          </Button>
          {activeTab === 'invoices' ? (
            <Button onClick={() => setShowCreateInvoice(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create invoice
            </Button>
          ) : null}
        </Stack>
      }
    >
      <Section>
        <MetricCardGrid
          items={[
            { title: 'Total Invoices', value: stats.invoices.total, detail: `₹${stats.invoices.totalAmount.toLocaleString()}`, icon: Receipt, tone: 'accent' },
            { title: 'Draft Invoices', value: stats.invoices.draft, detail: `${stats.invoices.overdue} overdue`, icon: DollarSign, tone: 'warning' },
            { title: 'Total Commissions', value: stats.commissions.total, detail: `₹${stats.commissions.totalAmount.toLocaleString()}`, icon: TrendingUp, tone: 'neutral' },
            { title: 'Pending Commissions', value: stats.commissions.pending, detail: `${stats.commissions.paid} paid`, icon: Calendar, tone: 'positive' },
            { title: 'Overdue Amount', value: `₹${(stats.invoices.draftAmount || 0).toLocaleString()}`, detail: 'Draft invoice value', icon: AlertTriangle, tone: 'danger' },
          ]}
        />
      </Section>

      <Section>
      <Card>
        <CardHeader>
          <div {...{ className: "flex items-center justify-between" }}>
            <div>
              <CardTitle>Financial Management</CardTitle>
              <CardDescription>
                Track invoices, payments, and commission distributions
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} {...{ className: "space-y-4" }}>
            <div {...{ className: "flex items-center justify-between" }}>
              <TabsList>
                <TabsTrigger value="invoices">
                  Invoices
                  {stats.invoices.total > 0 && (
                    <Badge variant="secondary" {...{ className: "ml-2" }}>
                      {stats.invoices.total}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="commissions">
                  Commissions
                  {stats.commissions.total > 0 && (
                    <Badge variant="secondary" {...{ className: "ml-2" }}>
                      {stats.commissions.total}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              <Badge variant="neutral">{activeTab}</Badge>
            </div>



            <TabsContent value="invoices" {...{ className: "space-y-4" }}>
              <InvoicesTable
                data={invoicesData?.data || []}
                isLoading={invoicesLoading}
              />
              {invoicesData?.pagination ? (
                <PaginationStatusCard
                  page={currentPage}
                  limit={pageSize}
                  total={invoicesData.pagination.total}
                  totalPages={invoicesData.pagination.totalPages || 1}
                  onPrevious={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  onNext={() => setCurrentPage(prev => prev + 1)}
                />
              ) : null}
            </TabsContent>

            <TabsContent value="commissions" {...{ className: "space-y-4" }}>
              {commissionSummaryData?.data && (
                <CommissionSummaryCard summary={commissionSummaryData.data} />
              )}
              <CommissionsTable
                data={commissionsData?.data || []}
                isLoading={commissionsLoading}
              />
              {commissionsData?.pagination ? (
                <PaginationStatusCard
                  page={currentPage}
                  limit={pageSize}
                  total={commissionsData.pagination.total}
                  totalPages={commissionsData.pagination.totalPages || 1}
                  onPrevious={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  onNext={() => setCurrentPage(prev => prev + 1)}
                />
              ) : null}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      </Section>

      {/* Dialogs */}
      <CreateInvoiceDialog
        open={showCreateInvoice}
        onOpenChange={setShowCreateInvoice}
      />
    </Page>
  );
}
