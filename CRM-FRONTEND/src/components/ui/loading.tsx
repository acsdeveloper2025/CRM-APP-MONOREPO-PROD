import React from 'react';
import { Atom } from 'react-loading-indicators';
import { cn } from '@/lib/utils';
interface LoadingSpinnerProps {
    size?: 'sm' | 'md' | 'lg' | 'xl';
    variant?: 'default' | 'dots' | 'pulse' | 'bounce';
    className?: string;
}
export function LoadingSpinner({ size = 'md', variant = 'default', className }: LoadingSpinnerProps) {
    // Map size to react-loading-indicators size values
    const sizeMap = {
        sm: 'small' as const,
        md: 'medium' as const,
        lg: 'large' as const,
        xl: 'large' as const,
    };
    const spinnerSize = sizeMap[size];
    if (variant === 'dots') {
        return (<div {...{ className: cn('flex space-x-1', className) }}>
        {[0, 1, 2].map((i) => (<div key={i} {...{ className: cn('rounded-full bg-primary animate-bounce', size === 'sm' ? 'h-2 w-2' :
                    size === 'md' ? 'h-3 w-3' :
                        size === 'lg' ? 'h-4 w-4' : 'h-6 w-6') }} style={{ animationDelay: `${i * 0.1}s` }}/>))}
      </div>);
    }
    if (variant === 'pulse') {
        return (<div {...{ className: cn('rounded-full bg-primary animate-pulse', size === 'sm' ? 'h-4 w-4' :
                size === 'md' ? 'h-6 w-6' :
                    size === 'lg' ? 'h-8 w-8' : 'h-12 w-12', className) }}/>);
    }
    if (variant === 'bounce') {
        return (<div {...{ className: cn('rounded-full bg-primary animate-bounce', size === 'sm' ? 'h-4 w-4' :
                size === 'md' ? 'h-6 w-6' :
                    size === 'lg' ? 'h-8 w-8' : 'h-12 w-12', className) }}/>);
    }
    // Default: Use Atom spinner (smooth, professional look with green color)
    return (<div {...{ className: cn('flex items-center justify-center', className) }}>
      <Atom color="#32cd32" size={spinnerSize} text="" textColor=""/>
    </div>);
}
interface LoadingOverlayProps {
    isLoading: boolean;
    children: React.ReactNode;
    loadingText?: string;
    className?: string;
    spinnerSize?: LoadingSpinnerProps['size'];
    spinnerVariant?: LoadingSpinnerProps['variant'];
}
export function LoadingOverlay({ isLoading, children, loadingText = 'Loading...', className, spinnerSize = 'lg', spinnerVariant = 'default', }: LoadingOverlayProps) {
    return (<div {...{ className: cn('relative', className) }}>
      {children}
      {isLoading && (<div {...{ className: "absolute inset-0 bg-[#FAFAFA]/95 backdrop-blur-sm flex items-center justify-center z-50" }}>
          <div {...{ className: "flex flex-col items-center space-y-4" }}>
            <LoadingSpinner size={spinnerSize} variant={spinnerVariant} {...{ className: "text-[#10B981]" }}/>
            <p {...{ className: "text-sm text-[#1F2937] font-medium" }}>{loadingText}</p>
          </div>
        </div>)}
    </div>);
}
interface LoadingCardProps {
    title?: string;
    description?: string;
    className?: string;
}
export function LoadingCard({ title = 'Loading', description, className }: LoadingCardProps) {
    return (<div {...{ className: cn('border rounded-lg p-6', className) }}>
      <div {...{ className: "flex items-center space-x-4" }}>
        <LoadingSpinner size="lg"/>
        <div>
          <h3 {...{ className: "font-medium" }}>{title}</h3>
          {description && (<p {...{ className: "text-sm text-gray-600" }}>{description}</p>)}
        </div>
      </div>
    </div>);
}
interface LoadingSkeletonProps {
    className?: string;
    variant?: 'text' | 'circular' | 'rectangular';
    width?: string | number;
    height?: string | number;
    lines?: number;
}
export function LoadingSkeleton({ className, variant = 'rectangular', width, height, lines = 1, }: LoadingSkeletonProps) {
    const baseClasses = 'animate-pulse bg-slate-100 dark:bg-slate-800/60';
    if (variant === 'text') {
        return (<div {...{ className: cn('space-y-2', className) }}>
        {Array.from({ length: lines }).map((_, i) => (<div key={i} {...{ className: cn(baseClasses, 'h-4 rounded') }} style={{
                    width: i === lines - 1 ? '75%' : '100%',
                }}/>))}
      </div>);
    }
    if (variant === 'circular') {
        return (<div {...{ className: cn(baseClasses, 'rounded-full', className) }} style={{ width, height }}/>);
    }
    return (<div {...{ className: cn(baseClasses, 'rounded', className) }} style={{ width, height }}/>);
}
interface LoadingTableProps {
    rows?: number;
    columns?: number;
    className?: string;
}
export function LoadingTable({ rows = 5, columns = 4, className }: LoadingTableProps) {
    return (<div {...{ className: cn('space-y-3', className) }}>
      {/* Header */}
      <div {...{ className: "grid gap-4" }} style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
        {Array.from({ length: columns }).map((_, i) => (<LoadingSkeleton key={i} height="20px"/>))}
      </div>
      
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (<div key={rowIndex} {...{ className: "grid gap-4" }} style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
          {Array.from({ length: columns }).map((_, colIndex) => (<LoadingSkeleton key={colIndex} height="16px"/>))}
        </div>))}
    </div>);
}
interface LoadingPageProps {
    title?: string;
    description?: string;
    className?: string;
}
export function LoadingPage({ title = 'Loading', description = 'Please wait while we load your content', className }: LoadingPageProps) {
    return (<div {...{ className: cn('min-h-screen flex items-center justify-center bg-[#FAFAFA]', className) }}>
      <div {...{ className: "text-center space-y-4" }}>
        <LoadingSpinner size="xl" {...{ className: "text-[#10B981]" }}/>
        <div>
          <h2 {...{ className: "text-2xl font-semibold text-[#1F2937]" }}>{title}</h2>
          <p {...{ className: "text-[#1F2937]/70" }}>{description}</p>
        </div>
      </div>
    </div>);
}
interface LoadingButtonProps {
    isLoading: boolean;
    children: React.ReactNode;
    loadingText?: string;
    className?: string;
    disabled?: boolean;
    onClick?: () => void;
    variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
    size?: 'default' | 'sm' | 'lg' | 'icon';
}
export function LoadingButton({ isLoading, children, loadingText, className, disabled, onClick, variant = 'default', size = 'default', }: LoadingButtonProps) {
    return (<button {...{ className: cn('inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background', {
            'bg-primary text-primary-foreground hover:bg-primary/90': variant === 'default',
            'bg-destructive text-destructive-foreground hover:bg-destructive/90': variant === 'destructive',
            'border border-input hover:bg-accent hover:text-accent-foreground': variant === 'outline',
            'bg-secondary text-secondary-foreground hover:bg-secondary/80': variant === 'secondary',
            'hover:bg-accent hover:text-accent-foreground': variant === 'ghost',
            'underline-offset-4 hover:underline text-primary': variant === 'link',
        }, {
            'h-10 py-2 px-4': size === 'default',
            'h-9 px-3 rounded-md': size === 'sm',
            'h-11 px-8 rounded-md': size === 'lg',
            'h-10 w-10': size === 'icon',
        }, className) }} disabled={disabled || isLoading} onClick={onClick}>
      {isLoading && <LoadingSpinner size="sm" {...{ className: "mr-2" }}/>}
      {isLoading ? loadingText || 'Loading...' : children}
    </button>);
}
interface LoadingStateProps {
    message?: string;
    size?: LoadingSpinnerProps['size'];
    className?: string;
}
/**
 * Simple centered loading state for inline use in pages
 * Follows CRM design system colors
 */
export function LoadingState({ message = 'Loading...', size = 'lg', className }: LoadingStateProps) {
    return (<div {...{ className: cn('flex flex-col items-center justify-center py-12 space-y-4', className) }}>
      <LoadingSpinner size={size} {...{ className: "text-[#10B981]" }}/>
      <p {...{ className: "text-sm text-[#1F2937] font-medium" }}>{message}</p>
    </div>);
}
