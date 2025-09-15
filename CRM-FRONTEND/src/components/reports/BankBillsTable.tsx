import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal, Download, DollarSign, Eye, FileText, Building } from 'lucide-react';
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
import { toast } from 'sonner';
import { reportsService } from '@/services/reports';
import { BankBill } from '@/types/reports';
import { BankBillDetailsDialog } from './BankBillDetailsDialog';
import { MarkBillPaidDialog } from './MarkBillPaidDialog';

interface BankBillsTableProps {
  data: BankBill[];
  isLoading: boolean;
}

export function BankBillsTable({ data, isLoading }: BankBillsTableProps) {
  const [selectedBill, setSelectedBill] = useState<BankBill | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showMarkPaidDialog, setShowMarkPaidDialog] = useState(false);

  const queryClient = useQueryClient();

  const markPaidMutation = useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) => 
      reportsService.markBankBillPaid(id, amount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-bills'] });
      toast.success('Bank bill marked as paid');
      setShowMarkPaidDialog(false);
      setSelectedBill(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to mark bill as paid');
    },
  });

  const handleDownloadPDF = async (bill: BankBill) => {
    try {
      const blob = await reportsService.downloadBankBillPDF(bill.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bank_bill_${bill.billNumber}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Bank bill downloaded successfully');
    } catch (error) {
      toast.error('Failed to download bank bill');
    }
  };

  const handleViewDetails = (bill: BankBill) => {
    setSelectedBill(bill);
    setShowDetailsDialog(true);
  };

  const handleMarkPaid = (bill: BankBill) => {
    setSelectedBill(bill);
    setShowMarkPaidDialog(true);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      PENDING: { variant: 'secondary' as const, label: 'Pending' },
      PARTIALLY_PAID: { variant: 'outline' as const, label: 'Partially Paid' },
      PAID: { variant: 'default' as const, label: 'Paid' },
      OVERDUE: { variant: 'destructive' as const, label: 'Overdue' },
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
        <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-semibold">No bank bills found</h3>
        <p className="text-muted-foreground">
          Get started by creating your first bank bill.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bill Number</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Bank</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Bill Date</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Cases</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((bill) => (
              <TableRow key={bill.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center space-x-2">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <FileText className="h-4 w-4 text-primary" />
                    </div>
                    <span>{bill.billNumber}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center space-x-2">
                    <Building className="h-3 w-3 text-muted-foreground" />
                    <div>
                      <div className="font-medium">{bill.client.name}</div>
                      <div className="text-sm text-muted-foreground">{bill.client.code}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="font-medium">{bill.bankName}</span>
                </TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">₹{bill.totalAmount.toLocaleString()}</div>
                    {bill.paidAmount > 0 && (
                      <div className="text-sm text-green-600">
                        Paid: ₹{bill.paidAmount.toLocaleString()}
                      </div>
                    )}
                    {bill.pendingAmount > 0 && (
                      <div className="text-sm text-orange-600">
                        Pending: ₹{bill.pendingAmount.toLocaleString()}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {getStatusBadge(bill.status)}
                </TableCell>
                <TableCell>
                  {new Date(bill.billDate).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <div className={`${
                    bill.status === 'OVERDUE' ? 'text-red-600 font-medium' : ''
                  }`}>
                    {new Date(bill.dueDate).toLocaleDateString()}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{bill.caseCount} cases</Badge>
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
                      <DropdownMenuItem onClick={() => handleViewDetails(bill)}>
                        <Eye className="mr-2 h-4 w-4" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDownloadPDF(bill)}>
                        <Download className="mr-2 h-4 w-4" />
                        Download PDF
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {(bill.status === 'PENDING' || bill.status === 'PARTIALLY_PAID') && (
                        <DropdownMenuItem onClick={() => handleMarkPaid(bill)}>
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

      {/* Details Dialog */}
      {selectedBill && (
        <BankBillDetailsDialog
          bill={selectedBill}
          open={showDetailsDialog}
          onOpenChange={setShowDetailsDialog}
        />
      )}

      {/* Mark Paid Dialog */}
      {selectedBill && (
        <MarkBillPaidDialog
          bill={selectedBill}
          open={showMarkPaidDialog}
          onOpenChange={setShowMarkPaidDialog}
          onConfirm={(amount) => markPaidMutation.mutate({ id: selectedBill.id, amount })}
          isLoading={markPaidMutation.isPending}
        />
      )}
    </>
  );
}
