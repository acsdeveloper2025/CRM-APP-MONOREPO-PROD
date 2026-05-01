import { Check, X, FileText, Calendar, Hash, Type, List, MessageSquare } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { FormField } from '@/types/form';

interface FormFieldViewerProps {
  field: FormField;
  readonly?: boolean;
  onChange?: (value: unknown) => void;
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
            <span className="text-sm">{field.value ? 'Yes' : 'No'}</span>
          </div>
        );

      case 'select':
      case 'radio': {
        const selectedOption = field.options?.find((opt) => opt.value === field.value);
        return (
          <div className="text-sm">
            {selectedOption ? selectedOption.label : (field.value as string) || 'Not selected'}
          </div>
        );
      }

      case 'textarea':
        return (
          <div className="text-sm whitespace-pre-wrap bg-slate-100/70 dark:bg-slate-800/50 rounded-md p-3 min-h-20">
            {(field.value as string) || 'No value provided'}
          </div>
        );

      case 'file':
        if (Array.isArray(field.value)) {
          return (
            <div className="space-y-2">
              {field.value.map((file: unknown, index: number) => {
                const fileObj = file as { name?: string; size?: number };
                return (
                  <div key={index} className="flex items-center space-x-2 text-sm">
                    <FileText className="h-4 w-4" />
                    <span>{fileObj.name || `File ${index + 1}`}</span>
                    {fileObj.size && (
                      <Badge variant="outline" className="text-xs">
                        {(fileObj.size / 1024).toFixed(1)} KB
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          );
        }
        return <span className="text-sm text-gray-600">No files</span>;

      case 'date':
        return (
          <div className="text-sm">
            {field.value
              ? new Date(field.value as string).toLocaleDateString()
              : 'No date selected'}
          </div>
        );

      default:
        return <div className="text-sm">{(field.value as string) || 'No value provided'}</div>;
    }
  };

  const renderEditableField = () => {
    switch (field.type) {
      case 'text':
      case 'number':
        return (
          <Input
            type={field.type}
            value={(field.value as string) || ''}
            onChange={(e) => onChange?.(e.target.value)}
          />
        );

      case 'textarea':
        return (
          <Textarea
            value={(field.value as string) || ''}
            onChange={(e) => onChange?.(e.target.value)}
            rows={3}
          />
        );

      case 'select':
        return (
          <Select value={(field.value as string) || ''} onValueChange={onChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select an option" />
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
            <Checkbox checked={(field.value as boolean) || false} onCheckedChange={onChange} />
            <Label className="text-sm">{field.label}</Label>
          </div>
        );

      case 'date':
        return (
          <Input
            type="date"
            value={(field.value as string) || ''}
            onChange={(e) => onChange?.(e.target.value)}
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
                  className="h-4 w-4"
                  aria-label={option.label}
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
        <div className="text-gray-600">{getFieldIcon(field.type)}</div>
        <Label className="text-sm font-medium">
          {field.label}
          {field.isRequired && <span className="text-red-500 ml-1">*</span>}
          {readonly && <span className="text-xs text-gray-600 ml-2">(Read Only)</span>}
        </Label>
      </div>

      <div className={`${readonly ? 'bg-slate-100/50 dark:bg-slate-800/40 rounded-md p-3' : ''}`}>
        {renderFieldValue()}
      </div>

      {!readonly && field.type === 'file' && (
        <div className="text-xs text-gray-600">Supported formats: JPG, PNG, PDF (Max 10MB)</div>
      )}
    </div>
  );
}
