import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { CommissionPivot, CommissionPivotCell, CommissionPivotRow } from '@/types/commission';

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

const renderCell = (cell: CommissionPivotCell | undefined) => {
  const c = cellOrEmpty(cell);
  if (!c) {
    return <td className="border-l border-border px-3 py-2 text-right text-muted-foreground">—</td>;
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

export const CommissionPivotTable: React.FC<Props> = ({ data }) => {
  const hasSubRows = data.dims.subRows != null;
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (rowId: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });

  if (data.rows.length === 0) {
    return (
      <div className="rounded-md border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        No commission rows for the selected period and dimensions.
      </div>
    );
  }

  const renderRow = (row: CommissionPivotRow) => {
    const isOpen = expanded.has(row.id);
    return (
      <React.Fragment key={row.id}>
        <tr className="bg-muted/40 font-medium">
          <td className="sticky left-0 z-10 bg-muted/40 px-3 py-2">
            {hasSubRows ? (
              <button
                type="button"
                onClick={() => toggle(row.id)}
                className="inline-flex items-center gap-1 hover:underline"
              >
                {isOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                {row.name}
              </button>
            ) : (
              row.name
            )}
          </td>
          {hasSubRows && (
            <td className="px-3 py-2 text-muted-foreground italic">
              All {data.dims.subRows?.label}
            </td>
          )}
          {data.cols.map((c) => (
            <React.Fragment key={c.id}>{renderCell(row.perCol[c.id])}</React.Fragment>
          ))}
          {renderCell(row.totals)}
        </tr>
        {hasSubRows &&
          isOpen &&
          row.subRows?.map((sub) => (
            <tr key={`${row.id}-${sub.id}`} className="bg-card">
              <td className="sticky left-0 z-10 bg-card px-3 py-2" aria-hidden="true" />
              <td className="px-3 py-2 pl-6">{sub.name}</td>
              {data.cols.map((c) => (
                <React.Fragment key={c.id}>{renderCell(sub.perCol[c.id])}</React.Fragment>
              ))}
              {renderCell(sub.totals)}
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
            <th className="sticky left-0 z-20 bg-muted px-3 py-2 text-left">
              {data.dims.rows.label}
            </th>
            {hasSubRows && <th className="px-3 py-2 text-left">{data.dims.subRows?.label}</th>}
            {data.cols.map((c) => (
              <th key={c.id} className="border-l border-border px-3 py-2 text-right">
                {c.name}
              </th>
            ))}
            <th className="border-l border-border px-3 py-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody>{data.rows.map(renderRow)}</tbody>
        <tfoot className="bg-muted/60 font-semibold">
          <tr>
            <td className="sticky left-0 z-10 bg-muted/60 px-3 py-2">Grand Total</td>
            {hasSubRows && <td className="px-3 py-2" aria-hidden="true" />}
            {data.cols.map((c) => (
              <React.Fragment key={c.id}>{renderCell(data.grandTotal.perCol[c.id])}</React.Fragment>
            ))}
            {renderCell({ amount: data.grandTotal.amount, count: data.grandTotal.count })}
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

export default CommissionPivotTable;
