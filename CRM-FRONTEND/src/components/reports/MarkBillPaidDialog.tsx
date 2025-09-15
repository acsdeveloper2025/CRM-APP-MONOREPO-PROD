import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { BankBill } from '@/types/reports';

const markPaidSchema = z.object({
  paidAmount: z.number().min(0, 'Amount must be positive'),
});

type MarkPaidFormData = z.infer<typeof markPaidSchema>;

interface MarkBillPaidDialogProps {
  bill: BankBill;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (amount: number) => void;
  isLoading: boolean;
}

export function MarkBillPaidDialog({ 
  bill, 
  open, 
  onOpenChange, 
  onConfirm, 
  isLoading 
}: MarkBillPaidDialogProps) {
  const form = useForm<MarkPaidFormData>({
    resolver: zodResolver(markPaidSchema),
    defaultValues: {
      paidAmount: bill.pendingAmount,
    },
  });

  const onSubmit = (data: MarkPaidFormData) => {
    onConfirm(data.paidAmount);
  };

  const watchedAmount = form.watch('paidAmount');
  const newPaidAmount = bill.paidAmount + watchedAmount;
  const newPendingAmount = bill.totalAmount - newPaidAmount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Mark Bill as Paid</DialogTitle>
          <DialogDescription>
            Record a payment for bank bill {bill.billNumber}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current Status */}
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span>Total Amount:</span>
              <span className="font-medium">₹{bill.totalAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Already Paid:</span>
              <span className="text-green-600">₹{bill.paidAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Pending Amount:</span>
              <span className="text-orange-600">₹{bill.pendingAmount.toLocaleString()}</span>
            </div>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="paidAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Amount</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        max={bill.pendingAmount}
                        step="0.01"
                        placeholder="Enter payment amount"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormDescription>
                      Maximum amount: ₹{bill.pendingAmount.toLocaleString()}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Preview */}
              {watchedAmount > 0 && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-2">
                  <h4 className="font-medium text-green-800">After Payment:</h4>
                  <div className="flex justify-between text-sm">
                    <span>Total Paid:</span>
                    <span className="text-green-600 font-medium">
                      ₹{newPaidAmount.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Remaining:</span>
                    <span className={newPendingAmount === 0 ? 'text-green-600 font-medium' : 'text-orange-600'}>
                      ₹{newPendingAmount.toLocaleString()}
                    </span>
                  </div>
                  {newPendingAmount === 0 && (
                    <div className="text-sm text-green-600 font-medium">
                      ✓ Bill will be marked as fully paid
                    </div>
                  )}
                </div>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading || watchedAmount <= 0 || watchedAmount > bill.pendingAmount}
                >
                  {isLoading ? 'Processing...' : 'Record Payment'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
