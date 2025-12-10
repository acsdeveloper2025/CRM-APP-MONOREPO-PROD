/**
 * Common Component Prop Types
 * Reusable prop type definitions for components
 */

import type { ReactNode } from 'react';

/**
 * Base component props
 */
export interface BaseComponentProps {
  className?: string;
  children?: ReactNode;
}

/**
 * Props for components with loading state
 */
export interface LoadingProps {
  isLoading?: boolean;
  loadingText?: string;
}

/**
 * Props for components with error state
 */
export interface ErrorProps {
  error?: string | Error | null;
  onErrorDismiss?: () => void;
}

/**
 * Props for paginated components
 */
export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

/**
 * Props for searchable components
 */
export interface SearchProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
}

/**
 * Props for filterable components
 */
export interface FilterProps<T = Record<string, unknown>> {
  filters: T;
  onFilterChange: (filters: T) => void;
  onClearFilters?: () => void;
}

/**
 * Props for sortable components
 */
export interface SortProps {
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  onSortChange: (sortBy: string, sortOrder: 'asc' | 'desc') => void;
}

/**
 * Props for modal/dialog components
 */
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

/**
 * Props for form components
 */
export interface FormProps<T = Record<string, unknown>> {
  initialValues?: T;
  onSubmit: (values: T) => void | Promise<void>;
  onCancel?: () => void;
  isSubmitting?: boolean;
}

/**
 * Props for table components
 */
export interface TableProps<T = unknown> {
  data: T[];
  columns: TableColumn<T>[];
  isLoading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
}

export interface TableColumn<T = unknown> {
  key: string;
  label: string;
  render?: (value: unknown, row: T) => ReactNode;
  sortable?: boolean;
  width?: string;
}

/**
 * Props for action button components
 */
export interface ActionButtonProps {
  onClick: () => void | Promise<void>;
  label: string;
  icon?: ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  isLoading?: boolean;
}
