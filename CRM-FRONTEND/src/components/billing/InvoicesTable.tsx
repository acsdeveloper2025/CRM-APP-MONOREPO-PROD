import { useState } from 'react';
import { MoreHorizontal, Download, FileSpreadsheet, Eye, Receipt } from 'lucide-react';
import { Button } from '@/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/ui/components/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/ui/components/table';
import { Badge } from '@/ui/components/badge';
import { LoadingState } from '@/ui/components/loading';
import { toast } from 'sonner';
import { billingService } from '@/services/billing';
import { Invoice } from '@/types/billing';
import { InvoiceDetailsDialog } from './InvoiceDetailsDialog';

interface InvoicesTableProps {
  data: Invoice[];
  isLoading: boolean;
}

export function InvoicesTable({ data, isLoading }: InvoicesTableProps) {
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);

  const handleDownloadPDF = async (invoice: Invoice) => {
    try {
      const blob = await billingService.downloadInvoicePDF(invoice.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice_${invoice.invoiceNumber}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Invoice downloaded successfully');
    } catch (_error) {
      toast.error('Failed to download invoice');
    }
  };

  const handleDownloadExcel = async (invoice: Invoice) => {
    try {
      const blob = await billingService.downloadInvoiceExcel(invoice.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice_${invoice.invoiceNumber}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Invoice Excel downloaded successfully');
    } catch (_error) {
      toast.error('Failed to download invoice excel');
    }
  };

  const handleViewDetails = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setShowDetailsDialog(true);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      DRAFT: { variant: 'secondary' as const, label: 'Draft' },
      SENT: { variant: 'outline' as const, label: 'Sent' },
      OVERDUE: { variant: 'destructive' as const, label: 'Overdue' },
      CANCELLED: { variant: 'secondary' as const, label: 'Cancelled' },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.DRAFT;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (isLoading) {
    return <LoadingState message="Loading invoices..." size="lg" />;
  }

  if (!data || data.length === 0) {
    return (
      <div {...{ className: "text-center py-12" }}>
        <Receipt {...{ className: "mx-auto h-12 w-12 text-gray-600" }} />
        <h3 {...{ className: "mt-4 text-lg font-semibold" }}>No invoices found</h3>
        <p {...{ className: "text-gray-600" }}>
          Get started by creating your first invoice.
        </p>
      </div>
    );
  }

  return (
    <>
      <div {...{ className: "rounded-md border overflow-auto" }}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Issue Date</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead {...{ className: "text-right" }}>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((invoice) => (
              <TableRow key={invoice.id}>
                <TableCell {...{ className: "font-medium" }}>
                  <div {...{ className: "flex items-center space-x-2" }}>
                    <div {...{ className: "h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center" }}>
                      <Receipt {...{ className: "h-4 w-4 text-primary" }} />
                    </div>
                    <span>{invoice.invoiceNumber}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div>
                    <div {...{ className: "font-medium" }}>{invoice.client.name}</div>
                    <div {...{ className: "text-sm text-gray-600" }}>{invoice.client.code}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <div>
                    <div {...{ className: "font-medium" }}>₹{invoice.totalAmount.toLocaleString()}</div>
                    <div {...{ className: "text-sm text-gray-600" }}>
                      Tax: ₹{invoice.taxAmount.toLocaleString()}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {getStatusBadge(invoice.status)}
                </TableCell>
                <TableCell>
                  {new Date(invoice.issueDate).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <div {...{ className: `${
                    invoice.status === 'OVERDUE' ? 'text-red-600 font-medium' : ''
                  }` }}>
                    {new Date(invoice.dueDate).toLocaleDateString()}
                  </div>
                </TableCell>
                <TableCell {...{ className: "text-right" }}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" {...{ className: "h-8 w-8 p-0" }}>
                        <span {...{ className: "sr-only" }}>Open menu</span>
                        <MoreHorizontal {...{ className: "h-4 w-4" }} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => handleViewDetails(invoice)}>
                        <Eye {...{ className: "mr-2 h-4 w-4" }} />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDownloadPDF(invoice)}>
                        <Download {...{ className: "mr-2 h-4 w-4" }} />
                        Download PDF
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDownloadExcel(invoice)}>
                        <FileSpreadsheet {...{ className: "mr-2 h-4 w-4" }} />
                        Download Excel
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Details Dialog */}
      {selectedInvoice && (
        <InvoiceDetailsDialog
          invoice={selectedInvoice}
          open={showDetailsDialog}
          onOpenChange={setShowDetailsDialog}
        />
      )}
    </>
  );
}
