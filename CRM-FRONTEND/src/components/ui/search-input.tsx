import React, { useRef, useCallback, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useDebouncedSearch } from '@/hooks/useDebounce';

interface SearchInputProps {
  /**
   * Current search value (controlled)
   */
  value?: string;

  /**
   * Callback when search value changes (debounced)
   */
  onSearch: (value: string) => void;

  /**
   * Callback when search value changes immediately (not debounced)
   */
  onValueChange?: (value: string) => void;

  /**
   * Placeholder text
   */
  placeholder?: string;

  /**
   * Debounce delay in milliseconds
   */
  debounceDelay?: number;

  /**
   * Whether to show clear button when there's text
   */
  showClearButton?: boolean;

  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * Whether the search is currently loading/processing
   */
  isLoading?: boolean;

  /**
   * Disabled state
   */
  disabled?: boolean;

  /**
   * Size variant
   */
  size?: 'sm' | 'md' | 'lg';

  /**
   * Auto focus on mount
   */
  autoFocus?: boolean;
}

/**
 * Standardized search input component with debouncing and responsive design
 *
 * Features:
 * - Automatic debouncing to prevent excessive API calls
 * - Focus preservation during typing
 * - Responsive design following established patterns
 * - Touch-friendly sizing for mobile
 * - Optional clear button
 * - Loading state support
 * - Consistent styling across the application
 */
export const SearchInput: React.FC<SearchInputProps> = ({
  value: controlledValue,
  onSearch,
  onValueChange,
  placeholder = 'Search...',
  debounceDelay = 400,
  showClearButton = true,
  className,
  isLoading = false,
  disabled = false,
  size = 'md',
  autoFocus = false,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  // Use debounced search hook for internal state management
  const { searchValue, debouncedSearchValue, setSearchValue, isSearching } = useDebouncedSearch(
    controlledValue || '',
    debounceDelay
  );

  // Call onSearch when debounced value changes
  React.useEffect(() => {
    onSearch(debouncedSearchValue);
  }, [debouncedSearchValue, onSearch]);

  // Programmatic focus on mount (replaces autoFocus prop for a11y)
  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus();
    }
  }, [autoFocus]);

  // Handle input change with focus preservation
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setSearchValue(newValue);

      // Call immediate change handler if provided
      onValueChange?.(newValue);

      // Ensure focus is maintained during rapid typing
      setTimeout(() => {
        if (inputRef.current && document.activeElement !== inputRef.current) {
          inputRef.current.focus();
        }
      }, 0);
    },
    [setSearchValue, onValueChange]
  );

  // Handle clear button click
  const handleClear = useCallback(() => {
    setSearchValue('');
    onValueChange?.('');
    inputRef.current?.focus();
  }, [setSearchValue, onValueChange]);

  // Size-based styling
  const sizeClasses = {
    sm: 'h-8 text-sm',
    md: 'h-10 text-sm min-h-[44px] sm:min-h-[40px]', // Touch-friendly on mobile
    lg: 'h-12 text-base min-h-[44px]',
  };

  const iconSizeClasses = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  const paddingClasses = {
    sm: 'pl-7 pr-8',
    md: 'pl-8 pr-10',
    lg: 'pl-10 pr-12',
  };

  return (
    <div className={cn('relative w-full', className)}>
      {/* Search Icon */}
      <Search
        className={cn(
          'absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-600',
          iconSizeClasses[size],
          size === 'lg' && 'left-3'
        )}
      />

      {/* Search Input */}
      <Input
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        value={searchValue}
        onChange={handleInputChange}
        disabled={disabled}
        className={cn(
          sizeClasses[size],
          paddingClasses[size],
          'w-full transition-all duration-200',
          isSearching && 'ring-2 ring-blue-500/20',
          showClearButton && searchValue && 'pr-16'
        )}
      />

      {/* Clear Button */}
      {showClearButton && searchValue && !disabled && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleClear}
          className={cn(
            'absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 hover:bg-slate-100 dark:hover:bg-slate-800/60',
            size === 'lg' && 'h-8 w-8'
          )}
          tabIndex={-1} // Prevent tab focus, use mouse/touch only
        >
          <X className={cn(iconSizeClasses[size])} />
          <span className="sr-only">Clear search</span>
        </Button>
      )}

      {/* Loading Indicator */}
      {isLoading && (
        <div
          className={cn(
            'absolute right-2 top-1/2 transform -translate-y-1/2',
            showClearButton && searchValue ? 'right-10' : 'right-2'
          )}
        >
          <div
            className={cn(
              'animate-spin rounded-full border-2 border-muted border-t-primary',
              iconSizeClasses[size]
            )}
          />
        </div>
      )}
    </div>
  );
};
