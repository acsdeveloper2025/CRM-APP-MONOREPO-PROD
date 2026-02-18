import React from 'react';
import { useResponsive, type Breakpoint } from '@/hooks/useResponsive';

interface ResponsiveProps {
  children: React.ReactNode;
  breakpoint?: Breakpoint;
  up?: boolean;
  down?: boolean;
  only?: boolean;
}

export function Responsive({ children, breakpoint, up, down, only }: ResponsiveProps) {
  const { isBreakpoint, isBreakpointUp, isBreakpointDown } = useResponsive();

  if (!breakpoint) {return <>{children}</>;}

  let shouldRender = false;

  if (only) {
    shouldRender = isBreakpoint(breakpoint);
  } else if (up) {
    shouldRender = isBreakpointUp(breakpoint);
  } else if (down) {
    shouldRender = isBreakpointDown(breakpoint);
  } else {
    shouldRender = isBreakpointUp(breakpoint);
  }

  return shouldRender ? <>{children}</> : null;
}
