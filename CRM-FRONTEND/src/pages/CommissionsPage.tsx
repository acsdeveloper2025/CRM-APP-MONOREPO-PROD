import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Calculator, BarChart3, FileText, HelpCircle, Download, DollarSign, Clock, CheckCircle, TrendingUp } from 'lucide-react';
import { CommissionCalculationsTab } from '@/components/commission/CommissionCalculationsTab';
import { CommissionStatsTab } from '@/components/commission/CommissionStatsTab';
import { commissionManagementService } from '@/services/commissionManagement';

export const CommissionsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('calculations');

  // Fetch commission statistics
  const { data: statsData } = useQuery({
    queryKey: ['commission-stats'],
    queryFn: () => commissionManagementService.getCommissionStats(),
  });

  const stats = statsData?.data || {
    totalCommissions: 0,
    totalAmount: 0,
    pendingCommissions: 0,
    pendingAmount: 0,
    approvedCommissions: 0,
    approvedAmount: 0,
    paidCommissions: 0,
    paidAmount: 0,
    activeFieldUsers: 0,
  };

  const exportAllData = () => {
    // This would trigger export from both tabs
    console.log('Exporting all commission data...');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Commission Reports</h1>
          <p className="text-muted-foreground">
            View commission calculations, payment tracking, and performance statistics
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportAllData} variant="outline" className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export Report
          </Button>
          <Button variant="outline" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Documentation
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Calculations</CardTitle>
            <Calculator className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCommissions || 0}</div>
            <p className="text-xs text-gray-600">
              All commission records
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Approval</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingCommissions || 0}</div>
            <p className="text-xs text-gray-600">
              ₹{stats.pendingAmount?.toLocaleString() || 0} pending
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.approvedCommissions || 0}</div>
            <p className="text-xs text-gray-600">
              Ready for payment
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{stats.totalAmount?.toLocaleString() || 0}</div>
            <p className="text-xs text-gray-600">
              All commissions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Commission</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹{stats.totalCommissions > 0 ? Math.round(stats.totalAmount / stats.totalCommissions).toLocaleString() : 0}
            </div>
            <p className="text-xs text-gray-600">
              Per calculation
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Commission Reports & Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="calculations" className="flex items-center gap-2">
                <Calculator className="h-4 w-4" />
                Commission Calculations
              </TabsTrigger>
              <TabsTrigger value="statistics" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Statistics & Analytics
              </TabsTrigger>
            </TabsList>

            <TabsContent value="calculations">
              <CommissionCalculationsTab />
            </TabsContent>

            <TabsContent value="statistics">
              <CommissionStatsTab />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => window.location.href = '/commission-management'}>
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Calculator className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Commission Management</h3>
                <p className="text-sm text-muted-foreground">Configure rates and assignments</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => window.location.href = '/billing'}>
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="p-2 bg-primary/10 rounded-lg">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Billing & Invoices</h3>
                <p className="text-sm text-muted-foreground">Manage invoices and payments</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Help Section */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start space-x-4">
            <div className="p-2 bg-green-100 rounded-lg">
              <HelpCircle className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold mb-2">Commission Reports Guide</h3>
              <div className="space-y-2 text-sm text-gray-600">
                <p>• <strong>Commission Calculations:</strong> View detailed commission calculations for each field user with payment status and case details</p>
                <p>• <strong>Statistics & Analytics:</strong> Monitor commission trends, top performers, and overall commission metrics</p>
                <p>• <strong>Payment Tracking:</strong> Track paid, pending, and overdue commission payments</p>
                <p>• <strong>Performance Insights:</strong> Analyze field user performance and commission distribution patterns</p>
                <p>• <strong>Commission Management:</strong> Configure commission rates and assignments in Commission Management section</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
