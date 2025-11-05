import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { documentTypesService } from '@/services/documentTypes';
import { DOCUMENT_TYPE_COLORS, DOCUMENT_TYPE_DISPLAY_NAMES, type DocumentType, type DocumentCategory } from '@/types/documentType';

interface DocumentTypeSelectorProps {
  selectedDocumentTypes: DocumentType[];
  onDocumentTypesChange: (documentTypes: DocumentType[]) => void;
  label?: string;
  placeholder?: string;
  multiple?: boolean;
  category?: DocumentCategory;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

export const DocumentTypeSelector: React.FC<DocumentTypeSelectorProps> = ({
  selectedDocumentTypes,
  onDocumentTypesChange,
  label = 'Document Types',
  placeholder = 'Select document types...',
  multiple = true,
  category,
  disabled = false,
  required = false,
  className,
}) => {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  // Fetch document types
  const { data: documentTypesResponse, isLoading } = useQuery({
    queryKey: ['document-types', { category, isActive: true }],
    queryFn: () => documentTypesService.getDocumentTypes({ 
      category, 
      isActive: true,
      limit: 100,
      sortBy: 'sort_order',
      sortOrder: 'asc'
    }),
  });

  const documentTypes = documentTypesResponse?.data || [];

  // Filter document types based on search
  const filteredDocumentTypes = documentTypes.filter(dt =>
    dt.name.toLowerCase().includes(searchValue.toLowerCase()) ||
    dt.code.toLowerCase().includes(searchValue.toLowerCase()) ||
    dt.description?.toLowerCase().includes(searchValue.toLowerCase())
  );

  // Group document types by category
  const groupedDocumentTypes = filteredDocumentTypes.reduce((acc, dt) => {
    if (!acc[dt.category]) {
      acc[dt.category] = [];
    }
    acc[dt.category].push(dt);
    return acc;
  }, {} as Record<DocumentCategory, DocumentType[]>);

  const handleSelect = (documentType: DocumentType) => {
    if (multiple) {
      const isSelected = selectedDocumentTypes.some(dt => dt.id === documentType.id);
      if (isSelected) {
        onDocumentTypesChange(selectedDocumentTypes.filter(dt => dt.id !== documentType.id));
      } else {
        onDocumentTypesChange([...selectedDocumentTypes, documentType]);
      }
    } else {
      onDocumentTypesChange([documentType]);
      setOpen(false);
    }
  };

  const handleRemove = (documentTypeId: number) => {
    onDocumentTypesChange(selectedDocumentTypes.filter(dt => dt.id !== documentTypeId));
  };

  const isSelected = (documentType: DocumentType) => {
    return selectedDocumentTypes.some(dt => dt.id === documentType.id);
  };

  const getDisplayValue = () => {
    if (selectedDocumentTypes.length === 0) {
      return placeholder;
    }
    if (multiple) {
      return `${selectedDocumentTypes.length} document type${selectedDocumentTypes.length > 1 ? 's' : ''} selected`;
    }
    return selectedDocumentTypes[0]?.name || placeholder;
  };

  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <Label className="text-sm font-medium">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
      )}

      {/* Selected Document Types Display */}
      {multiple && selectedDocumentTypes.length > 0 && (
        <div className="flex flex-wrap gap-2 p-2 border rounded-md bg-gray-50">
          {selectedDocumentTypes.map((dt) => (
            <Badge
              key={dt.id}
              variant="secondary"
              className={cn(
                'flex items-center gap-1 px-2 py-1',
                `bg-${DOCUMENT_TYPE_COLORS[dt.category]}-100 text-${DOCUMENT_TYPE_COLORS[dt.category]}-800`
              )}
            >
              <span className="text-xs">{dt.name}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleRemove(dt.id)}
                  className="ml-1 hover:bg-gray-200 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}

      {/* Document Type Selector */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              'w-full justify-between',
              !selectedDocumentTypes.length && 'text-gray-600'
            )}
            disabled={disabled}
          >
            {getDisplayValue()}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <div className="flex items-center border-b px-3">
              <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
              <CommandInput
                placeholder="Search document types..."
                value={searchValue}
                onValueChange={setSearchValue}
                className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            <CommandList className="max-h-[300px] overflow-y-auto">
              {isLoading ? (
                <div className="p-4 text-center text-sm text-gray-600">
                  Loading document types...
                </div>
              ) : Object.keys(groupedDocumentTypes).length === 0 ? (
                <CommandEmpty>No document types found.</CommandEmpty>
              ) : (
                Object.entries(groupedDocumentTypes).map(([categoryKey, categoryDocumentTypes]) => (
                  <CommandGroup 
                    key={categoryKey} 
                    heading={DOCUMENT_TYPE_DISPLAY_NAMES[categoryKey as DocumentCategory]}
                  >
                    {categoryDocumentTypes.map((documentType) => (
                      <CommandItem
                        key={documentType.id}
                        value={`${documentType.name} ${documentType.code}`}
                        onSelect={() => handleSelect(documentType)}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center space-x-2">
                          <div className="flex items-center space-x-2">
                            <Check
                              className={cn(
                                'mr-2 h-4 w-4',
                                isSelected(documentType) ? 'opacity-100' : 'opacity-0'
                              )}
                            />
                            <div>
                              <div className="font-medium">{documentType.name}</div>
                              <div className="text-xs text-gray-600">
                                {documentType.code}
                                {documentType.description && ` • ${documentType.description}`}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-1">
                          {documentType.isGovernmentIssued && (
                            <Badge variant="outline" className="text-xs">
                              Govt
                            </Badge>
                          )}
                          {documentType.requiresVerification && (
                            <Badge variant="outline" className="text-xs">
                              Verify
                            </Badge>
                          )}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ))
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Help Text */}
      {multiple && (
        <p className="text-xs text-gray-600">
          Select multiple document types that are applicable for this client.
        </p>
      )}
    </div>
  );
};

export default DocumentTypeSelector;
