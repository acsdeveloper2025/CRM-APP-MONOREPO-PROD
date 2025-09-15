import React, { useState } from 'react';
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
import { MoreHorizontal, Eye, Play, UserCheck, Clock, AlertTriangle, Building2, User, ArrowUp } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Case } from '@/types/case';
import { cn } from '@/utils/cn';
import { UserSelectionModal } from './UserSelectionModal';

interface PendingCasesTableProps {
  cases: Case[];
  isLoading?: boolean;
  onUpdateStatus?: (caseId: string, status: string) => void;
  onAssignCase?: (caseId: string, userId: string) => void;
  flagOverdueCases?: boolean;
  reviewUrgentFirst?: boolean;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'PENDING':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300';
    case 'IN_PROGRESS':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

const getPriorityColor = (priority: number | string) => {
  const p = Number(priority);
  if (p >= 4) return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300';
  if (p >= 3) return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300';
  if (p >= 2) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300';
  return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
};

const getPriorityLabel = (priority: number | string) => {
  const p = Number(priority);
  if (p >= 5) return 'Critical';
  if (p >= 4) return 'Urgent';
  if (p >= 3) return 'High';
  if (p >= 2) return 'Medium';
  return 'Low';
};

const getTimeElapsed = (dateString?: string, pendingDurationSeconds?: number) => {
  // Use pendingDurationSeconds if available (from backend calculation)
  if (pendingDurationSeconds !== undefined && pendingDurationSeconds !== null) {
    const hours = Math.floor(pendingDurationSeconds / 3600);
    const minutes = Math.floor((pendingDurationSeconds % 3600) / 60);

    if (hours < 1) {
      return `${minutes}m pending`;
    } else if (hours < 24) {
      return `${hours}h pending`;
    } else {
      const days = Math.floor(hours / 24);
      const remainingHours = hours % 24;
      return remainingHours > 0 ? `${days}d ${remainingHours}h pending` : `${days}d pending`;
    }
  }

  // Fallback to original date calculation
  if (!dateString) return 'N/A';
  try {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  } catch {
    return 'N/A';
  }
};

const isOverdue = (assignedAt?: string) => {
  if (!assignedAt) return false;
  const assigned = new Date(assignedAt);
  const now = new Date();
  const diffInHours = Math.floor((now.getTime() - assigned.getTime()) / (1000 * 60 * 60));
  return diffInHours > 48; // More than 2 days
};

// New function to determine case age highlighting
const getCaseAgeHighlight = (assignedAt?: string, createdAt?: string, pendingDurationSeconds?: number) => {
  let ageInHours = 0;

  // Use pendingDurationSeconds if available (most accurate)
  if (pendingDurationSeconds !== undefined && pendingDurationSeconds !== null) {
    ageInHours = pendingDurationSeconds / 3600;
  } else {
    // Fallback to date calculation
    const referenceDate = assignedAt ? new Date(assignedAt) : (createdAt ? new Date(createdAt) : null);
    if (referenceDate) {
      const now = new Date();
      ageInHours = (now.getTime() - referenceDate.getTime()) / (1000 * 60 * 60);
    }
  }

  if (ageInHours > 24) {
    return 'red'; // More than 1 day - red highlight
  } else if (ageInHours >= 20) {
    return 'yellow'; // Close to 1 day (20+ hours) - yellow highlight
  }

  return 'none'; // Less than 20 hours - no highlight
};

export const PendingCasesTable: React.FC<PendingCasesTableProps> = ({
  cases,
  isLoading,
  onUpdateStatus,
  onAssignCase,
  flagOverdueCases = true,
  reviewUrgentFirst = true,
}) => {
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [selectedCaseForAssignment, setSelectedCaseForAssignment] = useState<Case | null>(null);

  const handleOpenUserModal = (caseItem: Case) => {
    setSelectedCaseForAssignment(caseItem);
    setIsUserModalOpen(true);
  };

  const handleUserSelection = (userId: string, userName: string) => {
    if (selectedCaseForAssignment && onAssignCase) {
      onAssignCase(selectedCaseForAssignment.id, userId);
    }
    setIsUserModalOpen(false);
    setSelectedCaseForAssignment(null);
  };

  if (isLoading) {
    return (
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Case ID</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Verification Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Assigned To</TableHead>
              <TableHead>Time Elapsed</TableHead>
              <TableHead className="w-[120px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[1, 2, 3, 4, 5].map((item) => (
              <TableRow key={item}>
                <TableCell>
                  <div className="h-4 bg-muted rounded animate-pulse"></div>
                </TableCell>
                <TableCell>
                  <div className="h-4 bg-muted rounded animate-pulse"></div>
                </TableCell>
                <TableCell>
                  <div className="h-4 bg-muted rounded animate-pulse"></div>
                </TableCell>
                <TableCell>
                  <div className="h-4 bg-muted rounded animate-pulse"></div>
                </TableCell>
                <TableCell>
                  <div className="h-4 bg-muted rounded animate-pulse"></div>
                </TableCell>
                <TableCell>
                  <div className="h-4 bg-muted rounded animate-pulse"></div>
                </TableCell>
                <TableCell>
                  <div className="h-4 bg-muted rounded animate-pulse"></div>
                </TableCell>
                <TableCell>
                  <div className="h-4 bg-muted rounded animate-pulse"></div>
                </TableCell>
                <TableCell>
                  <div className="h-4 bg-muted rounded animate-pulse"></div>
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
        <Clock className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">No Pending Cases</h3>
        <p className="text-muted-foreground">
          All cases have been completed or there are no cases assigned yet.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Case ID</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Verification Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Assigned To</TableHead>
              <TableHead>Time Elapsed</TableHead>
              <TableHead className="w-[120px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cases.map((caseItem) => {
              const urgent = reviewUrgentFirst && Number(caseItem.priority) >= 3;
              const ageHighlight = getCaseAgeHighlight(
                caseItem.assignedAt,
                caseItem.createdAt,
                (caseItem as any).pendingDurationSeconds
              );

              return (
                <TableRow
                  key={caseItem.id}
                  className={cn(
                    // Age-based highlighting with stronger colors and better contrast
                    ageHighlight === 'red' && urgent && 'bg-red-100 border-l-4 border-l-red-600 text-red-900 dark:bg-red-900/20 dark:border-l-red-400 dark:text-red-300',
                    ageHighlight === 'red' && !urgent && 'bg-red-50 border-l-4 border-l-red-500 text-red-800 dark:bg-red-900/10 dark:border-l-red-500 dark:text-red-400',
                    ageHighlight === 'yellow' && urgent && 'bg-yellow-100 border-l-4 border-l-yellow-600 text-yellow-900 dark:bg-yellow-900/20 dark:border-l-yellow-400 dark:text-yellow-300',
                    ageHighlight === 'yellow' && !urgent && 'bg-yellow-50 border-l-4 border-l-yellow-500 text-yellow-800 dark:bg-yellow-900/10 dark:border-l-yellow-500 dark:text-yellow-400',
                    // Fallback for cases without age highlighting but urgent
                    ageHighlight === 'none' && urgent && 'bg-orange-50 border-l-4 border-l-orange-500 text-orange-800 dark:bg-orange-900/10 dark:border-l-orange-500 dark:text-orange-400',
                    // Default styling for normal cases
                    ageHighlight === 'none' && !urgent && 'hover:bg-muted/50'
                  )}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center space-x-2">
                      <Link
                        to={`/cases/${caseItem.caseId || caseItem.id}`}
                        className="text-blue-600 hover:text-blue-800 hover:underline font-semibold"
                      >
                        #{caseItem.caseId || caseItem.id?.slice(-8) || 'N/A'}
                      </Link>
                      {ageHighlight === 'red' && (
                        <div title="More than 1 day old - Urgent attention needed">
                          <AlertTriangle className="h-4 w-4 text-red-500" />
                        </div>
                      )}
                      {ageHighlight === 'yellow' && (
                        <div title="Around 1 day old - Needs attention">
                          <Clock className="h-4 w-4 text-yellow-500" />
                        </div>
                      )}
                      {urgent && ageHighlight === 'none' && (
                        <div title="Urgent Case">
                          <ArrowUp className="h-4 w-4 text-orange-500" />
                        </div>
                      )}
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <div>
                      <div className="font-medium text-foreground">
                        {caseItem.customerName || 'N/A'}
                      </div>
                      {caseItem.customerPhone && (
                        <div className="text-sm text-muted-foreground">
                          {caseItem.customerPhone}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium text-foreground">
                          {caseItem.clientName || caseItem.client?.name || 'N/A'}
                        </div>
                        {(caseItem.clientCode || caseItem.client?.code) && (
                          <div className="text-sm text-muted-foreground">
                            {caseItem.clientCode || caseItem.client?.code}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <Badge variant="outline" className="text-foreground border-border">
                      {caseItem.verificationTypeName || caseItem.verificationType || 'N/A'}
                    </Badge>
                  </TableCell>
                  
                  <TableCell>
                    <Badge className={getStatusColor(caseItem.status)}>
                      {caseItem.status.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  
                  <TableCell>
                    <Badge className={getPriorityColor(caseItem.priority)}>
                      {getPriorityLabel(caseItem.priority)} ({caseItem.priority})
                    </Badge>
                  </TableCell>
                  
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium text-foreground">
                          {caseItem.assignedToName || caseItem.assignedTo?.name || 'Unassigned'}
                        </div>
                        {caseItem.assignedAt && (
                          <div className="text-sm text-muted-foreground">
                            Assigned {getTimeElapsed(caseItem.assignedAt, (caseItem as any).pendingDurationSeconds)}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <div className={cn(
                      "text-sm font-medium",
                      ageHighlight === 'red' && urgent ? "text-red-800 dark:text-red-300 font-bold" :
                      ageHighlight === 'red' ? "text-red-700 dark:text-red-400 font-semibold" :
                      ageHighlight === 'yellow' && urgent ? "text-yellow-800 dark:text-yellow-300 font-bold" :
                      ageHighlight === 'yellow' ? "text-yellow-700 dark:text-yellow-400 font-semibold" :
                      urgent ? "text-orange-700 dark:text-orange-400 font-medium" : "text-muted-foreground"
                    )}>
                      {getTimeElapsed(caseItem.assignedAt, (caseItem as any).pendingDurationSeconds)}
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
                        {caseItem.status === 'PENDING' && onUpdateStatus && (
                          <DropdownMenuItem
                            onClick={() => onUpdateStatus(caseItem.id, 'IN_PROGRESS')}
                          >
                            <Play className="mr-2 h-4 w-4" />
                            Start Progress
                          </DropdownMenuItem>
                        )}
                        {onAssignCase && (
                          <DropdownMenuItem
                            onClick={() => handleOpenUserModal(caseItem)}
                          >
                            <UserCheck className="mr-2 h-4 w-4" />
                            Reassign
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* User Selection Modal */}
      <UserSelectionModal
        isOpen={isUserModalOpen}
        onClose={() => {
          setIsUserModalOpen(false);
          setSelectedCaseForAssignment(null);
        }}
        onSelectUser={handleUserSelection}
        title="Reassign Case"
      />
    </>
  );
};
