import { Check, X, FileText, Calendar, Hash, Type, List, MessageSquare } from 'lucide-react';
import { Input } from '@/ui/components/input';
import { Textarea } from '@/ui/components/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/components/select';
import { Checkbox } from '@/ui/components/checkbox';
import { Badge } from '@/ui/components/badge';
import { Label } from '@/ui/components/label';
import { FormField } from '@/types/form';
import { Box } from '@/ui/primitives/Box';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';

interface FormFieldViewerProps {
  field: FormField;
  readonly?: boolean;
  onChange?: (value: unknown) => void;
}

export function FormFieldViewer({ field, readonly = true, onChange }: FormFieldViewerProps) {
  const getFieldIcon = (type: FormField['type']) => {
    switch (type) {
      case 'text':
        return <Type size={16} />;
      case 'number':
        return <Hash size={16} />;
      case 'date':
        return <Calendar size={16} />;
      case 'select':
      case 'radio':
        return <List size={16} />;
      case 'textarea':
        return <MessageSquare size={16} />;
      case 'file':
        return <FileText size={16} />;
      default:
        return <Type size={16} />;
    }
  };

  const renderReadOnlyField = () => {
    switch (field.type) {
      case 'checkbox':
        return (
          <Stack direction="horizontal" gap={2} align="center">
            {field.value ? (
              <Check size={16} style={{ color: 'var(--ui-success)' }} />
            ) : (
              <X size={16} style={{ color: 'var(--ui-danger)' }} />
            )}
            <Text as="span" variant="body-sm">{field.value ? 'Yes' : 'No'}</Text>
          </Stack>
        );

      case 'select':
      case 'radio': {
        const selectedOption = field.options?.find((opt) => opt.value === field.value);
        return <Text>{selectedOption ? selectedOption.label : (field.value as string) || 'Not selected'}</Text>;
      }

      case 'textarea':
        return (
          <Box style={{ whiteSpace: 'pre-wrap', background: 'var(--ui-surface-muted)', borderRadius: 'var(--ui-radius-md)', padding: '0.75rem', minHeight: '5rem' }}>
            <Text>{(field.value as string) || 'No value provided'}</Text>
          </Box>
        );

      case 'file':
        if (Array.isArray(field.value)) {
          return (
            <Stack gap={2}>
              {field.value.map((file: unknown, index: number) => {
                const fileObj = file as { name?: string; size?: number };
                return (
                  <Stack key={index} direction="horizontal" gap={2} align="center">
                    <FileText size={16} />
                    <Text as="span" variant="body-sm">{fileObj.name || `File ${index + 1}`}</Text>
                    {fileObj.size ? <Badge variant="outline">{(fileObj.size / 1024).toFixed(1)} KB</Badge> : null}
                  </Stack>
                );
              })}
            </Stack>
          );
        }
        return <Text as="span" variant="body-sm" tone="muted">No files</Text>;

      case 'date':
        return <Text>{field.value ? new Date(field.value as string).toLocaleDateString() : 'No date selected'}</Text>;

      default:
        return <Text>{(field.value as string) || 'No value provided'}</Text>;
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
          <Stack direction="horizontal" gap={2} align="center">
            <Checkbox checked={(field.value as boolean) || false} onCheckedChange={onChange} />
            <Label>{field.label}</Label>
          </Stack>
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
          <Stack gap={2}>
            {field.options?.map((option) => (
              <Stack key={option.value} direction="horizontal" gap={2} align="center">
                <input
                  type="radio"
                  id={`${field.id}-${option.value}`}
                  name={field.id}
                  value={option.value}
                  checked={field.value === option.value}
                  onChange={(e) => onChange?.(e.target.value)}
                  style={{ width: '1rem', height: '1rem' }}
                />
                <Label htmlFor={`${field.id}-${option.value}`}>{option.label}</Label>
              </Stack>
            ))}
          </Stack>
        );
      default:
        return renderReadOnlyField();
    }
  };

  return (
    <Stack gap={2}>
      <Stack direction="horizontal" gap={2} align="center">
        <Box style={{ color: 'var(--ui-text-muted)' }}>{getFieldIcon(field.type)}</Box>
        <Label>
          {field.label}
          {field.isRequired ? <Text as="span" tone="danger" style={{ marginLeft: '0.25rem' }}>*</Text> : null}
          {readonly ? <Text as="span" variant="caption" tone="muted" style={{ marginLeft: '0.5rem' }}>(Read Only)</Text> : null}
        </Label>
      </Stack>

      <Box style={readonly ? { background: 'var(--ui-surface-muted)', borderRadius: 'var(--ui-radius-md)', padding: '0.75rem' } : undefined}>
        {readonly ? renderReadOnlyField() : renderEditableField()}
      </Box>

      {!readonly && field.type === 'file' ? (
        <Text variant="caption" tone="muted">Supported formats: JPG, PNG, PDF (Max 10MB)</Text>
      ) : null}
    </Stack>
  );
}
