import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStandardizedQuery } from '@/hooks/useStandardizedQuery';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { rateManagementService } from '@/services/rateManagement';
import { RateTypesTab } from '@/components/rate-management/RateTypesTab';
import { ServiceZoneRulesTab } from '@/components/rate-management/ServiceZoneRulesTab';
import { RateTypeAssignmentTab } from '@/components/rate-management/RateTypeAssignmentTab';
import { RateAssignmentTab } from '@/components/rate-management/RateAssignmentTab';
import { RateViewReportTab } from '@/components/rate-management/RateViewReportTab';
import { DocumentTypeRatesTab } from '@/components/rate-management/DocumentTypeRatesTab';

interface RateManagementPageProps {
  /** Pre-select a tab when navigating from a sidebar sub-page. */
  defaultTab?: string;
}

// Tab value → URL segment under /rate-management.
const TAB_TO_SEGMENT: Record<string, string> = {
  'rate-types': 'rate-types',
  'service-zone-rules': 'service-zone-rules',
  'rate-type-assignment': 'rate-type-assignment',
  'rate-assignment': 'rate-amounts',
  'rate-view-report': 'rate-report',
  'document-type-rates': 'kyc-rates',
};

export function RateManagementPage({ defaultTab }: RateManagementPageProps = {}) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(defaultTab || 'rate-types');

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    const segment = TAB_TO_SEGMENT[value];
    if (segment) {
      navigate(`/rate-management/${segment}`);
    }
  };

  // Sync activeTab when navigating between sidebar sub-pages.
  // useState only sets the initial value on mount — when React
  // reuses the same component instance for a different route,
  // the prop changes but state doesn't. This effect keeps them
  // in sync.
  useEffect(() => {
    if (defaultTab && defaultTab !== activeTab) {
      setActiveTab(defaultTab);
    }
  }, [defaultTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch rate management statistics
  const { data: statsData, isLoading: _statsLoading } = useStandardizedQuery({
    queryKey: ['rate-management-stats'],
    queryFn: () => rateManagementService.getRateManagementStats(),
    errorContext: 'Loading Rate Management Statistics',
    errorFallbackMessage: 'Failed to load rate management statistics',
  });

  const stats = statsData?.data || {
    rateTypes: { total: 0, active: 0, inactive: 0 },
    rates: { total: 0, active: 0, inactive: 0, averageAmount: 0 },
    documentTypeRates: {
      totalRates: 0,
      totalClients: 0,
      totalProducts: 0,
      totalDocumentTypes: 0,
      averageRate: 0,
      minRate: 0,
      maxRate: 0,
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
                'rate-types': 'Rate Types',
                'service-zone-rules': 'Service Zone Rules',
                'rate-type-assignment': 'Rate Type Assignment',
                'rate-assignment': 'Rate Amounts',
                'rate-view-report': 'Rate Report',
                'document-type-rates': 'KYC Rates',
              } as Record<string, string>
            )[activeTab] || 'Rate Management'}
          </h1>
          <p className="text-gray-600">
            Manage rate types, assignments, and pricing for verification services
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rate Types</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.rateTypes.total}</div>
            <div className="flex flex-col sm:flex-row gap-2 mt-2">
              <Badge variant="secondary" className="text-xs">
                {stats.rateTypes.active} Active
              </Badge>
              {stats.rateTypes.inactive > 0 && (
                <Badge variant="outline" className="text-xs">
                  {stats.rateTypes.inactive} Inactive
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Verification Rates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.rates.total}</div>
            <div className="flex flex-col sm:flex-row gap-2 mt-2">
              <Badge variant="secondary" className="text-xs">
                {stats.rates.active} Active
              </Badge>
              {stats.rates.inactive > 0 && (
                <Badge variant="outline" className="text-xs">
                  {stats.rates.inactive} Inactive
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Document Rates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.documentTypeRates?.totalRates || 0}</div>
            <p className="text-xs text-gray-600 mt-2">
              {stats.documentTypeRates?.totalDocumentTypes || 0} document types
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹{Number(stats.rates.averageAmount || 0).toFixed(0)}
            </div>
            <p className="text-xs text-gray-600 mt-2">Verification services</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span className="text-sm font-medium">Operational</span>
            </div>
            <p className="text-xs text-gray-600 mt-2">All systems running</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Rate Management System</CardTitle>
          <CardDescription>
            Configure rate type rules, assign rate types, set rates, and view comprehensive reports
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            {/* Phase 6 (Rate Mgmt refactor 2026-05-10): tab order matches
                dependency chain — Master → Eligibility → Pricing → Geography
                → KYC → Reports. Operator onboarding follows top-to-bottom. */}
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="rate-types" className="text-sm">
                Rate Types
              </TabsTrigger>
              <TabsTrigger value="rate-type-assignment" className="text-sm">
                Rate Type Assignment
              </TabsTrigger>
              <TabsTrigger value="rate-assignment" className="text-sm">
                Rate Amounts
              </TabsTrigger>
              <TabsTrigger value="service-zone-rules" className="text-sm">
                Service Zone Rules
              </TabsTrigger>
              <TabsTrigger value="document-type-rates" className="text-sm">
                KYC Rates
              </TabsTrigger>
              <TabsTrigger value="rate-view-report" className="text-sm">
                Rate Report
              </TabsTrigger>
            </TabsList>

            <div className="mt-6">
              <TabsContent value="rate-types" className="space-y-4">
                <div className="border rounded-lg p-4">
                  <h3 className="text-lg font-semibold mb-2">Rate Types Management</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Create and manage rate types: Local, Local1, Local2, OGL, OGL1, OGL2, Outstation
                  </p>
                  <RateTypesTab />
                </div>
              </TabsContent>

              <TabsContent value="rate-type-assignment" className="space-y-4">
                <div className="border rounded-lg p-4">
                  <h3 className="text-lg font-semibold mb-2">Rate Type Assignment</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Assign rate types to Client → Product → Verification Type combinations
                  </p>
                  <RateTypeAssignmentTab />
                </div>
              </TabsContent>

              <TabsContent value="rate-assignment" className="space-y-4">
                <div className="border rounded-lg p-4">
                  <h3 className="text-lg font-semibold mb-2">Rate Assignment</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Set actual rate amounts for assigned rate types
                  </p>
                  <RateAssignmentTab />
                </div>
              </TabsContent>

              <TabsContent value="service-zone-rules" className="space-y-4">
                <div className="border rounded-lg p-4">
                  <h3 className="text-lg font-semibold mb-2">Rate Type Rules</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Map client, product, verification type, pincode, and area combinations to a rate
                    type before pricing is applied
                  </p>
                  <ServiceZoneRulesTab />
                </div>
              </TabsContent>

              <TabsContent value="document-type-rates" className="space-y-4">
                <div className="border rounded-lg p-4">
                  <h3 className="text-lg font-semibold mb-2">KYC Rates</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Configure pricing for KYC document verification per client and product
                  </p>
                  <DocumentTypeRatesTab />
                </div>
              </TabsContent>

              <TabsContent value="rate-view-report" className="space-y-4">
                <div className="border rounded-lg p-4">
                  <h3 className="text-lg font-semibold mb-2">Rate View & Reports</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    View and manage all configured rates with comprehensive filtering and reporting
                  </p>
                  <RateViewReportTab />
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </CardContent>
      </Card>

      {/* Workflow Guide — Phase 6 (refactor 2026-05-10): step order matches
          dependency chain. Each step depends on the previous being configured. */}
      <Card>
        <CardHeader>
          <CardTitle>Rate Management Workflow</CardTitle>
          <CardDescription>
            Configure each step in order — every step depends on the previous being set
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                1
              </div>
              <div>
                <h4 className="font-semibold">Rate Types</h4>
                <p className="text-sm text-gray-600">
                  Master list — Local, Local1, OGL, Outstation, etc.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                2
              </div>
              <div>
                <h4 className="font-semibold">Rate Type Assignment</h4>
                <p className="text-sm text-gray-600">
                  Eligibility — pick allowed rate types per client + product + verification type
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                3
              </div>
              <div>
                <h4 className="font-semibold">Rate Amounts</h4>
                <p className="text-sm text-gray-600">
                  Pricing — set actual amount per client + product + verification type + rate type
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                4
              </div>
              <div>
                <h4 className="font-semibold">Service Zone Rules</h4>
                <p className="text-sm text-gray-600">
                  Geography — map client + product + verification type + pincode + area to a rate type
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                5
              </div>
              <div>
                <h4 className="font-semibold">KYC Rates</h4>
                <p className="text-sm text-gray-600">
                  Separate pricing for KYC document verification per client + product + document type
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                6
              </div>
              <div>
                <h4 className="font-semibold">Rate Report</h4>
                <p className="text-sm text-gray-600">
                  View, search, and export all configured rates in one place
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
