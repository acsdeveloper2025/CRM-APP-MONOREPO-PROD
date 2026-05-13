import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table';

interface TableSkeletonProps {
  /** Column header labels — define how many columns and what they're called.
   *  Empty string = blank header cell (e.g. for the row-action column). */
  headers: string[];
  /** Number of placeholder rows to render. Default 5. */
  count?: number;
  /** Optional Tailwind width class per column (e.g. "w-20", "w-32") so the
   *  skeleton bars match the natural shape of the real cell content.
   *  Length should match `headers.length`; missing entries fall back to a
   *  full-cell-width bar. */
  widthHints?: (string | undefined)[];
  /** Optional className for the outer wrapper (matches caller's table wrapper). */
  className?: string;
}

/**
 * Drop-in replacement for centered spinners on data tables.
 *
 * Renders the same shadcn `<Table>` shell with the real `<TableHeader>` so
 * column widths are computed identically — no layout jump when real rows
 * arrive. The body is `count` rows of pulsing gray bars, each cell uses the
 * matching `widthHints` entry or stretches full-cell-width otherwise.
 *
 * Rows are `aria-hidden` so screen readers don't announce the placeholders.
 */
export const TableSkeleton: React.FC<TableSkeletonProps> = ({
  headers,
  count = 5,
  widthHints,
  className = 'border rounded-lg',
}) => {
  return (
    <div className={className}>
      <Table>
        <TableHeader>
          <TableRow>
            {headers.map((label, i) => (
              <TableHead key={`th-${i}`}>{label}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: count }).map((_, rowIdx) => (
            <TableRow key={`sk-${rowIdx}`} aria-hidden="true">
              {headers.map((_, colIdx) => {
                const widthClass = widthHints?.[colIdx] ?? '';
                return (
                  <TableCell key={`sk-${rowIdx}-${colIdx}`}>
                    <div
                      className={`h-4 ${widthClass} max-w-full bg-slate-100 dark:bg-slate-800/60 rounded animate-pulse`}
                    />
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
