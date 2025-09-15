import React from 'react';
import { Building, Calendar, FileText, DollarSign } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { BankBill } from '@/types/reports';

interface BankBillDetailsDialogProps {
  bill: BankBill;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BankBillDetailsDialog({ bill, open, onOpenChange }: BankBillDetailsDialogProps) {
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <span>Bank Bill {bill.billNumber}</span>
            </div>
            {getStatusBadge(bill.status)}
          </DialogTitle>
          <DialogDescription>
            Detailed bank bill information and associated cases
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Bill Information */}
          <div className="grid grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center space-x-2">
                  <Building className="h-4 w-4" />
                  <span>Bill Information</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Client:</span>
                  <span className="text-sm font-medium">{bill.client.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Bank:</span>
                  <span className="text-sm">{bill.bankName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Cases:</span>
                  <span className="text-sm">{bill.caseCount} cases</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center space-x-2">
                  <Calendar className="h-4 w-4" />
                  <span>Dates & Status</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Bill Date:</span>
                  <span className="text-sm">{new Date(bill.billDate).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Due Date:</span>
                  <span className="text-sm">{new Date(bill.dueDate).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Status:</span>
                  {getStatusBadge(bill.status)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Amount Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center space-x-2">
                <DollarSign className="h-4 w-4" />
                <span>Amount Details</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Total Amount:</span>
                  <span className="font-medium">₹{bill.totalAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Paid Amount:</span>
                  <span className="text-green-600 font-medium">₹{bill.paidAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Pending Amount:</span>
                  <span className="text-orange-600 font-medium">₹{bill.pendingAmount.toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Separator />

          {/* Associated Cases */}
          <Card>
            <CardHeader>
              <CardTitle>Associated Cases</CardTitle>
              <CardDescription>
                Cases included in this bank bill
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {bill.cases.map((billCase) => (
                  <div
                    key={billCase.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="font-medium">{billCase.case.title}</div>
                      <div className="text-sm text-muted-foreground">
                        Customer: {billCase.case.customerName}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Status: {billCase.case.status}
                        {billCase.case.completedAt && (
                          <span> • Completed: {new Date(billCase.case.completedAt).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">₹{billCase.amount.toLocaleString()}</div>
                      <div className="text-sm text-muted-foreground">
                        Fee: ₹{billCase.verificationFee.toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
