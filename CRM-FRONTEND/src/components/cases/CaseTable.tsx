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
import {
  MobileTableCard,
  MobileTableField,
} from '@/components/ui/responsive-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye } from 'lucide-react';
import { format } from 'date-fns';
import type { Case } from '@/types/case';
import {
  getStatusBadgeStyle,
  getPriorityBadgeStyle,
  getPriorityLabel,
  getStatusLabel,
} from '@/lib/badgeStyles';

interface CaseTableProps {
  cases: Case[];
  isLoading?: boolean;
}

export const CaseTable: React.FC<CaseTableProps> = ({
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
              <TableHead>Client</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Verification Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Verification Tasks</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Time</TableHead>
              <TableHead className="w-[70px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {[1, 2, 3, 4, 5].map((item) => (
              <TableRow key={item}>
                <TableCell>
                  <div className="h-4 bg-muted rounded animate-pulse" />
                </TableCell>
                <TableCell>
                  <div className="h-4 bg-muted rounded animate-pulse" />
                </TableCell>
                <TableCell>
                  <div className="h-4 bg-muted rounded animate-pulse" />
                </TableCell>
                <TableCell>
                  <div className="h-4 bg-muted rounded animate-pulse" />
                </TableCell>
                <TableCell>
                  <div className="h-6 bg-muted rounded animate-pulse w-20" />
                </TableCell>
                <TableCell>
                  <div className="h-6 bg-muted rounded animate-pulse w-16" />
                </TableCell>
                <TableCell>
                  <div className="h-6 bg-muted rounded animate-pulse w-16" />
                </TableCell>
                <TableCell>
                  <div className="h-4 bg-muted rounded animate-pulse" />
                </TableCell>
                <TableCell>
                  <div className="h-4 bg-muted rounded animate-pulse" />
                </TableCell>
                <TableCell>
                  <div className="h-4 bg-muted rounded animate-pulse" />
                </TableCell>
                <TableCell>
                  <div className="h-8 w-8 bg-muted rounded animate-pulse" />
                </TableCell>
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
        <p className="text-gray-600">No cases found matching your criteria.</p>
      </div>
    );
  }

  return (
    <>
      {/* Desktop Table */}
      <div className="hidden md:block border rounded-lg overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Case ID</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead className="hidden lg:table-cell">Client</TableHead>
              <TableHead className="hidden xl:table-cell">Product</TableHead>
              <TableHead className="hidden lg:table-cell">Verification Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden lg:table-cell">Priority</TableHead>
              <TableHead className="hidden lg:table-cell">Verification Tasks</TableHead>
              <TableHead className="hidden xl:table-cell">Date</TableHead>
              <TableHead className="hidden xl:table-cell">Time</TableHead>
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
                  <div className="font-medium">{caseItem.customerName || caseItem.applicantName}</div>
                  <div className="text-sm text-gray-600">{caseItem.customerPhone || caseItem.applicantPhone}</div>
                </div>
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                <div className="text-sm">
                  {caseItem.clientName || caseItem.client?.name}
                </div>
              </TableCell>
              <TableCell className="hidden xl:table-cell">
                <div className="text-sm">
                  {caseItem.productName || 'N/A'}
                </div>
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                <div className="text-sm">
                  {caseItem.verificationTypeName || caseItem.verificationType || 'N/A'}
                </div>
              </TableCell>
              <TableCell>
                <Badge className={getStatusBadgeStyle(caseItem.status)}>
                  {getStatusLabel(caseItem.status)}
                </Badge>
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                <Badge className={getPriorityBadgeStyle(caseItem.priority)}>
                  {getPriorityLabel(caseItem.priority)}
                </Badge>
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{caseItem.totalTasks || 0}</span>
                  <div className="flex items-center gap-1 text-xs text-gray-600">
                    <span className="text-green-600">✓ {caseItem.completedTasks || 0}</span>
                    <span>|</span>
                    <span className="text-yellow-600">⏳ {(caseItem.pendingTasks || 0) + (caseItem.inProgressTasks || 0)}</span>
                  </div>
                </div>
              </TableCell>
              <TableCell className="hidden xl:table-cell">
                <div className="text-sm text-gray-600">
                  {format(new Date(caseItem.updatedAt), 'dd MMM yyyy')}
                </div>
              </TableCell>
              <TableCell className="hidden xl:table-cell">
                <div className="text-sm text-gray-600">
                  {format(new Date(caseItem.updatedAt), 'hh:mm a')}
                </div>
              </TableCell>
              <TableCell>
                <Button variant="ghost" size="sm" asChild>
                  <Link to={`/cases/${caseItem.caseId || caseItem.id}`}>
                    <Eye className="mr-2 h-4 w-4" />
                    View
                  </Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>

      {/* Mobile Card Layout */}
      <div className="md:hidden space-y-3">
        {cases.map((caseItem) => (
          <MobileTableCard key={caseItem.id}>
            <div className="flex justify-between items-start mb-3">
              <Link
                to={`/cases/${caseItem.caseId || caseItem.id}`}
                className="text-lg font-semibold text-primary hover:underline"
              >
                #{caseItem.caseId || caseItem.id?.slice(-8) || 'N/A'}
              </Link>
              <div className="flex space-x-2">
                <Badge className={getStatusBadgeStyle(caseItem.status)}>
                  {getStatusLabel(caseItem.status)}
                </Badge>
                <Button variant="ghost" size="sm" asChild>
                  <Link to={`/cases/${caseItem.caseId || caseItem.id}`}>
                    <Eye className="mr-2 h-4 w-4" />
                    View
                  </Link>
                </Button>
              </div>
            </div>

            <MobileTableField
              label="Customer"
              value={
                <div>
                  <div className="font-medium">{caseItem.customerName || caseItem.applicantName}</div>
                  <div className="text-xs text-gray-600">{caseItem.customerPhone || caseItem.applicantPhone}</div>
                </div>
              }
            />
            <MobileTableField
              label="Client"
              value={caseItem.clientName || caseItem.client?.name || 'N/A'}
            />
            <MobileTableField
              label="Product"
              value={caseItem.productName || 'N/A'}
            />
            <MobileTableField
              label="Verification"
              value={caseItem.verificationTypeName || caseItem.verificationType || 'N/A'}
            />
            <MobileTableField
              label="Priority"
              value={
                <Badge className={getPriorityBadgeStyle(caseItem.priority)}>
                  {getPriorityLabel(caseItem.priority)}
                </Badge>
              }
            />
            <MobileTableField
              label="Assigned To"
              value={caseItem.assignedToName || caseItem.assignedTo?.name || 'Unassigned'}
            />
            <MobileTableField
              label="Updated"
              value={format(new Date(caseItem.updatedAt), 'dd MMM yyyy, hh:mm a')}
            />
          </MobileTableCard>
        ))}
      </div>
    </>
  );
};
