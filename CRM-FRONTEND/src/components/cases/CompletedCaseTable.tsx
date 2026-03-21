import React from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/ui/components/Badge';
import { Button } from '@/ui/components/Button';
import { Card } from '@/ui/components/Card';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/ui/components/DropdownMenu';
import { MoreHorizontal, Eye, Download, FileText, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import type { Case } from '@/types/case';
import {
  getPriorityLabel,
  formatBadgeLabel,
} from '@/lib/badgeStyles';

interface CompletedCaseTableProps {
  cases: Case[];
  isLoading?: boolean;
}

export const CompletedCaseTable: React.FC<CompletedCaseTableProps> = ({
  cases,
  isLoading,
}) => {
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
        <FileText size={48} style={{ color: 'var(--ui-text-soft)' }} />
        <Text as="h3" variant="title">No completed cases found</Text>
        <Text tone="muted">There are no completed cases matching your current filters.</Text>
      </div>
    );
  }

  return (
    <div {...{ className: "ui-operational-table" }} data-density="compact">
      <div {...{ className: "ui-operational-table__scroll" }}>
        <table>
          <thead>
            <tr>
              <th>Case ID</th>
              <th>Customer</th>
              <th>Verification Type</th>
              <th>Priority</th>
              <th>Client</th>
              <th>Product</th>
              <th>Assigned By</th>
              <th>Completed</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
          {cases.map((caseItem) => (
            <tr key={caseItem.id} {...{ className: "ui-operational-row" }}>
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
                  <Text variant="body-sm">{caseItem.customerName}</Text>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--ui-text-muted)', fontSize: '0.8rem' }}>
                    {caseItem.customerPhone && (
                      <span {...{ className: "mr-2" }}>{caseItem.customerPhone}</span>
                    )}
                    {caseItem.addressCity && (
                      <span {...{ className: "flex items-center" }}>
                        <MapPin size={12} style={{ marginRight: '4px' }} />
                        {caseItem.addressCity}
                      </span>
                    )}
                  </div>
                </Stack>
              </td>
              <td>
                <Badge variant="accent">
                  {formatBadgeLabel(caseItem.verificationType || 'Not specified')}
                </Badge>
              </td>
              <td>
                <Badge variant={getPriorityVariant(caseItem.priority)}>
                  {getPriorityLabel(caseItem.priority)}
                </Badge>
              </td>
              <td>
                <Stack gap={1}>
                  <Text variant="body-sm">{caseItem.clientName || caseItem.client?.name}</Text>
                  <Text variant="caption" tone="muted">{caseItem.clientCode || caseItem.client?.code}</Text>
                </Stack>
              </td>
              <td>
                <Stack gap={1}>
                  <Text variant="body-sm">{caseItem.productName || caseItem.product?.name || 'Not specified'}</Text>
                  <Text variant="caption" tone="muted">{caseItem.productCode || caseItem.product?.code}</Text>
                </Stack>
              </td>
              <td>
                <Stack gap={1}>
                  <Text variant="body-sm">{caseItem.createdByBackendUser?.name || 'Unknown'}</Text>
                  <Text variant="caption" tone="muted">{caseItem.createdByBackendUser?.employeeId}</Text>
                </Stack>
              </td>
              <td>
                <Text variant="caption" tone="muted">
                  {caseItem.completedAt
                    ? format(new Date(caseItem.completedAt), 'dd MMM yyyy')
                    : format(new Date(caseItem.updatedAt), 'dd MMM yyyy')
                  }
                </Text>
              </td>
              <td>
                <div {...{ className: "ui-row-actions" }}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost">
                      <span {...{ className: "sr-only" }}>Open menu</span>
                      <MoreHorizontal size={14} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuItem asChild>
                      <Link to={`/cases/${caseItem.caseId || caseItem.id}`}>
                        <Eye {...{ className: "mr-2 h-4 w-4" }} />
                        View Details
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>
                      <Download {...{ className: "mr-2 h-4 w-4" }} />
                      Download Report
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <FileText {...{ className: "mr-2 h-4 w-4" }} />
                      View Attachments
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                </div>
              </td>
            </tr>
          ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
