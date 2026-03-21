import { format } from 'date-fns';
import { Badge } from '@/ui/components/badge';
import { Button } from '@/ui/components/button';
import { Box } from '@/ui/primitives/Box';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';
import type { MISPagination, MISTaskRowData } from '@/types/mis';

interface MISDataTableProps {
  data: MISTaskRowData[];
  pagination: MISPagination;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
}

const cellStyle = {
  padding: '0.85rem 1rem',
  borderBottom: '1px solid var(--ui-border)',
  verticalAlign: 'top' as const,
};

export function MISDataTable({ data, pagination, onPageChange }: MISDataTableProps) {
  const formatDate = (dateString: string | null) => {
    if (!dateString) {return '-';}
    try {
      return format(new Date(dateString), 'dd MMM yyyy');
    } catch {
      return '-';
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === 'COMPLETED') {return <Badge variant="status-completed">{status}</Badge>;}
    if (status === 'PENDING') {return <Badge variant="status-pending">{status}</Badge>;}
    if (status === 'ASSIGNED' || status === 'IN_PROGRESS') {return <Badge variant="status-progress">{status}</Badge>;}
    if (status === 'REVOKED') {return <Badge variant="status-revoked">{status}</Badge>;}
    if (status === 'ON_HOLD') {return <Badge variant="warning">{status}</Badge>;}
    return <Badge variant="neutral">{status}</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    if (priority === 'URGENT') {return <Badge variant="danger">{priority}</Badge>;}
    if (priority === 'HIGH') {return <Badge variant="warning">{priority}</Badge>;}
    if (priority === 'MEDIUM') {return <Badge variant="info">{priority}</Badge>;}
    if (priority === 'LOW') {return <Badge variant="positive">{priority}</Badge>;}
    return <Badge variant="neutral">{priority}</Badge>;
  };

  return (
    <Stack gap={4}>
      <Box style={{ border: '1px solid var(--ui-border)', borderRadius: 'var(--ui-radius-lg)', overflow: 'hidden' }}>
        <Box style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: '1800px', borderCollapse: 'collapse', background: 'var(--ui-surface)' }}>
            <thead style={{ background: 'var(--ui-surface-muted)' }}>
              <tr>
                {[
                  'Verification Task',
                  'Case ID',
                  'Customer Name',
                  'Pincode',
                  'Area',
                  'Address',
                  'Client',
                  'Product',
                  'Verification Type',
                  'Backend User',
                  'Field User',
                  'Rate Type',
                  'Trigger',
                  'Report',
                  'Status',
                  'Created',
                  'Completed At',
                ].map((header) => (
                  <th
                    key={header}
                    style={{
                      ...cellStyle,
                      textAlign: 'left',
                      fontSize: '0.75rem',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: 'var(--ui-text-muted)',
                      fontWeight: 700,
                    }}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((taskRow) => (
                <tr key={taskRow.task_id}>
                  <td style={cellStyle}><Text variant="body-sm">{taskRow.task_number}</Text></td>
                  <td style={cellStyle}><Text variant="body-sm">#{taskRow.case_number}</Text></td>
                  <td style={cellStyle}><Text variant="body-sm">{taskRow.customerName}</Text></td>
                  <td style={cellStyle}><Text variant="body-sm">{taskRow.pincode || '-'}</Text></td>
                  <td style={cellStyle}><Text variant="body-sm" tone="muted">{taskRow.area_name || '-'}</Text></td>
                  <td style={cellStyle}><Text variant="body-sm">{taskRow.address || '-'}</Text></td>
                  <td style={cellStyle}>
                    <Stack gap={0}>
                      <Text variant="body-sm">{taskRow.client_name}</Text>
                      <Text variant="caption" tone="muted">{taskRow.client_code}</Text>
                    </Stack>
                  </td>
                  <td style={cellStyle}><Text variant="body-sm">{taskRow.product_name}</Text></td>
                  <td style={cellStyle}><Text variant="body-sm">{taskRow.verification_type_name}</Text></td>
                  <td style={cellStyle}>
                    <Stack gap={0}>
                      <Text variant="body-sm">{taskRow.backend_user_name || '-'}</Text>
                      <Text variant="caption" tone="muted">{taskRow.backend_user_employee_id || '-'}</Text>
                    </Stack>
                  </td>
                  <td style={cellStyle}>
                    <Stack gap={0}>
                      <Text variant="body-sm">{taskRow.assigned_field_user || '-'}</Text>
                      <Text variant="caption" tone="muted">{taskRow.field_user_employee_id || '-'}</Text>
                    </Stack>
                  </td>
                  <td style={cellStyle}><Text variant="body-sm">{taskRow.rate_type || '-'}</Text></td>
                  <td style={cellStyle}><Text variant="body-sm">{taskRow.trigger || '-'}</Text></td>
                  <td style={cellStyle}>
                    {taskRow.form_submission_id ? (
                      <Stack gap={1}>
                        <Badge variant="positive">{taskRow.form_type || 'Submitted'}</Badge>
                        {taskRow.form_validation_status ? (
                          <Text variant="caption" tone="muted">{taskRow.form_validation_status}</Text>
                        ) : null}
                      </Stack>
                    ) : (
                      <Text variant="body-sm" tone="muted">-</Text>
                    )}
                  </td>
                  <td style={cellStyle}>
                    <Stack gap={1}>
                      {getStatusBadge(taskRow.task_status)}
                      {getPriorityBadge(taskRow.task_priority)}
                    </Stack>
                  </td>
                  <td style={cellStyle}><Text variant="body-sm" tone="muted">{formatDate(taskRow.task_created_date)}</Text></td>
                  <td style={cellStyle}><Text variant="body-sm" tone="muted">{taskRow.task_completion_date ? formatDate(taskRow.task_completion_date) : '-'}</Text></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Box>
      </Box>

      <Box style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', paddingInline: '0.25rem' }}>
        <Text variant="body-sm" tone="muted">
          Showing <strong>{(pagination.page - 1) * pagination.limit + 1}</strong> to{' '}
          <strong>{Math.min(pagination.page * pagination.limit, pagination.total)}</strong> of{' '}
          <strong>{pagination.total}</strong> tasks
        </Text>
        <Stack direction="horizontal" gap={2} align="center" wrap="wrap">
          <Button onClick={() => onPageChange(pagination.page - 1)} disabled={pagination.page === 1} variant="outline">
            Previous
          </Button>
          <Text variant="body-sm" tone="muted">Page {pagination.page} of {pagination.totalPages}</Text>
          <Button onClick={() => onPageChange(pagination.page + 1)} disabled={pagination.page >= pagination.totalPages} variant="outline">
            Next
          </Button>
        </Stack>
      </Box>
    </Stack>
  );
}
