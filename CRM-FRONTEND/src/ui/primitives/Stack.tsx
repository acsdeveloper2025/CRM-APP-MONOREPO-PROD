import React from 'react';
import { cn } from '@/lib/utils';

type Space = 1 | 2 | 3 | 4 | 5 | 6;

interface StackProps extends React.HTMLAttributes<HTMLDivElement> {
  direction?: 'vertical' | 'horizontal';
  gap?: Space;
  align?: React.CSSProperties['alignItems'];
  justify?: React.CSSProperties['justifyContent'];
  wrap?: React.CSSProperties['flexWrap'];
}

const gapMap: Record<Space, string> = {
  1: 'var(--ui-gap-1)',
  2: 'var(--ui-gap-2)',
  3: 'var(--ui-gap-3)',
  4: 'var(--ui-gap-4)',
  5: 'var(--ui-gap-5)',
  6: 'var(--ui-gap-6)',
};

export function Stack({
  direction = 'vertical',
  gap = 3,
  align,
  justify,
  wrap,
  className,
  style,
  children,
  ...rest
}: StackProps) {
  return (
    <div
      className={cn('ui-stack', className)}
      data-direction={direction}
      style={{ gap: gapMap[gap], alignItems: align, justifyContent: justify, flexWrap: wrap, ...style }}
      {...rest}
    >
      {children}
    </div>
  );
}
