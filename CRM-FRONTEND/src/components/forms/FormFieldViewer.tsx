import React from 'react';
import { Check, X, FileText, Calendar, Hash, Type, List, MessageSquare } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { FormField } from '@/types/form';

interface FormFieldViewerProps {
  field: FormField;
  readonly?: boolean;
  onChange?: (value: any) => void;
}

export function FormFieldViewer({ field, readonly = true, onChange }: FormFieldViewerProps) {
  const getFieldIcon = (type: FormField['type']) => {
    switch (type) {
      case 'text':
        return <Type className="h-4 w-4" />;
      case 'number':
        return <Hash className="h-4 w-4" />;
      case 'date':
        return <Calendar className="h-4 w-4" />;
      case 'select':
      case 'radio':
        return <List className="h-4 w-4" />;
      case 'textarea':
        return <MessageSquare className="h-4 w-4" />;
      case 'file':
        return <FileText className="h-4 w-4" />;
      default:
        return <Type className="h-4 w-4" />;
    }
  };

  const renderFieldValue = () => {
    if (readonly) {
      return renderReadOnlyField();
    }
    return renderEditableField();
  };

  const renderReadOnlyField = () => {
    switch (field.type) {
      case 'checkbox':
        return (
          <div className="flex items-center space-x-2">
            {field.value ? (
              <Check className="h-4 w-4 text-green-600" />
            ) : (
              <X className="h-4 w-4 text-red-600" />
            )}
            <span className="text-sm">
              {field.value ? 'Yes' : 'No'}
            </span>
          </div>
        );

      case 'select':
      case 'radio':
        const selectedOption = field.options?.find(opt => opt.value === field.value);
        return (
          <div className="text-sm">
            {selectedOption ? selectedOption.label : field.value || 'Not selected'}
          </div>
        );

      case 'textarea':
        return (
          <div className="text-sm whitespace-pre-wrap bg-muted/50 rounded-md p-3 min-h-[80px]">
            {field.value || 'No value provided'}
          </div>
        );

      case 'file':
        if (Array.isArray(field.value)) {
          return (
            <div className="space-y-2">
              {field.value.map((file: any, index: number) => (
                <div key={index} className="flex items-center space-x-2 text-sm">
                  <FileText className="h-4 w-4" />
                  <span>{file.name || `File ${index + 1}`}</span>
                  {file.size && (
                    <Badge variant="outline" className="text-xs">
                      {(file.size / 1024).toFixed(1)} KB
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          );
        }
        return <span className="text-sm text-muted-foreground">No files</span>;

      case 'date':
        return (
          <div className="text-sm">
            {field.value ? new Date(field.value).toLocaleDateString() : 'No date selected'}
          </div>
        );

      default:
        return (
          <div className="text-sm">
            {field.value || 'No value provided'}
          </div>
        );
    }
  };

  const renderEditableField = () => {
    switch (field.type) {
      case 'text':
      case 'number':
        return (
          <Input
            type={field.type}
            value={field.value || ''}
            onChange={(e) => onChange?.(e.target.value)}
            placeholder={field.placeholder}
            disabled={field.disabled}
          />
        );

      case 'textarea':
        return (
          <Textarea
            value={field.value || ''}
            onChange={(e) => onChange?.(e.target.value)}
            placeholder={field.placeholder}
            disabled={field.disabled}
            rows={3}
          />
        );

      case 'select':
        return (
          <Select
            value={field.value || ''}
            onValueChange={onChange}
            disabled={field.disabled}
          >
            <SelectTrigger>
              <SelectValue placeholder={field.placeholder || 'Select an option'} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'checkbox':
        return (
          <div className="flex items-center space-x-2">
            <Checkbox
              checked={field.value || false}
              onCheckedChange={onChange}
              disabled={field.disabled}
            />
            <Label className="text-sm">
              {field.placeholder || 'Check if applicable'}
            </Label>
          </div>
        );

      case 'date':
        return (
          <Input
            type="date"
            value={field.value || ''}
            onChange={(e) => onChange?.(e.target.value)}
            disabled={field.disabled}
          />
        );

      case 'radio':
        return (
          <div className="space-y-2">
            {field.options?.map((option) => (
              <div key={option.value} className="flex items-center space-x-2">
                <input
                  type="radio"
                  id={`${field.id}-${option.value}`}
                  name={field.id}
                  value={option.value}
                  checked={field.value === option.value}
                  onChange={(e) => onChange?.(e.target.value)}
                  disabled={field.disabled}
                  className="h-4 w-4"
                />
                <Label htmlFor={`${field.id}-${option.value}`} className="text-sm">
                  {option.label}
                </Label>
              </div>
            ))}
          </div>
        );

      default:
        return renderReadOnlyField();
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center space-x-2">
        <div className="text-muted-foreground">
          {getFieldIcon(field.type)}
        </div>
        <Label className="text-sm font-medium">
          {field.label}
          {field.required && <span className="text-red-500 ml-1">*</span>}
          {readonly && <span className="text-xs text-muted-foreground ml-2">(Read Only)</span>}
        </Label>
      </div>

      {field.description && (
        <p className="text-xs text-muted-foreground">{field.description}</p>
      )}

      <div className={`${readonly ? 'bg-muted/30 rounded-md p-3' : ''}`}>
        {renderFieldValue()}
      </div>

      {!readonly && field.type === 'file' && (
        <div className="text-xs text-muted-foreground">
          Supported formats: JPG, PNG, PDF (Max 10MB)
        </div>
      )}
    </div>
  );
}
