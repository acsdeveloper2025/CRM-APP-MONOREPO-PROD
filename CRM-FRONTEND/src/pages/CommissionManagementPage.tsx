import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Users,
  FileText,
  Download,
  DollarSign,
  Clock,
  CheckCircle,
  TrendingUp
} from 'lucide-react';
import { FieldUserAssignmentsTab } from '@/components/commission/FieldUserAssignmentsTab';
import { commissionManagementService } from '@/services/commissionManagement';

export const CommissionManagementPage: React.FC = () => {
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
    paidCommissions: 0,
    paidAmount: 0,
    activeFieldUsers: 0,
    averageCommission: 0,
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 truncate">Commission Management</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">
            Manage field employee commissions, rate assignments, and payments
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <Button variant="outline" size="sm" className="w-full sm:w-auto">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
          <Button variant="outline" size="sm" className="w-full sm:w-auto">
            <FileText className="h-4 w-4 mr-2" />
            Documentation
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{stats.paidAmount?.toLocaleString() || 0}</div>
            <p className="text-xs text-gray-600">
              {stats.paidCommissions || 0} commissions paid
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{stats.pendingAmount?.toLocaleString() || 0}</div>
            <p className="text-xs text-gray-600">
              {stats.pendingCommissions || 0} awaiting payment
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Agents</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeFieldUsers || 0}</div>
            <p className="text-xs text-gray-600">
              Field agents with assignments
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Commission</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{stats.averageCommission?.toLocaleString() || 0}</div>
            <p className="text-xs text-gray-600">
              Per completed task
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{stats.totalAmount?.toLocaleString() || 0}</div>
            <p className="text-xs text-gray-600">
              Total commissions
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Commission Rate Assignments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <FieldUserAssignmentsTab />
        </CardContent>
      </Card>



      {/* Help Section */}
      <Card className="bg-muted/50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <FileText className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Commission Management Guide</h3>
              <div className="space-y-1 text-sm text-gray-600">
                <p>• <strong>Rate Assignments:</strong> Assign commission rates to field users using existing rate types from the rate management system</p>
                <p>• <strong>Rate Selection:</strong> Choose from available rate types (Local, OGL, Outstation, etc.) when creating assignments</p>
                <p>• <strong>Auto-Calculation:</strong> Commissions are automatically calculated when field users complete cases</p>
                <p>• <strong>Commission Reports:</strong> View calculated commissions and payment tracking in Billing & Commission → Commissions</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
