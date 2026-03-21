import React, { useRef, useEffect } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface UnifiedSearchInputProps {
  /**
   * Current search value
   */
  value: string;
  
  /**
   * Callback when search value changes
   */
  onChange: (value: string) => void;
  
  /**
   * Callback when search is cleared
   */
  onClear?: () => void;
  
  /**
   * Placeholder text
   * @default "Search..."
   */
  placeholder?: string;
  
  /**
   * Whether the search is currently loading/debouncing
   */
  isLoading?: boolean;
  
  /**
   * Whether the input is disabled
   */
  disabled?: boolean;
  
  /**
   * Additional CSS classes
   */
  className?: string;
  
  /**
   * Whether to auto-focus the input on mount
   */
  autoFocus?: boolean;
  
  /**
   * Size variant
   * @default "default"
   */
  size?: 'sm' | 'default' | 'lg';
}

/**
 * Unified search input component with standardized styling and behavior
 * 
 * Features:
 * - Search icon on the left
 * - Clear button (X) when value is present
 * - Loading indicator when debouncing
 * - Consistent styling across the application
 * - Keyboard shortcuts (Escape to clear)
 * 
 * @example
 * ```tsx
 * const { searchValue, setSearchValue, clearSearch, isDebouncing } = useUnifiedSearch();
 * 
 * <UnifiedSearchInput
 *   value={searchValue}
 *   onChange={setSearchValue}
 *   onClear={clearSearch}
 *   isLoading={isDebouncing}
 *   placeholder="Search cases..."
 * />
 * ```
 */
export const UnifiedSearchInput = React.forwardRef<HTMLInputElement, UnifiedSearchInputProps>(
  (
    {
      value,
      onChange,
      onClear,
      placeholder = 'Search...',
      isLoading = false,
      disabled = false,
      className,
      autoFocus = false,
      size = 'default',
    },
    ref
  ) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const combinedRef = (ref as React.RefObject<HTMLInputElement>) || inputRef;

    // Auto-focus on mount if requested
    useEffect(() => {
      if (autoFocus && combinedRef.current) {
        combinedRef.current.focus();
      }
    }, [autoFocus, combinedRef]);

    // Handle keyboard shortcuts
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClear();
      }
    };

    const handleClear = () => {
      onChange('');
      if (onClear) {
        onClear();
      }
      // Keep focus on input after clearing
      if (combinedRef.current) {
        combinedRef.current.focus();
      }
    };

    const sizeClasses = {
      sm: 'h-8 text-sm',
      default: 'h-10',
      lg: 'h-12 text-lg',
    };

    const iconSizes = {
      sm: 'h-3.5 w-3.5',
      default: 'h-4 w-4',
      lg: 'h-5 w-5',
    };

    const paddingClasses = {
      sm: 'pl-8 pr-8',
      default: 'pl-10 pr-10',
      lg: 'pl-12 pr-12',
    };

    return (
      <div className={cn('relative w-full', className)}>
        {/* Search Icon */}
        <Search
          className={cn(
            'absolute left-3 top-1/2 -translate-y-1/2 text-gray-600',
            iconSizes[size],
            disabled && 'opacity-50'
          )}
        />

        {/* Input Field */}
        <Input
          ref={combinedRef}
          data-ui-search-input="true"
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            paddingClasses[size],
            sizeClasses[size],
            'transition-all duration-200',
            'focus:ring-2 focus:ring-primary/20',
            value && 'pr-20' // Extra padding when clear button is visible
          )}
        />

        {/* Right Side Icons (Loading or Clear) */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {isLoading && (
            <Loader2
              className={cn(
                'animate-spin text-gray-600',
                iconSizes[size]
              )}
            />
          )}
          
          {value && !disabled && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className={cn(
                'h-6 w-6 p-0 hover:bg-slate-100 dark:hover:bg-slate-800/60',
                'transition-opacity duration-200'
              )}
              tabIndex={-1}
            >
              <X className={cn('text-gray-600', iconSizes[size])} />
              <span className="sr-only">Clear search</span>
            </Button>
          )}
        </div>
      </div>
    );
  }
);

UnifiedSearchInput.displayName = 'UnifiedSearchInput';
