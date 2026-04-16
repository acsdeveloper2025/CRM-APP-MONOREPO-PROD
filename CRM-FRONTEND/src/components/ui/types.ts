/**
 * Standardized Component Prop Interfaces
 *
 * This file defines consistent prop interfaces and patterns for all UI components
 * to ensure consistency across the component library.
 */

import { ReactNode, HTMLAttributes, ButtonHTMLAttributes, InputHTMLAttributes } from 'react';

// ==================== Base Component Props ====================

/**
 * Base props that all components should extend
 */
export interface BaseComponentProps {
  className?: string;
  children?: ReactNode;
  id?: string;
  'data-testid'?: string;
}

/**
 * Props for components that can be disabled
 */
export interface DisableableProps {
  disabled?: boolean;
  loading?: boolean;
}

/**
 * Props for components with size variants
 */
export interface SizeVariantProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

/**
 * Props for components with color variants
 */
export interface ColorVariantProps {
  variant?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
}

/**
 * Props for components with visual states
 */
export interface StateProps {
  state?: 'default' | 'hover' | 'active' | 'focus' | 'disabled';
}

// ==================== Layout Component Props ====================

/**
 * Container component props
 */
export interface ContainerProps extends BaseComponentProps {
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  centered?: boolean;
}

/**
 * Grid component props
 */
export interface GridProps extends BaseComponentProps {
  cols?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
  gap?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  responsive?: boolean;
}

/**
 * Flex component props
 */
export interface FlexProps extends BaseComponentProps {
  direction?: 'row' | 'col' | 'row-reverse' | 'col-reverse';
  justify?: 'start' | 'end' | 'center' | 'between' | 'around' | 'evenly';
  align?: 'start' | 'end' | 'center' | 'baseline' | 'stretch';
  wrap?: 'nowrap' | 'wrap' | 'wrap-reverse';
  gap?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

// ==================== Form Component Props ====================

/**
 * Base form field props
 */
export interface BaseFieldProps extends BaseComponentProps, DisableableProps {
  label?: string;
  description?: string;
  error?: string;
  required?: boolean;
  name?: string;
}

/**
 * Input component props
 */
export interface InputProps
  extends
    BaseFieldProps,
    SizeVariantProps,
    Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'className' | 'children'> {
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  clearable?: boolean;
  onClear?: () => void;
}

/**
 * Button component props
 */
export interface ButtonProps
  extends
    BaseComponentProps,
    DisableableProps,
    SizeVariantProps,
    ColorVariantProps,
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'> {
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  iconOnly?: boolean;
  fullWidth?: boolean;
  rounded?: boolean;
}

/**
 * Select component props
 */
export interface SelectProps extends BaseFieldProps, SizeVariantProps {
  options: Array<{ value: string | number; label: string; disabled?: boolean }>;
  value?: string | number;
  defaultValue?: string | number;
  placeholder?: string;
  multiple?: boolean;
  searchable?: boolean;
  clearable?: boolean;
  onValueChange?: (value: string | number | (string | number)[]) => void;
}

/**
 * Checkbox component props
 */
export interface CheckboxProps extends BaseFieldProps {
  checked?: boolean;
  defaultChecked?: boolean;
  indeterminate?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

/**
 * Radio component props
 */
export interface RadioProps extends BaseFieldProps {
  value: string | number;
  checked?: boolean;
  defaultChecked?: boolean;
  onValueChange?: (value: string | number) => void;
}

// ==================== Data Display Component Props ====================

/**
 * Table component props
 */
export interface TableProps<T = unknown> extends BaseComponentProps {
  data: T[];
  columns: TableColumn<T>[];
  loading?: boolean;
  empty?: ReactNode;
  pagination?: PaginationProps;
  selection?: {
    selectedKeys: Set<string>;
    onSelectionChange: (keys: Set<string>) => void;
    selectionMode?: 'single' | 'multiple';
  };
  sorting?: {
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    onSortChange?: (sortBy: string, sortOrder: 'asc' | 'desc') => void;
  };
  rowKey?: keyof T | ((record: T) => string);
  onRowClick?: (record: T, index: number) => void;
}

/**
 * Table column definition
 */
export interface TableColumn<T = unknown> {
  key: string;
  title: string;
  dataIndex?: keyof T;
  render?: (value: unknown, record: T, index: number) => ReactNode;
  sortable?: boolean;
  filterable?: boolean;
  width?: number | string;
  align?: 'left' | 'center' | 'right';
  fixed?: 'left' | 'right';
  ellipsis?: boolean;
}

/**
 * Pagination component props
 */
export interface PaginationProps extends BaseComponentProps {
  current: number;
  total: number;
  pageSize: number;
  pageSizeOptions?: number[];
  showSizeChanger?: boolean;
  showQuickJumper?: boolean;
  showTotal?: boolean | ((total: number, range: [number, number]) => ReactNode);
  onChange?: (page: number, pageSize: number) => void;
}

/**
 * Badge component props
 */
export interface BadgeProps extends BaseComponentProps, ColorVariantProps, SizeVariantProps {
  count?: number;
  dot?: boolean;
  showZero?: boolean;
  overflowCount?: number;
  offset?: [number, number];
}

/**
 * Avatar component props
 */
export interface AvatarProps extends BaseComponentProps, SizeVariantProps {
  src?: string;
  alt?: string;
  fallback?: string;
  shape?: 'circle' | 'square';
  icon?: ReactNode;
}

// ==================== Feedback Component Props ====================

/**
 * Alert component props
 */
export interface AlertProps extends BaseComponentProps, ColorVariantProps {
  title?: string;
  description?: string;
  icon?: ReactNode;
  closable?: boolean;
  onClose?: () => void;
  action?: ReactNode;
}

/**
 * Toast/Notification component props
 */
export interface ToastProps extends BaseComponentProps, ColorVariantProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  duration?: number;
  closable?: boolean;
  action?: ReactNode;
  onClose?: () => void;
}

