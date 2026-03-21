import React from 'react';
import { cn } from '@/lib/utils';

interface SectionProps extends React.HTMLAttributes<HTMLElement> {}

export function Section({ className, children, ...rest }: SectionProps) {
  return (
    <section className={cn('ui-section', className)} {...rest}>
      {children}
    </section>
  );
}
