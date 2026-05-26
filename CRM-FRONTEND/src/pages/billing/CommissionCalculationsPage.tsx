import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calculator, CheckCircle, Clock, Download } from 'lucide-react';
import { CommissionCalculationsTab } from '@/components/commission/CommissionCalculationsTab';
import { commissionManagementService } from '@/services/commissionManagement';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';

export const CommissionCalculationsPage: React.FC = () => {
  const { data: statsData } = useQuery({
    queryKey: ['commission-stats'],
    queryFn: () => commissionManagementService.getCommissionStats(),
  });

  const stats = statsData?.data || {};
  const totalCommissions = stats.totalCommissions ?? 0;
  const approvedCommissions = stats.approvedCommissions ?? 0;
  const paidCommissions = stats.paidCommissions ?? 0;
  const rejectedCommissions = stats.rejectedCommissions ?? 0;
  // "Awaiting Approval" = rows that haven't been approved / paid / rejected.
  // Truthful-sweep 2026-05-26: dropped the 'status=PENDING-only' interpretation
  // because every row is created in CALCULATED and the FE has no path to
  // transition CALCULATED→APPROVED yet — original tile was perpetually 0.
  const awaitingApproval = Math.max(
    0,
    totalCommissions - approvedCommissions - paidCommissions - rejectedCommissions
  );

  const handleExport = async () => {
    try {
      const blob = await commissionManagementService.exportToExcel();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `commissions_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Commissions exported successfully');
    } catch (error) {
      logger.error('Failed to export commissions:', error);
      toast.error('Failed to export commissions');
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Commission Calculations</h1>
          <p className="text-sm text-muted-foreground">
            View detailed commission calculations per field user, with payment status and case
            details.
          </p>
        </div>
        <Button onClick={handleExport} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export Report
        </Button>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Calculations</CardTitle>
            <Calculator className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCommissions}</div>
            <p className="text-xs text-muted-foreground">All commission records</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Awaiting Approval</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{awaitingApproval}</div>
            <p className="text-xs text-muted-foreground">Not yet approved or paid</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{approvedCommissions}</div>
            <p className="text-xs text-muted-foreground">Ready for payment</p>
          </CardContent>
        </Card>
      </div>

      <CommissionCalculationsTab />
    </div>
  );
};

export default CommissionCalculationsPage;
