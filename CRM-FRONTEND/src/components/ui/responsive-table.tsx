import * as React from "react"
import { cn } from "@/lib/utils"

// Responsive table wrapper that handles mobile layouts
const ResponsiveTable = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    mobileLayout?: 'cards' | 'scroll' | 'stack'
  }
>(({ className, mobileLayout = 'scroll', children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "relative w-full",
      mobileLayout === 'scroll' && "overflow-auto",
      mobileLayout === 'cards' && "block md:overflow-auto",
      className
    )}
    {...props}
  >
    {children}
  </div>
))
ResponsiveTable.displayName = "ResponsiveTable"

// Enhanced table with responsive features
const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement> & {
    mobileLayout?: 'cards' | 'scroll' | 'stack'
  }
>(({ className, mobileLayout = 'scroll', ...props }, ref) => (
  <ResponsiveTable mobileLayout={mobileLayout}>
    <table
      ref={ref}
      className={cn(
        "w-full caption-bottom text-sm",
        mobileLayout === 'cards' && "hidden md:table",
        className
      )}
      {...props}
    />
  </ResponsiveTable>
))
Table.displayName = "Table"

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />
))
TableHeader.displayName = "TableHeader"

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props}
  />
))
TableBody.displayName = "TableBody"

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
      className
    )}
    {...props}
  />
))
TableFooter.displayName = "TableFooter"

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
      className
    )}
    {...props}
  />
))
TableRow.displayName = "TableRow"

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement> & {
    hideOnMobile?: boolean
  }
>(({ className, hideOnMobile = false, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-12 px-2 sm:px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0",
      hideOnMobile && "hidden sm:table-cell",
      className
    )}
    {...props}
  />
))
TableHead.displayName = "TableHead"

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement> & {
    hideOnMobile?: boolean
    mobileLabel?: string
  }
>(({ className, hideOnMobile = false, mobileLabel, children, ...props }, ref) => (
  <td
    ref={ref}
    className={cn(
      "p-2 sm:p-4 align-middle [&:has([role=checkbox])]:pr-0",
      hideOnMobile && "hidden sm:table-cell",
      className
    )}
    {...props}
  >
    {mobileLabel && (
      <div className="sm:hidden font-medium text-muted-foreground text-xs mb-1">
        {mobileLabel}
      </div>
    )}
    {children}
  </td>
))
TableCell.displayName = "TableCell"

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-4 text-sm text-muted-foreground", className)}
    {...props}
  />
))
TableCaption.displayName = "TableCaption"

// Mobile card layout for tables
const MobileTableCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "md:hidden bg-card border border-border rounded-lg p-4 mb-3 space-y-2",
      className
    )}
    {...props}
  >
    {children}
  </div>
))
MobileTableCard.displayName = "MobileTableCard"

const MobileTableField = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    label: string
    value: React.ReactNode
  }
>(({ className, label, value, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex justify-between items-start gap-2", className)}
    {...props}
  >
    <span className="text-sm font-medium text-muted-foreground min-w-0 flex-shrink-0">
      {label}:
    </span>
    <span className="text-sm text-right min-w-0 flex-1">
      {value}
    </span>
  </div>
))
MobileTableField.displayName = "MobileTableField"

export {
  ResponsiveTable,
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
  MobileTableCard,
  MobileTableField,
}
