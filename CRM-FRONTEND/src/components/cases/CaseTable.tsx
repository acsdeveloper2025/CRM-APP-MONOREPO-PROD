import React from 'react';
import { Link } from 'react-router-dom';
import { MobileTableCard, MobileTableField } from '@/ui/components/ResponsiveTable';
import { Badge } from '@/ui/components/Badge';
import { Button } from '@/ui/components/Button';
import { Card } from '@/ui/components/Card';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';
import { Eye } from 'lucide-react';
import { format } from 'date-fns';
import type { Case } from '@/types/case';
import {
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
  const getStatusVariant = (status?: string) => {
    switch ((status || '').toUpperCase()) {
      case 'COMPLETED':
        return 'status-completed' as const;
      case 'IN_PROGRESS':
      case 'ASSIGNED':
        return 'status-progress' as const;
      case 'REVOKED':
        return 'status-revoked' as const;
      default:
        return 'status-pending' as const;
    }
  };

  const getPriorityVariant = (priority?: number | string) => {
    const value = String(priority ?? '').toUpperCase();
    if (value === '4' || value === '5' || value === 'URGENT' || value === 'CRITICAL') {
      return 'danger' as const;
    }
    if (value === '3' || value === 'HIGH') {
      return 'warning' as const;
    }
    return 'neutral' as const;
  };

  if (isLoading) {
    return (
      <Card tone="muted" staticCard>
        <Stack gap={3}>
          {[1, 2, 3, 4, 5].map((item) => (
            <div key={item} {...{ className: "ui-summary-list__item" }}>
              <div {...{ className: "h-4 bg-slate-100 dark:bg-slate-800/60 rounded animate-pulse w-1/4" }} />
              <div {...{ className: "h-4 bg-slate-100 dark:bg-slate-800/60 rounded animate-pulse w-1/3" }} />
              <div {...{ className: "h-4 bg-slate-100 dark:bg-slate-800/60 rounded animate-pulse w-24" }} />
            </div>
          ))}
        </Stack>
      </Card>
    );
  }

  if (cases.length === 0) {
    return (
      <div {...{ className: "ui-empty-state" }}>
        <Text as="h3" variant="title">No cases found</Text>
        <Text tone="muted">No cases found matching your criteria.</Text>
      </div>
    );
  }

  return (
    <>
      <div {...{ className: "ui-operational-table hidden md:block" }} data-density="compact">
        <div {...{ className: "ui-operational-table__scroll" }}>
          <table>
            <thead>
              <tr>
                <th>Case ID</th>
                <th>Customer</th>
                <th>Client</th>
                <th>Product</th>
                <th>Verification</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Tasks</th>
                <th>Updated</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
          {cases.map((caseItem) => (
            <tr key={caseItem.id} {...{ className: "ui-operational-row" }} data-risk={(caseItem.priority === 4 || caseItem.priority === 5) ? 'true' : undefined}>
              <td>
                <Link
                  to={`/cases/${caseItem.caseId || caseItem.id}`}
                  style={{ color: 'var(--ui-accent-strong)', fontWeight: 700, textDecoration: 'none' }}
                >
                  #{caseItem.caseId || caseItem.id?.slice(-8) || 'N/A'}
                </Link>
              </td>
              <td>
                <Stack gap={1}>
                  <Text variant="body-sm">{caseItem.customerName || caseItem.applicantName}</Text>
                  <Text variant="caption" tone="muted">{caseItem.customerPhone || caseItem.applicantPhone}</Text>
                </Stack>
              </td>
              <td>
                <Text variant="body-sm">
                  {caseItem.clientName || caseItem.client?.name}
                </Text>
              </td>
              <td>
                <Text variant="body-sm">
                  {caseItem.productName || 'N/A'}
                </Text>
              </td>
              <td>
                <Text variant="body-sm">
                  {caseItem.verificationTypeName || caseItem.verificationType || 'N/A'}
                </Text>
              </td>
              <td>
                <Badge variant={getStatusVariant(caseItem.status)}>
                  {getStatusLabel(caseItem.status)}
                </Badge>
              </td>
              <td>
                <Badge variant={getPriorityVariant(caseItem.priority)}>
                  {getPriorityLabel(caseItem.priority)}
                </Badge>
              </td>
              <td>
                <Text variant="caption">
                  {caseItem.totalTasks || 0} total
                  {' / '}
                  {caseItem.completedTasks || 0} done
                  {' / '}
                  {(caseItem.pendingTasks || 0) + (caseItem.inProgressTasks || 0)} open
                </Text>
              </td>
              <td>
                <Text variant="caption" tone="muted">
                  {format(new Date(caseItem.updatedAt), 'dd MMM yyyy, hh:mm a')}
                </Text>
              </td>
              <td>
                <div {...{ className: "ui-row-actions" }}>
                <Button variant="ghost" asChild>
                  <Link to={`/cases/${caseItem.caseId || caseItem.id}`}>
                    <Eye size={14} />
                    View
                  </Link>
                </Button>
                </div>
              </td>
            </tr>
          ))}
            </tbody>
          </table>
        </div>
      </div>

      <div {...{ className: "md:hidden space-y-3" }}>
        {cases.map((caseItem) => (
          <MobileTableCard key={caseItem.id}>
            <div {...{ className: "flex justify-between items-start mb-3" }}>
              <Link
                to={`/cases/${caseItem.caseId || caseItem.id}`}
                {...{ className: "text-lg font-semibold text-primary hover:underline" }}
              >
                #{caseItem.caseId || caseItem.id?.slice(-8) || 'N/A'}
              </Link>
              <div {...{ className: "flex space-x-2" }}>
                <Badge variant={getStatusVariant(caseItem.status)}>
                  {getStatusLabel(caseItem.status)}
                </Badge>
                <Button variant="ghost" asChild>
                  <Link to={`/cases/${caseItem.caseId || caseItem.id}`}>
                    <Eye size={14} />
                    View
                  </Link>
                </Button>
              </div>
            </div>

            <MobileTableField
              label="Customer"
              value={
                <div>
                  <div {...{ className: "font-medium" }}>{caseItem.customerName || caseItem.applicantName}</div>
                  <div {...{ className: "text-xs text-gray-600" }}>{caseItem.customerPhone || caseItem.applicantPhone}</div>
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
                <Badge variant={getPriorityVariant(caseItem.priority)}>
                  {getPriorityLabel(caseItem.priority)}
                </Badge>
              }
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
