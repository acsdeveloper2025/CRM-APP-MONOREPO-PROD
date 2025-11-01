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
                Verification Task
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Case ID
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Customer Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Pincode
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Area
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Address
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Client
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Product
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Verification Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Backend User
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Field User
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Rate Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Trigger
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Report
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Created
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Completed At
              </th>
            </tr>
          </thead>
          <tbody className="bg-card divide-y divide-border">
            {data.map((taskRow) => (
              <tr key={taskRow.task_id} className="hover:bg-muted/50 transition-colors">
                {/* 1. Verification Task Column */}
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-foreground">
                    {taskRow.task_number}
                  </div>
                </td>

                {/* 2. Case ID Column */}
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-foreground">
                    #{taskRow.case_number}
                  </div>
                </td>

                {/* 3. Customer Name Column */}
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="text-sm text-foreground">
                    {taskRow.customerName}
                  </div>
                </td>

                {/* 4. Pincode Column */}
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="text-sm text-foreground">
                    {taskRow.pincode || '-'}
                  </div>
                </td>

                {/* 5. Area Column */}
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="text-sm text-muted-foreground">
                    -
                  </div>
                </td>

                {/* 6. Address Column */}
                <td className="px-4 py-4">
                  <div className="text-sm text-foreground max-w-[200px] truncate">
                    {taskRow.address || '-'}
                  </div>
                </td>

                {/* 7. Client Column */}
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="text-sm text-foreground">
                    {taskRow.client_name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {taskRow.client_code}
                  </div>
                </td>

                {/* 8. Product Column */}
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="text-sm text-foreground">
                    {taskRow.product_name}
                  </div>
                </td>

                {/* 9. Verification Type Column */}
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="text-sm text-foreground">
                    {taskRow.verification_type_name}
                  </div>
                </td>

                {/* 10. Backend User Column */}
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="text-sm text-foreground">
                    {taskRow.backend_user_name || '-'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {taskRow.backend_user_employee_id || '-'}
                  </div>
                </td>

                {/* 11. Field User Column */}
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="text-sm text-foreground">
                    {taskRow.assigned_field_user || '-'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {taskRow.field_user_employee_id || '-'}
                  </div>
                </td>

                {/* 12. Rate Type Column */}
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="text-sm text-foreground">
                    {taskRow.rate_type || '-'}
                  </div>
                </td>

                {/* 13. Trigger Column */}
                <td className="px-4 py-4">
                  <div className="text-sm text-foreground max-w-[150px] truncate">
                    {taskRow.trigger || '-'}
                  </div>
                </td>

                {/* 14. Report Column */}
                <td className="px-4 py-4 whitespace-nowrap">
                  {taskRow.form_submission_id ? (
                    <div className="text-sm">
                      <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                        {taskRow.form_type || 'Submitted'}
                      </Badge>
                      {taskRow.form_validation_status && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {taskRow.form_validation_status}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">-</div>
                  )}
                </td>

                {/* 15. Status Column */}
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="space-y-1">
                    {getStatusBadge(taskRow.task_status)}
                    {getPriorityBadge(taskRow.task_priority)}
                  </div>
                </td>

                {/* 16. Created Column */}
                <td className="px-4 py-4 whitespace-nowrap text-sm text-muted-foreground">
                  {formatDate(taskRow.task_created_date)}
                </td>

                {/* 17. Completed At Column */}
                <td className="px-4 py-4 whitespace-nowrap text-sm text-muted-foreground">
                  {taskRow.task_completion_date ? formatDate(taskRow.task_completion_date) : '-'}
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

