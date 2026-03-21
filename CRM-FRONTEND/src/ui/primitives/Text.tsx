import React from 'react';
import { cn } from '@/lib/utils';

type Variant = 'display' | 'headline' | 'title' | 'label' | 'body' | 'body-sm' | 'caption';
type Tone = 'default' | 'muted' | 'soft' | 'accent' | 'positive' | 'warning' | 'danger';

type TextProps<T extends React.ElementType = 'p'> = {
  as?: T;
  variant?: Variant;
  tone?: Tone;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
} & Omit<React.ComponentPropsWithoutRef<T>, 'as' | 'children' | 'className' | 'style'>;

export function Text<T extends React.ElementType = 'p'>({
  as,
  variant = 'body',
  tone = 'default',
  className,
  style,
  children,
  ...rest
}: TextProps<T>) {
  const Component = as || 'p';
  return (
    <Component className={cn('ui-text', className)} data-variant={variant} data-tone={tone} style={style} {...rest}>
      {children}
    </Component>
  );
}
