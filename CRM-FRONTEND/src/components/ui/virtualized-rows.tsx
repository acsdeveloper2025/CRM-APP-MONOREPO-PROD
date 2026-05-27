import type { ReactNode, CSSProperties, RefObject } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

// P4 truthful-sweep 2026-05-27: shared row-virtualization wrapper.
// Drop-in for any list page whose row count can exceed ~500. Renders
// only the rows currently in the scroll viewport (+ overscan) so the
// DOM cell count stays bounded regardless of dataset size.
//
// Why not a full DataTable wrapper? The existing list pages each have
// their own Table layout (sortable columns, custom cells, action menus).
// Wrapping the Table primitive would require a heavy migration. Instead,
// we ship a transparent `<VirtualizedRows>` body component that consumers
// drop INTO their existing <Table><TableBody>…</TableBody></Table> shell.
// The caller passes `items` + a `renderRow` that returns a <TableRow>;
// we render only the visible slice and pad with spacer rows so the
// scroll height + scrollbar match the full dataset.
//
// Usage:
//   <div ref={parentRef} className="overflow-auto" style={{ height: 600 }}>
//     <Table>
//       <TableHeader>…</TableHeader>
//       <VirtualizedRows
//         parentRef={parentRef}
//         items={rows}
//         estimateRowHeight={56}
//         renderRow={(row) => (
//           <TableRow key={row.id}>…</TableRow>
//         )}
//       />
//     </Table>
//   </div>

type VirtualizedRowsProps<T> = {
  parentRef: RefObject<HTMLElement | null>;
  items: T[];
  estimateRowHeight: number;
  renderRow: (item: T, index: number) => ReactNode;
  overscan?: number;
  // Provide a stable id per item if possible (better scroll behavior on
  // dataset mutation). Defaults to index.
  getItemKey?: (item: T, index: number) => string | number;
};

export function VirtualizedRows<T>({
  parentRef,
  items,
  estimateRowHeight,
  renderRow,
  overscan = 10,
  getItemKey,
}: VirtualizedRowsProps<T>) {
  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateRowHeight,
    overscan,
    getItemKey: getItemKey ? (index: number) => getItemKey(items[index], index) : undefined,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();
  const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
  const paddingBottom =
    virtualItems.length > 0 ? totalSize - virtualItems[virtualItems.length - 1].end : 0;

  // tbody emits these spacer rows so the parent scrollbar reflects full
  // dataset height. Padding rows MUST be in the same tbody to keep the
  // table layout intact.
  const spacerStyle = (height: number): CSSProperties => ({
    height,
    padding: 0,
    border: 0,
  });

  return (
    <>
      {paddingTop > 0 && (
        <tr aria-hidden="true">
          <td
            style={spacerStyle(paddingTop)}
            colSpan={9999}
            aria-label="virtualized scroll padding"
          />
        </tr>
      )}
      {virtualItems.map((vrow: { index: number }) => renderRow(items[vrow.index], vrow.index))}
      {paddingBottom > 0 && (
        <tr aria-hidden="true">
          <td
            style={spacerStyle(paddingBottom)}
            colSpan={9999}
            aria-label="virtualized scroll padding"
          />
        </tr>
      )}
    </>
  );
}
