import React from 'react';
import { cn } from '@/lib/utils';

type BoxProps<T extends React.ElementType = 'div'> = {
  as?: T;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
} & Omit<React.ComponentPropsWithoutRef<T>, 'as' | 'children' | 'className' | 'style'>;

export function Box<T extends React.ElementType = 'div'>({
  as,
  children,
  className,
  style,
  ...rest
}: BoxProps<T>) {
  const Component = as || 'div';
  return (
    <Component className={cn('ui-box', className)} style={style} {...rest}>
      {children}
    </Component>
  );
}
