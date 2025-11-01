import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { MISTaskRowData, MISPagination } from '@/types/mis';
import { format } from 'date-fns';

interface MISDataTableProps {
  data: MISTaskRowData[];
  pagination: MISPagination;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
}

export function MISDataTable({ data, pagination, onPageChange, isLoading }: MISDataTableProps) {

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    try {
      return format(new Date(dateString), 'dd MMM yyyy');
    } catch {
      return '-';
    }
  };

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      COMPLETED: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
      APPROVED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400',
      IN_PROGRESS: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
      PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
      ASSIGNED: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400',
      REJECTED: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
      CANCELLED: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400',
    };

    return (
      <Badge variant="outline" className={statusColors[status] || 'bg-gray-100 text-gray-800'}>
        {status}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const priorityColors: Record<string, string> = {
      URGENT: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
      HIGH: 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400',
      MEDIUM: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
      LOW: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
    };

    return (
      <Badge variant="outline" className={priorityColors[priority] || 'bg-gray-100 text-gray-800'}>
        {priority}
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      {/* Data Table - TASK-CENTRIC */}
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Task
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Verification Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Field Agent
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Amount
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Case
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Customer
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Client
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Created
              </th>
            </tr>
          </thead>
          <tbody className="bg-card divide-y divide-border">
            {data.map((taskRow) => (
              <tr key={taskRow.task_id} className="hover:bg-muted/50 transition-colors">
                {/* Task Column */}
                <td className="px-4 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-foreground">
                      {taskRow.task_number}
                    </div>
                    <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                      {taskRow.task_title}
                    </div>
                  </div>
                </td>

                {/* Verification Type Column */}
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="text-sm text-foreground">
                    {taskRow.verification_type_name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {taskRow.rate_type}
                  </div>
                </td>

                {/* Status Column */}
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="space-y-1">
                    {getStatusBadge(taskRow.task_status)}
                    {getPriorityBadge(taskRow.task_priority)}
                  </div>
                </td>

                {/* Field Agent Column */}
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="text-sm text-foreground">
                    {taskRow.assigned_field_user || '-'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {taskRow.field_user_employee_id || '-'}
                  </div>
                </td>

                {/* Amount Column */}
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-foreground">
                    ₹{taskRow.actual_amount?.toLocaleString() || 0}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Est: ₹{taskRow.estimated_amount?.toLocaleString() || 0}
                  </div>
                </td>

                {/* Case Column */}
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-foreground">
                    #{taskRow.case_number}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {taskRow.product_name}
                  </div>
                </td>

                {/* Customer Column */}
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="text-sm text-foreground">
                    {taskRow.customerName}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {taskRow.customerCallingCode} {taskRow.customerPhone}
                  </div>
                </td>

                {/* Client Column */}
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="text-sm text-foreground">
                    {taskRow.client_name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {taskRow.client_code}
                  </div>
                </td>

                {/* Created Column */}
                <td className="px-4 py-4 whitespace-nowrap text-sm text-muted-foreground">
                  {formatDate(taskRow.task_created_date)}
                </td>
              </tr>
            ))}

          </tbody>
        </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-2">
        <div className="text-sm text-muted-foreground">
          Showing <span className="font-medium">{(pagination.page - 1) * pagination.limit + 1}</span> to{' '}
          <span className="font-medium">
            {Math.min(pagination.page * pagination.limit, pagination.total)}
          </span>{' '}
          of <span className="font-medium">{pagination.total}</span> tasks
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => onPageChange(pagination.page - 1)}
            disabled={pagination.page === 1}
            variant="outline"
            size="sm"
          >
            Previous
          </Button>
          <span className="px-3 py-2 text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <Button
            onClick={() => onPageChange(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages}
            variant="outline"
            size="sm"
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

