import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { CommissionPivot, CommissionPivotCell, CommissionPivotUser } from '@/types/commission';

interface Props {
  data: CommissionPivot;
}

const fmtAmount = (n: number) =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n);

const cellOrEmpty = (cell: CommissionPivotCell | undefined) => {
  if (!cell || (cell.amount === 0 && cell.count === 0)) {
    return null;
  }
  return cell;
};

export const CommissionPivotTable: React.FC<Props> = ({ data }) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (userId: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });

  if (data.users.length === 0) {
    return (
      <div className="rounded-md border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        No commission rows for the selected period.
      </div>
    );
  }

  const renderCell = (cell: CommissionPivotCell | undefined) => {
    const c = cellOrEmpty(cell);
    if (!c) {
      return (
        <td className="border-l border-border px-3 py-2 text-right text-muted-foreground">—</td>
      );
    }
    return (
      <td className="border-l border-border px-3 py-2 text-right">
        <div className="font-medium tabular-nums">₹{fmtAmount(c.amount)}</div>
        <div className="text-xs text-muted-foreground tabular-nums">
          {c.count} customer{c.count === 1 ? '' : 's'}
        </div>
      </td>
    );
  };

  const renderUserRow = (user: CommissionPivotUser) => {
    const isOpen = expanded.has(user.userId);
    return (
      <React.Fragment key={user.userId}>
        <tr className="bg-muted/40 font-medium">
          <td className="sticky left-0 z-10 bg-muted/40 px-3 py-2">
            <button
              type="button"
              onClick={() => toggle(user.userId)}
              className="inline-flex items-center gap-1 hover:underline"
            >
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              {user.userName}
            </button>
          </td>
          <td className="px-3 py-2 text-muted-foreground italic">All rate types</td>
          {data.clients.map((c) => (
            <React.Fragment key={c.id}>{renderCell(user.perClient[String(c.id)])}</React.Fragment>
          ))}
          {renderCell(user.totals)}
        </tr>
        {isOpen &&
          user.rateTypes.map((rt) => (
            <tr key={`${user.userId}-${rt.rateTypeId}`} className="bg-card">
              <td className="sticky left-0 z-10 bg-card px-3 py-2" aria-hidden="true" />
              <td className="px-3 py-2 pl-6">{rt.rateTypeName}</td>
              {data.clients.map((c) => (
                <React.Fragment key={c.id}>{renderCell(rt.perClient[String(c.id)])}</React.Fragment>
              ))}
              {renderCell(rt.totals)}
            </tr>
          ))}
      </React.Fragment>
    );
  };

  return (
    <div className="overflow-x-auto rounded-md border border-border bg-card">
      <table className="min-w-full text-sm">
        <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="sticky left-0 z-20 bg-muted px-3 py-2 text-left">Field Executive</th>
            <th className="px-3 py-2 text-left">Rate Type</th>
            {data.clients.map((c) => (
              <th key={c.id} className="border-l border-border px-3 py-2 text-right">
                {c.name}
              </th>
            ))}
            <th className="border-l border-border px-3 py-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody>{data.users.map(renderUserRow)}</tbody>
        <tfoot className="bg-muted/60 font-semibold">
          <tr>
            <td className="sticky left-0 z-10 bg-muted/60 px-3 py-2">Grand Total</td>
            <td className="px-3 py-2" aria-hidden="true" />
            {data.clients.map((c) => (
              <React.Fragment key={c.id}>
                {renderCell(data.grandTotal.perClient[String(c.id)])}
              </React.Fragment>
            ))}
            {renderCell({ amount: data.grandTotal.amount, count: data.grandTotal.count })}
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

export default CommissionPivotTable;
