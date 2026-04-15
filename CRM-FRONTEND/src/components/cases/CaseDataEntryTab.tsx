import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Save, CheckCircle, AlertCircle, FileText, Loader2 } from 'lucide-react';
import { useCaseDataEntry, useCaseDataTemplate, useSaveCaseDataEntry } from '@/hooks/useCaseData';
import type { CaseDataTemplateField } from '@/services/caseDataService';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';

interface CaseDataEntryTabProps {
  caseId: string;
  clientId?: number;
  productId?: number;
  readonly?: boolean;
}

export function CaseDataEntryTab({
  caseId,
  clientId,
  productId,
  readonly = false,
}: CaseDataEntryTabProps) {
  const { data: entry, isLoading: entryLoading } = useCaseDataEntry(caseId);
  const { data: template, isLoading: templateLoading } = useCaseDataTemplate(clientId, productId);
  const saveMutation = useSaveCaseDataEntry(caseId);

  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [isDirty, setIsDirty] = useState(false);

  // Populate form data from existing entry or defaults
  useEffect(() => {
    if (entry?.data) {
      setFormData(entry.data as Record<string, unknown>);
    } else if (template?.fields) {
      const defaults: Record<string, unknown> = {};
      for (const field of template.fields) {
        if (field.defaultValue != null) {
          defaults[field.fieldKey] =
            field.fieldType === 'NUMBER'
              ? Number(field.defaultValue)
              : field.fieldType === 'BOOLEAN'
                ? field.defaultValue === 'true'
                : field.defaultValue;
        }
      }
      setFormData(defaults);
    }
  }, [entry, template]);

  const handleFieldChange = (fieldKey: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [fieldKey]: value }));
    setIsDirty(true);
  };

  const handleSave = async (markComplete = false) => {
    try {
      await saveMutation.mutateAsync({
        data: formData,
        isCompleted: markComplete || undefined,
      });
      setIsDirty(false);
      toast.success(markComplete ? 'Data entry completed' : 'Data saved');
    } catch (error) {
      logger.error('Failed to save case data:', error);
      toast.error('Failed to save data');
    }
  };

  if (entryLoading || templateLoading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-green-600 mr-2" />
          <span>Loading data entry form...</span>
        </CardContent>
      </Card>
    );
  }

  if (!template) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Data Entry Template</h3>
          <p className="text-gray-600">
            No data entry template has been configured for this client and product combination.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Group fields by section
  const sections = new Map<string, CaseDataTemplateField[]>();
  for (const field of template.fields || []) {
    if (!field.isActive) { continue; }
    const section = field.section || 'General';
    if (!sections.has(section)) { sections.set(section, []); }
    sections.get(section)?.push(field);
  }

  // Sort fields within each section by displayOrder
  for (const fields of sections.values()) {
    fields.sort((a, b) => a.displayOrder - b.displayOrder);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold">{template.name}</h3>
          {entry?.isCompleted ? (
            <Badge className="bg-green-100 text-green-800">
              <CheckCircle className="h-3 w-3 mr-1" />
              Completed
            </Badge>
          ) : entry ? (
            <Badge className="bg-yellow-100 text-yellow-800">In Progress</Badge>
          ) : (
            <Badge className="bg-gray-100 text-gray-600">Not Started</Badge>
          )}
        </div>
        {!readonly && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSave(false)}
              disabled={!isDirty || saveMutation.isPending}
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              Save Draft
            </Button>
            <Button
              size="sm"
              onClick={() => handleSave(true)}
              disabled={saveMutation.isPending}
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              Mark Complete
            </Button>
          </div>
        )}
      </div>

      {/* Form sections */}
      {Array.from(sections.entries()).map(([sectionName, fields]) => (
        <Card key={sectionName}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{sectionName}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {fields.map((field) => (
                <DynamicField
                  key={field.fieldKey}
                  field={field}
                  value={formData[field.fieldKey]}
                  onChange={(value) => handleFieldChange(field.fieldKey, value)}
                  readonly={readonly || !!entry?.isCompleted}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Dynamic field renderer
function DynamicField({
  field,
  value,
  onChange,
  readonly,
}: {
  field: CaseDataTemplateField;
  value: unknown;
  onChange: (value: unknown) => void;
  readonly: boolean;
}) {
  const fieldId = `field-${field.fieldKey}`;

  return (
    <div className={field.fieldType === 'TEXTAREA' ? 'md:col-span-2' : ''}>
      <Label htmlFor={fieldId} className="mb-1.5 block">
        {field.fieldLabel}
        {field.isRequired && <span className="text-red-500 ml-1">*</span>}
      </Label>

      {field.fieldType === 'TEXT' && (
        <Input
          id={fieldId}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder || ''}
          disabled={readonly}
        />
      )}

      {field.fieldType === 'NUMBER' && (
        <Input
          id={fieldId}
          type="number"
          value={value != null ? String(value) : ''}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
          placeholder={field.placeholder || ''}
          disabled={readonly}
        />
      )}

      {field.fieldType === 'DATE' && (
        <Input
          id={fieldId}
          type="date"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={readonly}
        />
      )}

      {field.fieldType === 'TEXTAREA' && (
        <Textarea
          id={fieldId}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder || ''}
          disabled={readonly}
          rows={3}
        />
      )}

      {field.fieldType === 'SELECT' && (
        <Select
          value={typeof value === 'string' ? value : ''}
          onValueChange={onChange}
          disabled={readonly}
        >
          <SelectTrigger>
            <SelectValue placeholder={field.placeholder || 'Select...'} />
          </SelectTrigger>
          <SelectContent>
            {(field.options || []).map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {field.fieldType === 'BOOLEAN' && (
        <div className="flex items-center gap-2 pt-1">
          <Switch
            id={fieldId}
            checked={value === true || value === 'true'}
            onCheckedChange={onChange}
            disabled={readonly}
          />
          <Label htmlFor={fieldId} className="text-sm text-gray-600">
            {value === true || value === 'true' ? 'Yes' : 'No'}
          </Label>
        </div>
      )}

      {field.fieldType === 'MULTISELECT' && (
        <div className="flex flex-wrap gap-2 pt-1">
          {(field.options || []).map((opt) => {
            const selected = Array.isArray(value) && value.includes(opt.value);
            return (
              <Badge
                key={opt.value}
                variant={selected ? 'default' : 'outline'}
                className={`cursor-pointer ${readonly ? 'pointer-events-none' : ''}`}
                onClick={() => {
                  if (readonly) { return; }
                  const current = Array.isArray(value) ? [...value] : [];
                  if (selected) {
                    onChange(current.filter((v: string) => v !== opt.value));
                  } else {
                    onChange([...current, opt.value]);
                  }
                }}
              >
                {opt.label}
              </Badge>
            );
          })}
        </div>
      )}

      {!field.isRequired && !value && !readonly && (
        <p className="text-xs text-gray-400 mt-1">Optional</p>
      )}
      {field.isRequired && !value && !readonly && (
        <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" /> Required
        </p>
      )}
    </div>
  );
}
