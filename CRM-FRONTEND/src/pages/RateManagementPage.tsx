import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { rateManagementService } from '@/services/rateManagement';
import { RateTypesTab } from '@/components/rate-management/RateTypesTab';
import { RateTypeAssignmentTab } from '@/components/rate-management/RateTypeAssignmentTab';
import { RateAssignmentTab } from '@/components/rate-management/RateAssignmentTab';
import { RateViewReportTab } from '@/components/rate-management/RateViewReportTab';

export function RateManagementPage() {
  const [activeTab, setActiveTab] = useState('rate-types');

  // Fetch rate management statistics
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['rate-management-stats'],
    queryFn: () => rateManagementService.getRateManagementStats(),
  });

  const stats = statsData?.data || {
    rateTypes: { total: 0, active: 0, inactive: 0 },
    rates: { total: 0, active: 0, inactive: 0, averageAmount: 0 }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Rate Management</h1>
          <p className="text-muted-foreground">
            Manage rate types, assignments, and pricing for verification services
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rate Types</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.rateTypes.total}</div>
            <div className="flex gap-2 mt-2">
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
            <CardTitle className="text-sm font-medium">Configured Rates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.rates.total}</div>
            <div className="flex gap-2 mt-2">
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
            <CardTitle className="text-sm font-medium">Average Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹{stats.rates.averageAmount?.toFixed(0) || '0'}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Across all rate types
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm font-medium">Operational</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              All systems running
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Rate Management System</CardTitle>
          <CardDescription>
            Configure rate types, assign them to client-product combinations, set rates, and view comprehensive reports
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="rate-types" className="text-sm">
                1. Create Rate Types
              </TabsTrigger>
              <TabsTrigger value="rate-type-assignment" className="text-sm">
                2. Rate Type Assignment
              </TabsTrigger>
              <TabsTrigger value="rate-assignment" className="text-sm">
                3. Rate Assignment
              </TabsTrigger>
              <TabsTrigger value="rate-view-report" className="text-sm">
                4. Rate View/Report
              </TabsTrigger>
            </TabsList>

            <div className="mt-6">
              <TabsContent value="rate-types" className="space-y-4">
                <div className="border rounded-lg p-4">
                  <h3 className="text-lg font-semibold mb-2">Rate Types Management</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Create and manage rate types: Local, Local1, Local2, OGL, OGL1, OGL2, Outstation
                  </p>
                  <RateTypesTab />
                </div>
              </TabsContent>

              <TabsContent value="rate-type-assignment" className="space-y-4">
                <div className="border rounded-lg p-4">
                  <h3 className="text-lg font-semibold mb-2">Rate Type Assignment</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Assign rate types to Client → Product → Verification Type combinations
                  </p>
                  <RateTypeAssignmentTab />
                </div>
              </TabsContent>

              <TabsContent value="rate-assignment" className="space-y-4">
                <div className="border rounded-lg p-4">
                  <h3 className="text-lg font-semibold mb-2">Rate Assignment</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Set actual rate amounts for assigned rate types
                  </p>
                  <RateAssignmentTab />
                </div>
              </TabsContent>

              <TabsContent value="rate-view-report" className="space-y-4">
                <div className="border rounded-lg p-4">
                  <h3 className="text-lg font-semibold mb-2">Rate View & Reports</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    View and manage all configured rates with comprehensive filtering and reporting
                  </p>
                  <RateViewReportTab />
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </CardContent>
      </Card>

      {/* Workflow Guide */}
      <Card>
        <CardHeader>
          <CardTitle>Rate Management Workflow</CardTitle>
          <CardDescription>Follow these steps to set up rates for verification services</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">
                1
              </div>
              <div>
                <h4 className="font-semibold">Create Rate Types</h4>
                <p className="text-sm text-muted-foreground">
                  Define rate categories like Local, OGL, Outstation
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">
                2
              </div>
              <div>
                <h4 className="font-semibold">Assign Rate Types</h4>
                <p className="text-sm text-muted-foreground">
                  Map rate types to client-product-verification combinations
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">
                3
              </div>
              <div>
                <h4 className="font-semibold">Set Rate Amounts</h4>
                <p className="text-sm text-muted-foreground">
                  Configure actual pricing for each assigned rate type
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">
                4
              </div>
              <div>
                <h4 className="font-semibold">View & Manage</h4>
                <p className="text-sm text-muted-foreground">
                  Monitor and update rates with comprehensive reporting
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
