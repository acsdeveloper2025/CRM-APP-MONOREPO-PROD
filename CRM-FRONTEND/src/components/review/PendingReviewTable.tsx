import React from 'react';
import { Link } from 'react-router-dom';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/ui/components/table';
import { Badge } from '@/ui/components/badge';
import { Button } from '@/ui/components/button';
import { Eye, Clock, User, Building2 } from 'lucide-react';
import { format } from 'date-fns';
import type { Case } from '@/types/case';
import { cn } from '@/lib/utils';

interface PendingReviewTableProps {
  cases: Case[];
  isLoading?: boolean;
  onReviewCase: (caseItem: Case) => void;
}

const getPriorityColor = (priority: number) => {
  switch (priority) {
    case 1:
      return 'bg-slate-100 text-slate-900 dark:bg-slate-800/60 dark:text-slate-100';
    case 2:
      return 'bg-green-100 text-green-800';
    case 3:
      return 'bg-yellow-100 text-yellow-800';
    case 4:
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-slate-100 text-slate-900 dark:bg-slate-800/60 dark:text-slate-100';
  }
};

const getPriorityLabel = (priority: number) => {
  switch (priority) {
    case 1:
      return 'Low';
    case 2:
      return 'Medium';
    case 3:
      return 'High';
    case 4:
      return 'Urgent';
    default:
      return 'Unknown';
  }
};

const getWaitingTime = (completedAt: string) => {
  const completed = new Date(completedAt);
  const now = new Date();
  const diffInHours = Math.floor((now.getTime() - completed.getTime()) / (1000 * 60 * 60));
  
  if (diffInHours < 24) {
    return `${diffInHours}h`;
  } else {
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d`;
  }
};

const getWaitingTimeColor = (completedAt: string) => {
  const completed = new Date(completedAt);
  const now = new Date();
  const diffInHours = Math.floor((now.getTime() - completed.getTime()) / (1000 * 60 * 60));
  
  if (diffInHours < 24) {
    return 'text-green-600';
  } else if (diffInHours < 72) {
    return 'text-yellow-600';
  } else {
    return 'text-red-600';
  }
};

export const PendingReviewTable: React.FC<PendingReviewTableProps> = ({
  cases,
  isLoading,
  onReviewCase,
}) => {
  if (isLoading) {
    return (
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Case ID</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Assigned To</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Completed</TableHead>
              <TableHead>Waiting Time</TableHead>
              <TableHead className="w-[120px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[1, 2, 3, 4, 5].map((item) => (
              <TableRow key={item}>
                <TableCell>
                  <div className="h-4 bg-slate-100 dark:bg-slate-800/60 rounded animate-pulse" />
                </TableCell>
                <TableCell>
                  <div className="h-4 bg-slate-100 dark:bg-slate-800/60 rounded animate-pulse" />
                </TableCell>
                <TableCell>
                  <div className="h-6 bg-slate-100 dark:bg-slate-800/60 rounded animate-pulse w-16" />
                </TableCell>
                <TableCell>
                  <div className="h-4 bg-slate-100 dark:bg-slate-800/60 rounded animate-pulse" />
                </TableCell>
                <TableCell>
                  <div className="h-4 bg-slate-100 dark:bg-slate-800/60 rounded animate-pulse" />
                </TableCell>
                <TableCell>
                  <div className="h-4 bg-slate-100 dark:bg-slate-800/60 rounded animate-pulse" />
                </TableCell>
                <TableCell>
                  <div className="h-4 bg-slate-100 dark:bg-slate-800/60 rounded animate-pulse w-12" />
                </TableCell>
                <TableCell>
                  <div className="h-8 bg-slate-100 dark:bg-slate-800/60 rounded animate-pulse" />
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
        <Clock className="h-12 w-12 text-gray-600 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No pending reviews</h3>
        <p className="text-gray-600">All cases have been reviewed. Great job!</p>
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
            <TableHead>Priority</TableHead>
            <TableHead>Assigned To</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Completed</TableHead>
            <TableHead>Waiting Time</TableHead>
            <TableHead className="w-[120px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cases.map((caseItem) => (
            <TableRow key={caseItem.id}>
              <TableCell className="font-medium">
                <Link
                  to={`/cases/${caseItem.id}`}
                  className="text-primary hover:underline"
                >
                  #{caseItem.id.slice(-8)}
                </Link>
              </TableCell>
              <TableCell>
                <div>
                  <div className="font-medium">{caseItem.customerName}</div>
                  <div className="text-sm text-gray-600">{caseItem.customerPhone}</div>
                </div>
              </TableCell>
              <TableCell>
                <Badge className={cn('text-xs', getPriorityColor(caseItem.priority))}>
                  {getPriorityLabel(caseItem.priority)}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex items-center space-x-2">
                  <User className="h-4 w-4 text-gray-600" />
                  <span className="text-sm">{caseItem.assignedToId || 'Unassigned'}</span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center space-x-2">
                  <Building2 className="h-4 w-4 text-gray-600" />
                  <span className="text-sm">{caseItem.client?.name}</span>
                </div>
              </TableCell>
              <TableCell>
                <div className="text-sm">
                  {caseItem.completedAt ? (
                    <>
                      <div>{format(new Date(caseItem.completedAt), 'MMM dd, yyyy')}</div>
                      <div className="text-gray-600">
                        {format(new Date(caseItem.completedAt), 'HH:mm')}
                      </div>
                    </>
                  ) : (
                    <span className="text-gray-600">Not completed</span>
                  )}
                </div>
              </TableCell>
              <TableCell>
                {caseItem.completedAt && (
                  <div className="flex items-center space-x-1">
                    <Clock className="h-4 w-4 text-gray-600" />
                    <span className={cn('text-sm font-medium', getWaitingTimeColor(caseItem.completedAt))}>
                      {getWaitingTime(caseItem.completedAt)}
                    </span>
                  </div>
                )}
              </TableCell>
              <TableCell>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                  >
                    <Link to={`/cases/${caseItem.id}`}>
                      <Eye className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => onReviewCase(caseItem)}
                  >
                    Review
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
