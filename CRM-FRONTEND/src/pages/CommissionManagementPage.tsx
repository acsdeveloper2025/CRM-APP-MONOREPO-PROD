import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, FileText, Download, CheckCircle, TrendingUp } from 'lucide-react';
import { FieldUserAssignmentsTab } from '@/components/commission/FieldUserAssignmentsTab';
import { commissionManagementService } from '@/services/commissionManagement';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';

export const CommissionManagementPage: React.FC = () => {
  const [isExporting, setIsExporting] = useState(false);

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
    averageCommissionPerCase: 0,
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground truncate">
            Commission Management
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Manage field employee commissions, rate assignments, and payments
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full sm:w-auto"
            disabled={isExporting}
            onClick={async () => {
              setIsExporting(true);
              try {
                const blob = await commissionManagementService.exportToExcel();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `commission_management_${new Date().toISOString().split('T')[0]}.xlsx`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                toast.success('Commissions exported successfully');
              } catch (error) {
                logger.error('Failed to export commissions:', error);
                toast.error('Failed to export commissions');
              } finally {
                setIsExporting(false);
              }
            }}
          >
            <Download className="h-4 w-4 mr-2" />
            {isExporting ? 'Exporting...' : 'Export Report'}
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      {/* Truthful-data sweep 2026-05-26: dropped 'Total Paid' + 'Pending'
          (both perpetually ₹0 — workflow gap, no FE path moves rows to
          PAID/PENDING; see project_commission_calculations_truthful_2026_05_26).
          'This Month' renamed → 'Total Earned' + backed by new BE
          totalEarnedAmount (SUM across non-REJECTED). */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Agents</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeFieldUsers || 0}</div>
            <p className="text-xs text-muted-foreground">Field agents with assignments</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Commission</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹{stats.averageCommissionPerCase?.toLocaleString() || 0}
            </div>
            <p className="text-xs text-muted-foreground">Per completed task</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Earned</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹{stats.totalEarnedAmount?.toLocaleString() || 0}
            </div>
            <p className="text-xs text-muted-foreground">All commissions (excl. rejected)</p>
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
      <Card className="bg-muted/70 dark:bg-card/50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <FileText className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-2">Commission Management Guide</h3>
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>
                  • <strong>Rate Assignments:</strong> Assign commission rates to field users using
                  existing rate types from the rate management system
                </p>
                <p>
                  • <strong>Rate Selection:</strong> Choose from available rate types (Local, OGL,
                  Outstation, etc.) when creating assignments
                </p>
                <p>
                  • <strong>Auto-Calculation:</strong> Commissions are automatically calculated when
                  field users complete cases
                </p>
                <p>
                  • <strong>Commission Reports:</strong> View calculated commissions and payment
                  tracking in Billing & Commission → Commissions
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
