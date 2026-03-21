import React from 'react';
import { cn } from '@/lib/utils';

interface GridProps extends React.HTMLAttributes<HTMLDivElement> {
  min?: number;
  columns?: number;
}

export function Grid({ min = 240, columns, className, style, children, ...rest }: GridProps) {
  const gridTemplateColumns = columns
    ? `repeat(${columns}, minmax(0, 1fr))`
    : `repeat(auto-fit, minmax(${min}px, 1fr))`;

  return (
    <div className={cn('ui-grid', className)} style={{ gridTemplateColumns, ...style }} {...rest}>
      {children}
    </div>
  );
}
