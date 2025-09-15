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
import { MoreHorizontal, Eye, Edit, UserCheck } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Case } from '@/types/case';
import { cn } from '@/utils/cn';
import { UserSelectionModal } from './UserSelectionModal';

interface CaseTableProps {
  cases: Case[];
  isLoading?: boolean;
  onUpdateStatus?: (caseId: string, status: string) => void;
  onAssignCase?: (caseId: string, userId: string) => void;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'ASSIGNED':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300';
    case 'IN_PROGRESS':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300';
    case 'COMPLETED':
      return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

const getPriorityColor = (priority: number | string) => {
  const priorityNum = typeof priority === 'string' ?
    (priority === 'LOW' ? 1 : priority === 'MEDIUM' ? 2 : priority === 'HIGH' ? 3 : priority === 'URGENT' ? 4 : parseInt(priority))
    : priority;

  switch (priorityNum) {
    case 1:
      return 'bg-muted text-muted-foreground';
    case 2:
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300';
    case 3:
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300';
    case 4:
      return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

const getPriorityLabel = (priority: number | string) => {
  const priorityNum = typeof priority === 'string' ?
    (priority === 'LOW' ? 1 : priority === 'MEDIUM' ? 2 : priority === 'HIGH' ? 3 : priority === 'URGENT' ? 4 : parseInt(priority))
    : priority;

  switch (priorityNum) {
    case 1:
      return 'Low';
    case 2:
      return 'Medium';
    case 3:
      return 'High';
    case 4:
      return 'Urgent';
    default:
      return typeof priority === 'string' ? priority : 'Unknown';
  }
};

export const CaseTable: React.FC<CaseTableProps> = ({
  cases,
  isLoading,
  onUpdateStatus,
  onAssignCase,
}) => {
  // State for user selection modal
  const [isUserModalOpen, setIsUserModalOpen] = React.useState(false);
  const [selectedCaseForAssignment, setSelectedCaseForAssignment] = React.useState<Case | null>(null);

  // Handle opening user selection modal
  const handleOpenUserModal = (caseItem: Case) => {
    setSelectedCaseForAssignment(caseItem);
    setIsUserModalOpen(true);
  };

  // Handle user selection from modal
  const handleUserSelection = (userId: string) => {
    if (selectedCaseForAssignment && onAssignCase) {
      onAssignCase(selectedCaseForAssignment.id, userId);
    }
    setIsUserModalOpen(false);
    setSelectedCaseForAssignment(null);
  };

  // Handle modal close
  const handleCloseUserModal = () => {
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
              <TableHead>Product</TableHead>
              <TableHead>Verification Type</TableHead>
              <TableHead>Area</TableHead>
              <TableHead>Rate Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Assigned To</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="w-[70px]"></TableHead>
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
                  <div className="h-6 bg-muted rounded animate-pulse w-20"></div>
                </TableCell>
                <TableCell>
                  <div className="h-6 bg-muted rounded animate-pulse w-16"></div>
                </TableCell>
                <TableCell>
                  <div className="h-6 bg-muted rounded animate-pulse w-16"></div>
                </TableCell>
                <TableCell>
                  <div className="h-6 bg-muted rounded animate-pulse w-16"></div>
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
                  <div className="h-8 w-8 bg-muted rounded animate-pulse"></div>
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
        <p className="text-muted-foreground">No cases found matching your criteria.</p>
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
            <TableHead>Client</TableHead>
            <TableHead>Product</TableHead>
            <TableHead>Verification Type</TableHead>
            <TableHead>Area</TableHead>
            <TableHead>Rate Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Assigned To</TableHead>
            <TableHead>Updated</TableHead>
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
                  <div className="font-medium">{caseItem.customerName || caseItem.applicantName}</div>
                  <div className="text-sm text-muted-foreground">{caseItem.customerPhone || caseItem.applicantPhone}</div>
                </div>
              </TableCell>
              <TableCell>
                <div className="text-sm">
                  {caseItem.clientName || caseItem.client?.name}
                </div>
              </TableCell>
              <TableCell>
                <div className="text-sm">
                  {caseItem.productName || 'N/A'}
                </div>
              </TableCell>
              <TableCell>
                <div className="text-sm">
                  {caseItem.verificationTypeName || caseItem.verificationType || 'N/A'}
                </div>
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
                <Badge className={cn('text-xs', getStatusColor(caseItem.status))}>
                  {caseItem.status.replace('_', ' ')}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge className={cn('text-xs', getPriorityColor(caseItem.priority))}>
                  {getPriorityLabel(caseItem.priority)}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="text-sm">
                  {caseItem.assignedToName || caseItem.assignedTo?.name || 'Unassigned'}
                </div>
              </TableCell>
              <TableCell>
                <div className="text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(caseItem.updatedAt), { addSuffix: true })}
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
                    <DropdownMenuItem asChild>
                      <Link to={`/cases/new?edit=${caseItem.caseId || caseItem.id}`}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit Case
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {onAssignCase && (
                      <DropdownMenuItem onClick={() => handleOpenUserModal(caseItem)}>
                        <UserCheck className="mr-2 h-4 w-4" />
                        Assign to Field Agent
                      </DropdownMenuItem>
                    )}
                    {onUpdateStatus && caseItem.status !== 'COMPLETED' && (
                      <DropdownMenuItem onClick={() => onUpdateStatus(caseItem.id, 'COMPLETED')}>
                        Mark Complete
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* User Selection Modal */}
      <UserSelectionModal
        isOpen={isUserModalOpen}
        onClose={handleCloseUserModal}
        onSelectUser={handleUserSelection}
        currentAssignedUserId={selectedCaseForAssignment?.assignedTo}
        title="Assign Case to Field Agent"
      />
    </div>
  );
};
