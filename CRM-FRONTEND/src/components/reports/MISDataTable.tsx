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

export function MISDataTable({
  data,
  pagination,
  onPageChange,
  isLoading: _isLoading,
}: MISDataTableProps) {
  const formatDate = (dateString: string | null) => {
    if (!dateString) {
      return '-';
    }
    try {
      return format(new Date(dateString), 'dd MMM yyyy');
    } catch {
      return '-';
    }
  };

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      COMPLETED: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
      PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
      ASSIGNED: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
      REVOKED: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400',
      ON_HOLD: 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400',
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
      HIGH: 'bg-yellow-100 text-orange-800 dark:bg-yellow-900/20 dark:text-orange-400',
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
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Verification Task
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Case ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Customer Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Pincode
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Area
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Address
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Product
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Verification Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Backend User
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Field User
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Rate Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Trigger
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Report
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Completed At
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.map((taskRow) => (
                <tr key={taskRow.taskId} className="hover:bg-green-50 transition-colors">
                  {/* 1. Verification Task Column */}
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{taskRow.taskNumber}</div>
                  </td>

                  {/* 2. Case ID Column */}
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">#{taskRow.caseNumber}</div>
                  </td>

                  {/* 3. Customer Name Column */}
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{taskRow.customerName}</div>
                  </td>

                  {/* 4. Pincode Column */}
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{taskRow.pincode || '-'}</div>
                  </td>

                  {/* 5. Area Column */}
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-600">{taskRow.areaName || '-'}</div>
                  </td>

                  {/* 6. Address Column */}
                  <td className="px-4 py-4">
                    <div className="text-sm text-gray-900 max-w-[200px] truncate">
                      {taskRow.address || '-'}
                    </div>
                  </td>

                  {/* 7. Client Column */}
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{taskRow.clientName}</div>
                    <div className="text-xs text-gray-600">{taskRow.clientCode}</div>
                  </td>

                  {/* 8. Product Column */}
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{taskRow.productName}</div>
                  </td>

                  {/* 9. Verification Type Column */}
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{taskRow.verificationTypeName}</div>
                  </td>

                  {/* 10. Backend User Column */}
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{taskRow.backendUserName || '-'}</div>
                    <div className="text-xs text-gray-600">
                      {taskRow.backendUserEmployeeId || '-'}
                    </div>
                  </td>

                  {/* 11. Field User Column */}
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{taskRow.assignedFieldUser || '-'}</div>
                    <div className="text-xs text-gray-600">
                      {taskRow.fieldUserEmployeeId || '-'}
                    </div>
                  </td>

                  {/* 12. Rate Type Column */}
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{taskRow.rateType || '-'}</div>
                  </td>

                  {/* 13. Trigger Column */}
                  <td className="px-4 py-4">
                    <div className="text-sm text-gray-900 max-w-[150px] truncate">
                      {taskRow.trigger || '-'}
                    </div>
                  </td>

                  {/* 14. Report Column */}
                  <td className="px-4 py-4 whitespace-nowrap">
                    {taskRow.formSubmissionId ? (
                      <div className="text-sm">
                        <Badge
                          variant="outline"
                          className="bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                        >
                          {taskRow.formType || 'Submitted'}
                        </Badge>
                        {taskRow.formValidationStatus && (
                          <div className="text-xs text-gray-600 mt-1">
                            {taskRow.formValidationStatus}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-600">-</div>
                    )}
                  </td>

                  {/* 15. Status Column */}
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="space-y-1">
                      {getStatusBadge(taskRow.taskStatus)}
                      {getPriorityBadge(taskRow.taskPriority)}
                    </div>
                  </td>

                  {/* 16. Created Column */}
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                    {formatDate(taskRow.taskCreatedDate)}
                  </td>

                  {/* 17. Completed At Column */}
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                    {taskRow.taskCompletionDate ? formatDate(taskRow.taskCompletionDate) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-2">
        <div className="text-sm text-gray-600">
          Showing{' '}
          <span className="font-medium">{(pagination.page - 1) * pagination.limit + 1}</span> to{' '}
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
          <span className="px-3 py-2 text-sm text-gray-600">
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
