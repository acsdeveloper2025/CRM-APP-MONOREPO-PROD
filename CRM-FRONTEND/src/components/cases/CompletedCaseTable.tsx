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
import { formatDistanceToNow, format } from 'date-fns';
import type { Case } from '@/types/case';
import { cn } from '@/utils/cn';

interface CompletedCaseTableProps {
  cases: Case[];
  isLoading?: boolean;
}

const getPriorityColor = (priority: number | string) => {
  // Handle string priorities
  if (typeof priority === 'string') {
    switch (priority.toUpperCase()) {
      case 'LOW':
        return 'bg-muted text-foreground';
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-800';
      case 'HIGH':
        return 'bg-orange-100 text-orange-800';
      case 'URGENT':
      case 'CRITICAL':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-muted text-foreground';
    }
  }

  // Handle numeric priorities
  switch (priority) {
    case 1:
      return 'bg-muted text-foreground';
    case 2:
      return 'bg-blue-100 text-blue-800';
    case 3:
      return 'bg-yellow-100 text-yellow-800';
    case 4:
      return 'bg-orange-100 text-orange-800';
    case 5:
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-muted text-foreground';
  }
};

const getPriorityLabel = (priority: number | string) => {
  // Handle string priorities
  if (typeof priority === 'string') {
    switch (priority.toUpperCase()) {
      case 'LOW':
        return 'Low';
      case 'MEDIUM':
        return 'Medium';
      case 'HIGH':
        return 'High';
      case 'URGENT':
        return 'Urgent';
      case 'CRITICAL':
        return 'Critical';
      default:
        return priority; // Return the original string if not recognized
    }
  }

  // Handle numeric priorities
  switch (priority) {
    case 1:
      return 'Low';
    case 2:
      return 'Normal';
    case 3:
      return 'Medium';
    case 4:
      return 'High';
    case 5:
      return 'Critical';
    default:
      return 'Unknown';
  }
};

const getVerificationTypeColor = (type?: string) => {
  switch (type?.toLowerCase()) {
    case 'residence':
      return 'bg-green-100 text-green-800';
    case 'office':
      return 'bg-blue-100 text-blue-800';
    case 'business':
      return 'bg-purple-100 text-purple-800';
    default:
      return 'bg-muted text-foreground';
  }
};

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
              <TableHead>Area</TableHead>
              <TableHead>Rate Type</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Assigned To</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Assigned By</TableHead>
              <TableHead>Completed Date</TableHead>
              <TableHead>Outcome</TableHead>
              <TableHead className="w-[70px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[1, 2, 3, 4, 5].map((item) => (
              <TableRow key={item}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map((cell) => (
                  <TableCell key={cell}>
                    <div className="h-4 bg-muted rounded animate-pulse"></div>
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
        <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">No completed cases found</h3>
        <p className="text-muted-foreground">
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
            <TableHead>Area</TableHead>
            <TableHead>Rate Type</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Assigned To</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Product</TableHead>
            <TableHead>Assigned By</TableHead>
            <TableHead>Completed Date</TableHead>
            <TableHead>Outcome</TableHead>
            <TableHead className="w-[70px]"></TableHead>
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
                  <div className="text-sm text-muted-foreground flex items-center">
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
                <Badge className={getVerificationTypeColor(caseItem.verificationType)}>
                  {caseItem.verificationType || 'Not specified'}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="text-sm">
                  <Badge variant="outline" className="text-xs">
                    {caseItem.areaType === 'local' ? 'Local' :
                     caseItem.areaType === 'ogl' ? 'OGL' :
                     caseItem.areaType === 'outstation' ? 'Outstation' :
                     caseItem.areaType === 'standard' ? 'Standard' : 'N/A'}
                  </Badge>
                </div>
              </TableCell>
              <TableCell>
                <div className="text-sm">
                  {caseItem.rateTypeName || 'N/A'}
                </div>
              </TableCell>
              <TableCell>
                <Badge className={getPriorityColor(caseItem.priority)}>
                  {getPriorityLabel(caseItem.priority)}
                </Badge>
              </TableCell>
              <TableCell>
                <div>
                  <div className="font-medium">{caseItem.assignedToName || caseItem.assignedTo?.name || 'Unassigned'}</div>
                  <div className="text-sm text-muted-foreground">{caseItem.assignedTo?.username}</div>
                </div>
              </TableCell>
              <TableCell>
                <div>
                  <div className="font-medium">{caseItem.clientName || caseItem.client?.name}</div>
                  <div className="text-sm text-muted-foreground">{caseItem.clientCode || caseItem.client?.code}</div>
                </div>
              </TableCell>
              <TableCell>
                <div>
                  <div className="font-medium">{caseItem.productName || caseItem.product?.name || 'Not specified'}</div>
                  <div className="text-sm text-muted-foreground">{caseItem.productCode || caseItem.product?.code}</div>
                </div>
              </TableCell>
              <TableCell>
                <div>
                  <div className="font-medium">{caseItem.createdByBackendUser?.name || 'Unknown'}</div>
                  <div className="text-sm text-muted-foreground">{caseItem.createdByBackendUser?.employeeId}</div>
                </div>
              </TableCell>
              <TableCell>
                <div>
                  <div className="font-medium flex items-center">
                    <Calendar className="h-3 w-3 mr-1" />
                    {caseItem.completedAt
                      ? format(new Date(caseItem.completedAt), 'MMM dd, yyyy')
                      : format(new Date(caseItem.updatedAt), 'MMM dd, yyyy')
                    }
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {caseItem.completedAt 
                      ? formatDistanceToNow(new Date(caseItem.completedAt), { addSuffix: true })
                      : formatDistanceToNow(new Date(caseItem.updatedAt), { addSuffix: true })
                    }
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div>
                  {caseItem.verificationOutcome ? (
                    <Badge variant={caseItem.verificationOutcome.toLowerCase().includes('positive') ? 'default' : 'secondary'}>
                      {caseItem.verificationOutcome}
                    </Badge>
                  ) : (
                    <span className="text-sm text-muted-foreground">Pending review</span>
                  )}
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
