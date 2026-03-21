import React from 'react';
import { cn } from '@/lib/utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: 'default' | 'strong' | 'muted' | 'highlight';
  bodyClassName?: string;
  staticCard?: boolean;
}

export function Card({
  tone = 'default',
  className,
  bodyClassName,
  staticCard = false,
  children,
  ...rest
}: CardProps) {
  return (
    <div className={cn('ui-card', className)} data-tone={tone} data-static={staticCard} {...rest}>
      <div className={cn('ui-card__body', bodyClassName)}>{children}</div>
    </div>
  );
}

export function CardHeader({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('ui-card__header', className)} {...rest} />;
}

export function CardContent({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('ui-card__content', className)} {...rest} />;
}

export function CardTitle({ className, ...rest }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('ui-card__title', className)} {...rest} />;
}

export function CardDescription({ className, ...rest }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('ui-card__description', className)} {...rest} />;
}
