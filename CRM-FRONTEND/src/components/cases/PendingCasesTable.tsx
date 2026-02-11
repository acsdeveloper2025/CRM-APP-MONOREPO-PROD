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
import { cn } from '@/lib/utils';
import { UserSelectionModal } from './UserSelectionModal';
import {
  getVerificationTypeBadgeStyle,
  getStatusBadgeStyle,
  getPriorityBadgeStyle,
  getPriorityLabel,
  getStatusLabel,
  formatBadgeLabel,
} from '@/lib/badgeStyles';

interface PendingCasesTableProps {
  cases: Case[];
  isLoading?: boolean;
  onUpdateStatus?: (caseId: string, status: string) => void;
  onAssignCase?: (caseId: string, userId: string) => void;
  flagOverdueCases?: boolean;
  reviewUrgentFirst?: boolean;
}

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
  if (!dateString) {return 'N/A';}
  try {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  } catch {
    return 'N/A';
  }
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
  flagOverdueCases: _flagOverdueCases = true,
  reviewUrgentFirst = true,
}) => {
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [selectedCaseForAssignment, setSelectedCaseForAssignment] = useState<Case | null>(null);

  const handleOpenUserModal = (caseItem: Case) => {
    setSelectedCaseForAssignment(caseItem);
    setIsUserModalOpen(true);
  };

  const handleUserSelection = (userId: string, _userName: string) => {
    if (selectedCaseForAssignment && onAssignCase) {
      onAssignCase(selectedCaseForAssignment.id, userId);
    }
    setIsUserModalOpen(false);
    setSelectedCaseForAssignment(null);
  };

  if (isLoading) {
    return (
      <div className="border rounded-lg bg-black">
        <Table>
          <TableHeader>
            <TableRow className="bg-black border-gray-700">
              <TableHead className="text-white">Case ID</TableHead>
              <TableHead className="text-white">Customer</TableHead>
              <TableHead className="text-white">Client</TableHead>
              <TableHead className="text-white">Verification Type</TableHead>
              <TableHead className="text-white">Status</TableHead>
              <TableHead className="text-white">Priority</TableHead>
              <TableHead className="text-white">Assigned To</TableHead>
              <TableHead className="text-white">Time Elapsed</TableHead>
              <TableHead className="w-[120px] text-white">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[1, 2, 3, 4, 5].map((item) => (
              <TableRow key={item} className="bg-black border-gray-700">
                <TableCell>
                  <div className="h-4 bg-gray-600 rounded animate-pulse" />
                </TableCell>
                <TableCell>
                  <div className="h-4 bg-gray-600 rounded animate-pulse" />
                </TableCell>
                <TableCell>
                  <div className="h-4 bg-gray-600 rounded animate-pulse" />
                </TableCell>
                <TableCell>
                  <div className="h-4 bg-gray-600 rounded animate-pulse" />
                </TableCell>
                <TableCell>
                  <div className="h-4 bg-gray-600 rounded animate-pulse" />
                </TableCell>
                <TableCell>
                  <div className="h-4 bg-gray-600 rounded animate-pulse" />
                </TableCell>
                <TableCell>
                  <div className="h-4 bg-gray-600 rounded animate-pulse" />
                </TableCell>
                <TableCell>
                  <div className="h-4 bg-gray-600 rounded animate-pulse" />
                </TableCell>
                <TableCell>
                  <div className="h-4 bg-muted rounded animate-pulse" />
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
        <Clock className="mx-auto h-12 w-12 text-gray-600 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Pending Cases</h3>
        <p className="text-gray-600">
          All cases have been completed or there are no cases assigned yet.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="border rounded-lg bg-black">
        <Table>
          <TableHeader>
            <TableRow className="bg-black border-gray-700">
              <TableHead className="text-white">Case ID</TableHead>
              <TableHead className="text-white">Customer</TableHead>
              <TableHead className="text-white">Client</TableHead>
              <TableHead className="text-white">Verification Type</TableHead>
              <TableHead className="text-white">Status</TableHead>
              <TableHead className="text-white">Priority</TableHead>
              <TableHead className="text-white">Assigned To</TableHead>
              <TableHead className="text-white">Time Elapsed</TableHead>
              <TableHead className="w-[120px] text-white">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cases.map((caseItem) => {
              const urgent = reviewUrgentFirst && Number(caseItem.priority) >= 3;
              // Use renaming to avoid unused var warning if we decide to change implementation later, currently logic uses _flagOverdueCases
              // const shouldFlag = _flagOverdueCases;

              const ageHighlight = getCaseAgeHighlight(
                undefined, // assignedAt is deprecated
                caseItem.createdAt,
                caseItem.pendingDurationSeconds
              );

              // Assignment fields are deprecated - assignments now handled at verification task level
              const assignedName = 'Unassigned';

              return (
                <TableRow
                  key={caseItem.id}
                  className={cn(
                    // Base black background with white text
                    'bg-black text-white border-gray-700',
                    // Age-based highlighting with darker colors for black background
                    ageHighlight === 'red' && urgent && 'bg-red-900 border-l-4 border-l-red-400 text-red-100',
                    ageHighlight === 'red' && !urgent && 'bg-red-800 border-l-4 border-l-red-500 text-red-200',
                    ageHighlight === 'yellow' && urgent && 'bg-yellow-900 border-l-4 border-l-yellow-400 text-yellow-100',
                    ageHighlight === 'yellow' && !urgent && 'bg-yellow-800 border-l-4 border-l-yellow-500 text-yellow-200',
                    // Fallback for cases without age highlighting but urgent
                    ageHighlight === 'none' && urgent && 'bg-orange-900 border-l-4 border-l-orange-500 text-orange-100',
                    // Default styling for normal cases
                    ageHighlight === 'none' && !urgent && 'hover:bg-gray-800'
                  )}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center space-x-2">
                      <Link
                        to={`/cases/${caseItem.caseId || caseItem.id}`}
                        className="text-blue-300 hover:text-blue-100 hover:underline font-semibold"
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
                          <ArrowUp className="h-4 w-4 text-yellow-500" />
                        </div>
                      )}
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <div>
                      <div className="font-medium text-gray-900">
                        {caseItem.customerName || 'N/A'}
                      </div>
                      {caseItem.customerPhone && (
                        <div className="text-sm text-gray-600">
                          {caseItem.customerPhone}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Building2 className="h-4 w-4 text-gray-600" />
                      <div>
                        <div className="font-medium text-gray-900">
                          {caseItem.clientName || caseItem.client?.name || 'N/A'}
                        </div>
                        {(caseItem.clientCode || caseItem.client?.code) && (
                          <div className="text-sm text-gray-600">
                            {caseItem.clientCode || caseItem.client?.code}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>
                    <Badge className={getVerificationTypeBadgeStyle(caseItem.verificationType)}>
                      {formatBadgeLabel(caseItem.verificationTypeName || caseItem.verificationType || 'N/A')}
                    </Badge>
                  </TableCell>

                  <TableCell>
                    <Badge className={getStatusBadgeStyle(caseItem.status)}>
                      {getStatusLabel(caseItem.status)}
                    </Badge>
                  </TableCell>

                  <TableCell>
                    <Badge className={getPriorityBadgeStyle(caseItem.priority)}>
                      {getPriorityLabel(caseItem.priority)}
                    </Badge>
                  </TableCell>
                  
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <User className="h-4 w-4 text-gray-600" />
                      <div>
                        <div className="font-medium text-gray-900">
                          {/* assignedTo and assignedToName are deprecated on Case */}
                          {assignedName}
                        </div>
                        {/* assignedAt is deprecated */}
                        {caseItem.pendingDurationSeconds && (
                          <div className="text-sm text-gray-600">
                            Assigned {getTimeElapsed(undefined, caseItem.pendingDurationSeconds)}
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
                      urgent ? "text-orange-700 dark:text-orange-400 font-medium" : "text-gray-600"
                    )}>
                      {getTimeElapsed(undefined, caseItem.pendingDurationSeconds)}
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
