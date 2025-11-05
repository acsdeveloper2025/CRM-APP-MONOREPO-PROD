import React from 'react';
import { Link } from 'react-router-dom';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Eye, Download, FileText, MapPin, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import type { Case } from '@/types/case';
import { cn } from '@/lib/utils';
import {
  getVerificationTypeBadgeStyle,
  getPriorityBadgeStyle,
  getPriorityLabel,
  formatBadgeLabel,
} from '@/lib/badgeStyles';

interface CompletedCaseTableProps {
  cases: Case[];
  isLoading?: boolean;
}

export const CompletedCaseTable: React.FC<CompletedCaseTableProps> = ({
  cases,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Case ID</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Verification Type</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Assigned By</TableHead>
              <TableHead>Completed Date</TableHead>
              <TableHead className="w-[70px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {[1, 2, 3, 4, 5].map((item) => (
              <TableRow key={item}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((cell) => (
                  <TableCell key={cell}>
                    <div className="h-4 bg-muted rounded animate-pulse" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (cases.length === 0) {
    return (
      <div className="border rounded-lg p-8 text-center">
        <FileText className="h-12 w-12 text-gray-600 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No completed cases found</h3>
        <p className="text-gray-600">
          There are no completed cases matching your current filters.
        </p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Case ID</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Verification Type</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Product</TableHead>
            <TableHead>Assigned By</TableHead>
            <TableHead>Completed Date</TableHead>
            <TableHead className="w-[70px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {cases.map((caseItem) => (
            <TableRow key={caseItem.id}>
              <TableCell className="font-medium">
                <Link
                  to={`/cases/${caseItem.caseId || caseItem.id}`}
                  className="text-primary hover:underline"
                >
                  #{caseItem.caseId || caseItem.id?.slice(-8) || 'N/A'}
                </Link>
              </TableCell>
              <TableCell>
                <div>
                  <div className="font-medium">{caseItem.customerName}</div>
                  <div className="text-sm text-gray-600 flex items-center">
                    {caseItem.customerPhone && (
                      <span className="mr-2">{caseItem.customerPhone}</span>
                    )}
                    {caseItem.addressCity && (
                      <span className="flex items-center">
                        <MapPin className="h-3 w-3 mr-1" />
                        {caseItem.addressCity}
                      </span>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge className={getVerificationTypeBadgeStyle(caseItem.verificationType)}>
                  {formatBadgeLabel(caseItem.verificationType || 'Not specified')}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge className={getPriorityBadgeStyle(caseItem.priority)}>
                  {getPriorityLabel(caseItem.priority)}
                </Badge>
              </TableCell>
              <TableCell>
                <div>
                  <div className="font-medium">{caseItem.clientName || caseItem.client?.name}</div>
                  <div className="text-sm text-gray-600">{caseItem.clientCode || caseItem.client?.code}</div>
                </div>
              </TableCell>
              <TableCell>
                <div>
                  <div className="font-medium">{caseItem.productName || caseItem.product?.name || 'Not specified'}</div>
                  <div className="text-sm text-gray-600">{caseItem.productCode || caseItem.product?.code}</div>
                </div>
              </TableCell>
              <TableCell>
                <div>
                  <div className="font-medium">{caseItem.createdByBackendUser?.name || 'Unknown'}</div>
                  <div className="text-sm text-gray-600">{caseItem.createdByBackendUser?.employeeId}</div>
                </div>
              </TableCell>
              <TableCell>
                <div className="text-sm text-gray-600">
                  {caseItem.completedAt
                    ? format(new Date(caseItem.completedAt), 'dd MMM yyyy, hh:mm a')
                    : format(new Date(caseItem.updatedAt), 'dd MMM yyyy, hh:mm a')
                  }
                </div>
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                      <span className="sr-only">Open menu</span>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuItem asChild>
                      <Link to={`/cases/${caseItem.caseId || caseItem.id}`}>
                        <Eye className="mr-2 h-4 w-4" />
                        View Details
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>
                      <Download className="mr-2 h-4 w-4" />
                      Download Report
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <FileText className="mr-2 h-4 w-4" />
                      View Attachments
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