/**
 * Modal component props
 */
export interface ModalProps extends BaseComponentProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
  closable?: boolean;
  maskClosable?: boolean;
  footer?: ReactNode;
  centered?: boolean;
}

/**
 * Drawer component props
 */
export interface DrawerProps extends BaseComponentProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  placement?: 'top' | 'right' | 'bottom' | 'left';
  size?: number | string;
  closable?: boolean;
  maskClosable?: boolean;
  footer?: ReactNode;
}

// ==================== Navigation Component Props ====================

/**
 * Menu component props
 */
export interface MenuProps extends BaseComponentProps {
  items: MenuItem[];
  selectedKeys?: string[];
  openKeys?: string[];
  mode?: 'horizontal' | 'vertical' | 'inline';
  theme?: 'light' | 'dark';
  onSelect?: (key: string, item: MenuItem) => void;
  onOpenChange?: (openKeys: string[]) => void;
}

/**
 * Menu item definition
 */
export interface MenuItem {
  key: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  children?: MenuItem[];
  href?: string;
  target?: string;
  onClick?: () => void;
}

/**
 * Breadcrumb component props
 */
export interface BreadcrumbProps extends BaseComponentProps {
  items: BreadcrumbItem[];
  separator?: ReactNode;
  maxItems?: number;
}

/**
 * Breadcrumb item definition
 */
export interface BreadcrumbItem {
  title: string;
  href?: string;
  icon?: ReactNode;
  onClick?: () => void;
}

/**
 * Tabs component props
 */
export interface TabsProps extends BaseComponentProps {
  items: TabItem[];
  activeKey?: string;
  defaultActiveKey?: string;
  onChange?: (key: string) => void;
  type?: 'line' | 'card' | 'editable-card';
  size?: 'sm' | 'md' | 'lg';
  centered?: boolean;
}

/**
 * Tab item definition
 */
export interface TabItem {
  key: string;
  label: string;
  children: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
  closable?: boolean;
}

// ==================== Utility Types ====================

/**
 * Component ref types
 */
export interface ComponentRef<T = HTMLElement> {
  focus: () => void;
  blur: () => void;
  element: T | null;
}

/**
 * Event handler types
 */
export interface EventHandlers {
  onClick?: (event: React.MouseEvent) => void;
  onDoubleClick?: (event: React.MouseEvent) => void;
  onMouseEnter?: (event: React.MouseEvent) => void;
  onMouseLeave?: (event: React.MouseEvent) => void;
  onFocus?: (event: React.FocusEvent) => void;
  onBlur?: (event: React.FocusEvent) => void;
  onKeyDown?: (event: React.KeyboardEvent) => void;
  onKeyUp?: (event: React.KeyboardEvent) => void;
}

/**
 * Animation props
 */
export interface AnimationProps {
  animate?: boolean;
  duration?: number;
  delay?: number;
  easing?: 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out';
}

/**
 * Responsive props
 */
export interface ResponsiveProps<T> {
  xs?: T;
  sm?: T;
  md?: T;
  lg?: T;
  xl?: T;
  '2xl'?: T;
}

// ==================== Component Composition Patterns ====================

/**
 * Compound component props pattern
 */
export interface CompoundComponentProps extends BaseComponentProps {
  asChild?: boolean;
}

/**
 * Polymorphic component props pattern
 */
export interface PolymorphicProps<T extends React.ElementType = 'div'> {
  as?: T;
}

/**
 * Forwarded ref props pattern
 */
export interface ForwardedRefProps<T = HTMLElement> {
  ref?: React.Ref<T>;
}

// ==================== Export All Types ====================

export type {
  // Re-export common React types for convenience
  ReactNode,
  HTMLAttributes,
  ButtonHTMLAttributes,
  InputHTMLAttributes,
};
