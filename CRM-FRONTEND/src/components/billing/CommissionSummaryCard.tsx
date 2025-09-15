import React from 'react';
import { TrendingUp, DollarSign, Clock, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CommissionSummary } from '@/types/billing';

interface CommissionSummaryCardProps {
  summary: CommissionSummary;
}

export function CommissionSummaryCard({ summary }: CommissionSummaryCardProps) {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">₹{summary.totalAmount.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">
            {summary.totalCases} cases
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pending</CardTitle>
          <Clock className="h-4 w-4 text-orange-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-orange-600">
            ₹{summary.pendingAmount.toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground">
            Awaiting approval
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Approved</CardTitle>
          <CheckCircle className="h-4 w-4 text-blue-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600">
            ₹{summary.approvedAmount.toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground">
            Ready for payment
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Paid</CardTitle>
          <DollarSign className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">
            ₹{summary.paidAmount.toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground">
            Completed payments
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
