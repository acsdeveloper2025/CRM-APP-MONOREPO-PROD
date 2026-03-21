import React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '@/lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'default' | 'outline' | 'destructive';
  fullWidth?: boolean;
  icon?: React.ReactNode;
  asChild?: boolean;
}

export function Button({
  variant = 'primary',
  fullWidth = false,
  icon,
  asChild = false,
  className,
  children,
  type = 'button',
  onClick,
  ...rest
}: ButtonProps) {
  const [clicked, setClicked] = React.useState(false);
  const Comp = asChild ? Slot : 'button';
  const resolvedVariant =
    variant === 'default' ? 'primary' :
    variant === 'outline' ? 'secondary' :
    variant === 'destructive' ? 'danger' :
    variant;

  const handleClick: React.MouseEventHandler<HTMLButtonElement> = (event) => {
    setClicked(true);
    window.setTimeout(() => setClicked(false), 320);
    onClick?.(event);
  };

  return (
    <Comp
      {...(!asChild ? { type } : {})}
      className={cn('ui-button', className)}
      data-variant={resolvedVariant}
      data-full-width={fullWidth}
      data-clicked={clicked}
      onClick={handleClick}
      {...rest}
    >
      {asChild ? children : (
        <>
          {icon}
          {children}
        </>
      )}
    </Comp>
  );
}
