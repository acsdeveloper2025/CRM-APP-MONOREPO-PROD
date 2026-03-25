import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Check, ChevronDown, X, Search, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface MultiSelectOption {
  id: string | number;
  label: string;
  description?: string;
  disabled?: boolean;
}

interface MultiSelectDropdownProps {
  options: MultiSelectOption[];
  selectedValues: (string | number)[];
  onSelectionChange: (values: (string | number)[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  maxDisplayItems?: number;
  isLoading?: boolean;
  disabled?: boolean;
  className?: string;
  dropdownClassName?: string;
  error?: string;
  onSearch?: (query: string) => void;
  searchQuery?: string;
  emptyMessage?: string;
  autoClose?: boolean; // Close dropdown after selection
}

export function MultiSelectDropdown({
  options,
  selectedValues,
  onSelectionChange,
  placeholder = "Select items...",
  searchPlaceholder = "Search...",
  maxDisplayItems = 100,
  isLoading = false,
  disabled = false,
  className,
  dropdownClassName,
  error,
  onSearch,
  searchQuery = "",
  emptyMessage = "No items found",
  autoClose = false
}: MultiSelectDropdownProps) {


  const [isOpen, setIsOpen] = useState(false);
  const [internalSearchQuery, setInternalSearchQuery] = useState(searchQuery);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Handle search
  const handleSearch = (query: string) => {
    setInternalSearchQuery(query);
    if (onSearch) {
      onSearch(query);
    }
  };

  // Filter options based on search query
  const filteredOptions = useMemo(() => {
    if (!internalSearchQuery && !onSearch) {return options.slice(0, maxDisplayItems);}
    
    if (onSearch) {
      // External search handling
      return options.slice(0, maxDisplayItems);
    }
    
    // Internal search filtering
    const query = internalSearchQuery.toLowerCase();
    return options
      .filter(option => 
        option.label.toLowerCase().includes(query) ||
        option.description?.toLowerCase().includes(query)
      )
      .slice(0, maxDisplayItems);
  }, [options, internalSearchQuery, onSearch, maxDisplayItems]);

  // Get selected options for display
  const selectedOptions = useMemo(() => {
    return options.filter(option => selectedValues.includes(option.id));
  }, [options, selectedValues]);

  const handleToggleOption = (optionId: string | number) => {
    if (selectedValues.includes(optionId)) {
      onSelectionChange(selectedValues.filter(id => id !== optionId));
    } else {
      onSelectionChange([...selectedValues, optionId]);
    }

    // Auto-close dropdown after selection if autoClose is enabled
    if (autoClose) {
      setIsOpen(false);
    }
  };

  const handleRemoveSelected = (optionId: string | number) => {
    onSelectionChange(selectedValues.filter(id => id !== optionId));
  };

  const handleClearAll = () => {
    onSelectionChange([]);
  };

  return (
    <div className={cn("relative", className)} ref={dropdownRef}>
      {/* Trigger Button */}
      <Button
        variant="outline"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          "w-full justify-between text-left font-normal bg-white border-gray-300 text-gray-900 hover:bg-gray-50 focus:ring-2 focus:ring-green-500 focus:border-green-500",
          error && "border-red-500",
          selectedValues.length === 0 && "text-gray-600"
        )}
      >
        <span className="truncate">
          {selectedValues.length === 0
            ? placeholder
            : `${selectedValues.length} item${selectedValues.length === 1 ? '' : 's'} selected`
          }
        </span>
        <ChevronDown className={cn("h-4 w-4 transition-transform text-gray-600", isOpen && "rotate-180")} />
      </Button>

      {/* Error Message */}
      {error && (
        <p className="text-sm text-red-500 mt-1">{error}</p>
      )}

      {/* Selected Items Display */}
      {selectedOptions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {selectedOptions.map((option) => (
            <Badge
              key={option.id}
              variant="secondary"
              className="text-xs flex items-center gap-1 bg-green-100 text-green-800 hover:bg-green-200"
            >
              <span className="truncate max-w-[120px]">{option.label}</span>
              <X
                className="h-3 w-3 cursor-pointer hover:text-red-600"
                onClick={() => handleRemoveSelected(option.id)}
              />
            </Badge>
          ))}
          {selectedOptions.length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearAll}
              className="h-6 px-2 text-xs text-gray-600 hover:text-red-600 hover:bg-red-50"
            >
              Clear all
            </Button>
          )}
        </div>
      )}

      {/* Dropdown Content */}
      {isOpen && (
        <div className={cn(
          "absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-80 overflow-hidden",
          dropdownClassName
        )}>
          {/* Search Input */}
          <div className="p-2 border-b border-gray-200 bg-white">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-600" />
              <Input
                ref={searchInputRef}
                placeholder={searchPlaceholder}
                value={internalSearchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-8 bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
          </div>

          {/* Options List */}
          <div className="max-h-60 overflow-y-auto bg-white">
            {isLoading ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="h-4 w-4 animate-spin mr-2 text-gray-600" />
                <span className="text-sm text-gray-600">Loading...</span>
              </div>
            ) : filteredOptions.length === 0 ? (
              <div className="p-4 text-center text-sm text-gray-600">
                {emptyMessage}
              </div>
            ) : (
              filteredOptions.map((option) => {
                const isSelected = selectedValues.includes(option.id);
                return (
                  <div
                    key={option.id}
                    onClick={() => !option.disabled && handleToggleOption(option.id)}
                    className={cn(
                      "flex items-center gap-2 p-2 cursor-pointer hover:bg-green-50 hover:text-green-900 transition-colors",
                      option.disabled && "opacity-50 cursor-not-allowed",
                      isSelected && "bg-green-50"
                    )}
                  >
                    <div className={cn(
                      "w-4 h-4 border rounded flex items-center justify-center shrink-0",
                      isSelected ? "bg-green-600 border-green-600" : "border-gray-300 bg-white"
                    )}>
                      {isSelected && <Check className="h-3 w-3 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{option.label}</div>
                      {option.description && (
                        <div className="text-xs text-gray-600 truncate">
                          {option.description}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer with selection count */}
          {filteredOptions.length > 0 && (
            <div className="p-2 border-t border-gray-200 bg-gray-50 text-xs text-gray-600">
              {selectedValues.length} of {options.length} items selected
              {filteredOptions.length < options.length && (
                <span> • Showing {filteredOptions.length} filtered results</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
