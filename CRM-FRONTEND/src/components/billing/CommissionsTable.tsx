import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal, CheckCircle, DollarSign, TrendingUp, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { LoadingState } from '@/components/ui/loading';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { baseBadgeStyle, formatBadgeLabel } from '@/lib/badgeStyles';
import { billingService } from '@/services/billing';
import { Commission } from '@/types/billing';

interface CommissionsTableProps {
  data: Commission[];
  isLoading: boolean;
}

export function CommissionsTable({ data, isLoading }: CommissionsTableProps) {
  const [selectedCommissions, setSelectedCommissions] = useState<string[]>([]);

  const queryClient = useQueryClient();

  const approveCommissionMutation = useMutation({
    mutationFn: (id: string) => billingService.approveCommission(id),
    onSuccess: () => {
      // Invalidate commission-related queries
      queryClient.invalidateQueries({ queryKey: ['commissions'] });
      // Invalidate dashboard stats (affects commission amounts, pending commissions)
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Commission approved successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to approve commission');
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: (id: string) => billingService.markCommissionPaid(id),
    onSuccess: () => {
      // Invalidate commission-related queries
      queryClient.invalidateQueries({ queryKey: ['commissions'] });
      // Invalidate dashboard stats (affects paid commissions, outstanding amounts)
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Commission marked as paid');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to mark commission as paid');
    },
  });

  const bulkApproveMutation = useMutation({
    mutationFn: (ids: string[]) => billingService.bulkApproveCommissions(ids),
    onSuccess: () => {
      // Invalidate commission-related queries
      queryClient.invalidateQueries({ queryKey: ['commissions'] });
      // Invalidate dashboard stats
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Commissions approved successfully');
      setSelectedCommissions([]);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to approve commissions');
    },
  });

  const bulkMarkPaidMutation = useMutation({
    mutationFn: (ids: string[]) => billingService.bulkMarkCommissionsPaid(ids),
    onSuccess: () => {
      // Invalidate commission-related queries
      queryClient.invalidateQueries({ queryKey: ['commissions'] });
      // Invalidate dashboard stats
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Commissions marked as paid');
      setSelectedCommissions([]);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to mark commissions as paid');
    },
  });

  const handleSelectCommission = (commissionId: string, checked: boolean) => {
    if (checked) {
      setSelectedCommissions([...selectedCommissions, commissionId]);
    } else {
      setSelectedCommissions(selectedCommissions.filter(id => id !== commissionId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedCommissions(data.map(commission => commission.id));
    } else {
      setSelectedCommissions([]);
    }
  };



  if (isLoading) {
    return <LoadingState message="Loading commissions..." size="lg" />;
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-12">
        <TrendingUp className="mx-auto h-12 w-12 text-gray-600" />
        <h3 className="mt-4 text-lg font-semibold">No commissions found</h3>
        <p className="text-gray-600">
          Commissions will appear here once cases are completed.
        </p>
      </div>
    );
  }

  const pendingCommissions = selectedCommissions.filter(id => {
    const commission = data.find(c => c.id === id);
    return commission?.status === 'PENDING';
  });

  const approvedCommissions = selectedCommissions.filter(id => {
    const commission = data.find(c => c.id === id);
    return commission?.status === 'APPROVED';
  });

  return (
    <div className="space-y-4">
      {/* Bulk Actions */}
      {selectedCommissions.length > 0 && (
        <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
          <span className="text-sm font-medium">
            {selectedCommissions.length} commission(s) selected
          </span>
          <div className="flex items-center space-x-2">
            {pendingCommissions.length > 0 && (
              <Button
                size="sm"
                onClick={() => bulkApproveMutation.mutate(pendingCommissions)}
                disabled={bulkApproveMutation.isPending}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve ({pendingCommissions.length})
              </Button>
            )}
            {approvedCommissions.length > 0 && (
              <Button
                size="sm"
                onClick={() => bulkMarkPaidMutation.mutate(approvedCommissions)}
                disabled={bulkMarkPaidMutation.isPending}
              >
                <DollarSign className="h-4 w-4 mr-2" />
                Mark Paid ({approvedCommissions.length})
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedCommissions.length === data.length}
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead>User</TableHead>
              <TableHead>Case</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Percentage</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Calculated Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((commission) => (
              <TableRow key={commission.id}>
                <TableCell>
                  <Checkbox
                    checked={selectedCommissions.includes(commission.id)}
                    onCheckedChange={(checked) => 
                      handleSelectCommission(commission.id, checked as boolean)
                    }
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center space-x-2">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <div className="font-medium">{commission.user.name}</div>
                      <div className="text-sm text-gray-600">
                        {commission.user.employeeId}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">{commission.case.title}</div>
                    <div className="text-sm text-gray-600">
                      {commission.case.customerName}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">{commission.client.name}</div>
                    <div className="text-sm text-gray-600">
                      {commission.client.code}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="font-medium">₹{commission.amount.toLocaleString()}</div>
                </TableCell>
                <TableCell>
                  <Badge className={baseBadgeStyle}>{commission.percentage}%</Badge>
                </TableCell>
                <TableCell>
                  <Badge className={baseBadgeStyle}>{formatBadgeLabel(commission.status)}</Badge>
                </TableCell>
                <TableCell>
                  {new Date(commission.calculatedAt).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      {commission.status === 'PENDING' && (
                        <DropdownMenuItem 
                          onClick={() => approveCommissionMutation.mutate(commission.id)}
                          disabled={approveCommissionMutation.isPending}
                        >
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Approve Commission
                        </DropdownMenuItem>
                      )}
                      {commission.status === 'APPROVED' && (
                        <DropdownMenuItem 
                          onClick={() => markPaidMutation.mutate(commission.id)}
                          disabled={markPaidMutation.isPending}
                        >
                          <DollarSign className="mr-2 h-4 w-4" />
                          Mark as Paid
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
