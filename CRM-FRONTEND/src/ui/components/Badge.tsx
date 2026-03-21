import React from 'react';
import { cn } from '@/lib/utils';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?:
    | 'neutral'
    | 'accent'
    | 'positive'
    | 'warning'
    | 'danger'
    | 'info'
    | 'status-pending'
    | 'status-progress'
    | 'status-completed'
    | 'status-revoked'
    | 'default'
    | 'secondary'
    | 'outline'
    | 'destructive';
}

export function Badge({ variant = 'neutral', className, children, ...rest }: BadgeProps) {
  const resolvedVariant =
    variant === 'default' ? 'accent' :
    variant === 'secondary' ? 'neutral' :
    variant === 'outline' ? 'neutral' :
    variant === 'destructive' ? 'danger' :
    variant;
  return (
    <span className={cn('ui-badge', className)} data-variant={resolvedVariant} {...rest}>
      {children}
    </span>
  );
}
