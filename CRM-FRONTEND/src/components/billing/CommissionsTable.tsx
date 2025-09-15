import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal, CheckCircle, DollarSign, TrendingUp, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
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
      queryClient.invalidateQueries({ queryKey: ['commissions'] });
      toast.success('Commission approved successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to approve commission');
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: (id: string) => billingService.markCommissionPaid(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commissions'] });
      toast.success('Commission marked as paid');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to mark commission as paid');
    },
  });

  const bulkApproveMutation = useMutation({
    mutationFn: (ids: string[]) => billingService.bulkApproveCommissions(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commissions'] });
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
      queryClient.invalidateQueries({ queryKey: ['commissions'] });
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

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      PENDING: { variant: 'secondary' as const, label: 'Pending' },
      APPROVED: { variant: 'outline' as const, label: 'Approved' },
      PAID: { variant: 'default' as const, label: 'Paid' },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.PENDING;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center space-x-4">
            <Skeleton className="h-12 w-12 rounded" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-[200px]" />
              <Skeleton className="h-4 w-[150px]" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-12">
        <TrendingUp className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-semibold">No commissions found</h3>
        <p className="text-muted-foreground">
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

      <div className="rounded-md border">
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
                      <div className="text-sm text-muted-foreground">
                        {commission.user.employeeId}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">{commission.case.title}</div>
                    <div className="text-sm text-muted-foreground">
                      {commission.case.customerName}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">{commission.client.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {commission.client.code}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="font-medium">₹{commission.amount.toLocaleString()}</div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{commission.percentage}%</Badge>
                </TableCell>
                <TableCell>
                  {getStatusBadge(commission.status)}
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
