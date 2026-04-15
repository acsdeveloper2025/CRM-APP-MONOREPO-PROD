import React, { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Eye, Trash2, GripVertical, ChevronDown, Upload } from 'lucide-react';
import { TemplateImportDialog } from '@/components/cases/TemplateImportDialog';
import {
  PREFILL_CATALOG,
  PREFILL_GROUP_ORDER,
  PREFILL_GROUP_LABELS,
} from '@/constants/templateFieldPrefillCatalog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { useClients, useProductsByClient } from '@/hooks/useClients';
import {
  caseDataService,
  type CaseDataTemplate,
  type CaseDataTemplateField,
} from '@/services/caseDataService';

// ---------- Types ----------

type FieldType = CaseDataTemplateField['fieldType'];

const FIELD_TYPES: FieldType[] = [
  'TEXT',
  'NUMBER',
  'DATE',
  'SELECT',
  'MULTISELECT',
  'BOOLEAN',
  'TEXTAREA',
];

interface FieldFormData {
  fieldKey: string;
  fieldLabel: string;
  fieldType: FieldType;
  isRequired: boolean;
  section: string;
  displayOrder: number;
  placeholder: string;
  defaultValue: string;
  options: Array<{ label: string; value: string }>;
  validationRules: {
    min?: string;
    max?: string;
    minLength?: string;
    maxLength?: string;
    pattern?: string;
  };
  // Sprint 5: null = normal dynamic field; non-null = read-only mirror
  // of a system source. Dropdown in the editor lets the admin pick.
  prefillSource: string | null;
}

interface TemplateFormData {
  clientId: string;
  productId: string;
  name: string;
  fields: FieldFormData[];
}

const createEmptyField = (order: number): FieldFormData => ({
  fieldKey: '',
  fieldLabel: '',
  fieldType: 'TEXT',
  isRequired: false,
  section: '',
  displayOrder: order,
  placeholder: '',
  defaultValue: '',
  options: [],
  validationRules: {},
  prefillSource: null,
});

const labelToKey = (label: string): string =>
  label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

// ---------- Field Builder Row ----------

const FieldRow: React.FC<{
  field: FieldFormData;
  index: number;
  onChange: (index: number, field: FieldFormData) => void;
  onRemove: (index: number) => void;
  isViewMode: boolean;
}> = ({ field, index, onChange, onRemove, isViewMode }) => {
  const [validationOpen, setValidationOpen] = useState(false);

  const handleLabelChange = (label: string) => {
    const autoKey = labelToKey(label);
    onChange(index, { ...field, fieldLabel: label, fieldKey: autoKey });
  };

  const needsOptions = field.fieldType === 'SELECT' || field.fieldType === 'MULTISELECT';

  return (
    <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <GripVertical className="h-4 w-4" />
          Field {index + 1}
        </div>
        {!isViewMode && (
          <Button variant="ghost" size="sm" onClick={() => onRemove(index)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div>
          <Label className="text-xs">Field Label</Label>
          <Input
            value={field.fieldLabel}
            onChange={(e) => handleLabelChange(e.target.value)}
            placeholder="e.g. Applicant Name"
            disabled={isViewMode}
          />
        </div>
        <div>
          <Label className="text-xs">Field Key</Label>
          <Input
            value={field.fieldKey}
            onChange={(e) => onChange(index, { ...field, fieldKey: e.target.value })}
            placeholder="auto_generated"
            disabled={isViewMode}
          />
        </div>
        <div>
          <Label className="text-xs">Field Type</Label>
          <Select
            value={field.fieldType}
            onValueChange={(v) => onChange(index, { ...field, fieldType: v as FieldType })}
            disabled={isViewMode}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FIELD_TYPES.map((ft) => (
                <SelectItem key={ft} value={ft}>
                  {ft}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Section</Label>
          <Input
            value={field.section}
            onChange={(e) => onChange(index, { ...field, section: e.target.value })}
            placeholder="e.g. Personal Info"
            disabled={isViewMode}
          />
        </div>
        <div className="flex items-end gap-2 pb-1">
          <div className="flex items-center gap-2">
            <Switch
              checked={field.isRequired}
              onCheckedChange={(checked) => onChange(index, { ...field, isRequired: checked })}
              disabled={isViewMode}
            />
            <Label className="text-xs">Required</Label>
          </div>
        </div>
      </div>

      {/* Sprint 5: map this field to a system source (read-only mirror) */}
      <div>
        <Label className="text-xs">
          Map to system field (optional — makes this field read-only, value comes live from
          the case)
        </Label>
        <Select
          value={field.prefillSource ?? '__none__'}
          onValueChange={(v) =>
            onChange(index, { ...field, prefillSource: v === '__none__' ? null : v })
          }
          disabled={isViewMode}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">— None (dynamic field) —</SelectItem>
            {PREFILL_GROUP_ORDER.map((g) => {
              const items = PREFILL_CATALOG.filter((e) => e.group === g);
              if (items.length === 0) {
                return null;
              }
              return (
                <div key={g}>
                  <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {PREFILL_GROUP_LABELS[g]}
                  </div>
                  {items.map((e) => (
                    <SelectItem key={e.key} value={e.key}>
                      {e.label}
                    </SelectItem>
                  ))}
                </div>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {/* Options for SELECT/MULTISELECT */}
      {needsOptions && (
        <div className="space-y-2">
          <Label className="text-xs font-medium">Options</Label>
          {field.options.map((opt, oi) => (
            <div key={oi} className="flex gap-2 items-center">
              <Input
                className="flex-1"
                value={opt.label}
                onChange={(e) => {
                  const newOpts = [...field.options];
                  newOpts[oi] = {
                    ...newOpts[oi],
                    label: e.target.value,
                    value: labelToKey(e.target.value),
                  };
                  onChange(index, { ...field, options: newOpts });
                }}
                placeholder="Label"
                disabled={isViewMode}
              />
              <Input
                className="flex-1"
                value={opt.value}
                onChange={(e) => {
                  const newOpts = [...field.options];
                  newOpts[oi] = { ...newOpts[oi], value: e.target.value };
                  onChange(index, { ...field, options: newOpts });
                }}
                placeholder="Value"
                disabled={isViewMode}
              />
              {!isViewMode && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const newOpts = field.options.filter((_, i) => i !== oi);
                    onChange(index, { ...field, options: newOpts });
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
          {!isViewMode && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                onChange(index, {
                  ...field,
                  options: [...field.options, { label: '', value: '' }],
                })
              }
            >
              Add Option
            </Button>
          )}
        </div>
      )}

      {/* Validation Rules (collapsible) */}
      <Collapsible open={validationOpen} onOpenChange={setValidationOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="text-xs">
            <ChevronDown
              className={`h-3 w-3 mr-1 transition-transform ${validationOpen ? 'rotate-180' : ''}`}
            />
            Validation Rules
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            <div>
              <Label className="text-xs">Min</Label>
              <Input
                type="number"
                value={field.validationRules.min ?? ''}
                onChange={(e) =>
                  onChange(index, {
                    ...field,
                    validationRules: { ...field.validationRules, min: e.target.value },
                  })
                }
                disabled={isViewMode}
              />
            </div>
            <div>
              <Label className="text-xs">Max</Label>
              <Input
                type="number"
                value={field.validationRules.max ?? ''}
                onChange={(e) =>
                  onChange(index, {
                    ...field,
                    validationRules: { ...field.validationRules, max: e.target.value },
                  })
                }
                disabled={isViewMode}
              />
            </div>
            <div>
              <Label className="text-xs">Min Length</Label>
              <Input
                type="number"
                value={field.validationRules.minLength ?? ''}
                onChange={(e) =>
                  onChange(index, {
                    ...field,
                    validationRules: { ...field.validationRules, minLength: e.target.value },
                  })
                }
                disabled={isViewMode}
              />
            </div>
            <div>
              <Label className="text-xs">Max Length</Label>
              <Input
                type="number"
                value={field.validationRules.maxLength ?? ''}
                onChange={(e) =>
                  onChange(index, {
                    ...field,
                    validationRules: { ...field.validationRules, maxLength: e.target.value },
                  })
                }
                disabled={isViewMode}
              />
            </div>
            <div>
              <Label className="text-xs">Pattern</Label>
              <Input
                value={field.validationRules.pattern ?? ''}
                onChange={(e) =>
                  onChange(index, {
                    ...field,
                    validationRules: { ...field.validationRules, pattern: e.target.value },
                  })
                }
                placeholder="regex"
                disabled={isViewMode}
              />
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

// ---------- Main Page ----------

export const CaseDataTemplatesPage: React.FC = () => {
  const queryClient = useQueryClient();

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit' | 'view'>('create');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  // Form state
  const [form, setForm] = useState<TemplateFormData>({
    clientId: '',
    productId: '',
    name: '',
    fields: [createEmptyField(1)],
  });

  // Queries
  const { data: templatesRes, isLoading: templatesLoading } = useQuery({
    queryKey: ['case-data-templates'],
    queryFn: () => caseDataService.getTemplates(),
  });

  const { data: clientsRes } = useClients({ limit: 200 });
  const clients = useMemo(() => {
    if (!clientsRes?.data) {
      return [];
    }
    return Array.isArray(clientsRes.data) ? clientsRes.data : [];
  }, [clientsRes]);

  const { data: productsRes } = useProductsByClient(form.clientId || undefined);
  const products = useMemo(() => {
    if (!productsRes?.data) {
      return [];
    }
    return Array.isArray(productsRes.data) ? productsRes.data : [];
  }, [productsRes]);

  const templates: CaseDataTemplate[] = useMemo(() => {
    const raw = templatesRes?.data;
    if (!raw) {
      return [];
    }
    // API returns { data: [...], pagination: ... }
    if (typeof raw === 'object' && 'data' in (raw as Record<string, unknown>)) {
      return (raw as { data: CaseDataTemplate[] }).data ?? [];
    }
    return Array.isArray(raw) ? raw : [];
  }, [templatesRes]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof caseDataService.createTemplate>[0]) =>
      caseDataService.createTemplate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case-data-templates'] });
      toast.success('Template created successfully');
      closeDialog();
    },
    onError: (err: { response?: { data?: { message?: string } }; message?: string }) => {
      toast.error(err.response?.data?.message || err.message || 'Failed to create template');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: Parameters<typeof caseDataService.updateTemplate>[1];
    }) => caseDataService.updateTemplate(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case-data-templates'] });
      toast.success('Template updated successfully');
      closeDialog();
    },
    onError: (err: { response?: { data?: { message?: string } }; message?: string }) => {
      toast.error(err.response?.data?.message || err.message || 'Failed to update template');
    },
  });

  // Helpers
  const closeDialog = useCallback(() => {
    setDialogOpen(false);
    setEditingId(null);
    setForm({ clientId: '', productId: '', name: '', fields: [createEmptyField(1)] });
  }, []);

  const openCreate = () => {
    setDialogMode('create');
    setForm({ clientId: '', productId: '', name: '', fields: [createEmptyField(1)] });
    setDialogOpen(true);
  };

  const openEditOrView = async (template: CaseDataTemplate, mode: 'edit' | 'view') => {
    setDialogMode(mode);
    setEditingId(template.id);

    // Fetch full template with fields
    try {
      const res = await caseDataService.getTemplateById(template.id);
      const t = res.data;
      if (!t) {
        return;
      }
      setForm({
        clientId: String(t.clientId),
        productId: String(t.productId),
        name: t.name,
        fields: (t.fields || []).map((f) => ({
          fieldKey: f.fieldKey,
          fieldLabel: f.fieldLabel,
          fieldType: f.fieldType,
          isRequired: f.isRequired,
          section: f.section ?? '',
          displayOrder: f.displayOrder,
          placeholder: f.placeholder ?? '',
          defaultValue: f.defaultValue ?? '',
          options: f.options ?? [],
          validationRules: {
            min: (f.validationRules?.min as string) ?? '',
            max: (f.validationRules?.max as string) ?? '',
            minLength: (f.validationRules?.minLength as string) ?? '',
            maxLength: (f.validationRules?.maxLength as string) ?? '',
            pattern: (f.validationRules?.pattern as string) ?? '',
          },
          prefillSource: f.prefillSource ?? null,
        })),
      });
      setDialogOpen(true);
    } catch {
      toast.error('Failed to load template details');
    }
  };

  const handleFieldChange = (index: number, field: FieldFormData) => {
    setForm((prev) => {
      const fields = [...prev.fields];
      fields[index] = field;
      return { ...prev, fields };
    });
  };

  const handleAddField = () => {
    setForm((prev) => ({
      ...prev,
      fields: [...prev.fields, createEmptyField(prev.fields.length + 1)],
    }));
  };

  const handleRemoveField = (index: number) => {
    setForm((prev) => ({
      ...prev,
      fields: prev.fields
        .filter((_, i) => i !== index)
        .map((f, i) => ({ ...f, displayOrder: i + 1 })),
    }));
  };

  const cleanValidationRules = (
    rules: FieldFormData['validationRules']
  ): Record<string, unknown> => {
    const cleaned: Record<string, unknown> = {};
    if (rules.min) {
      cleaned.min = Number(rules.min);
    }
    if (rules.max) {
      cleaned.max = Number(rules.max);
    }
    if (rules.minLength) {
      cleaned.minLength = Number(rules.minLength);
    }
    if (rules.maxLength) {
      cleaned.maxLength = Number(rules.maxLength);
    }
    if (rules.pattern) {
      cleaned.pattern = rules.pattern;
    }
    return cleaned;
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      toast.error('Template name is required');
      return;
    }
    if (!form.clientId) {
      toast.error('Client is required');
      return;
    }
    if (!form.productId) {
      toast.error('Product is required');
      return;
    }
    if (form.fields.length === 0 || !form.fields[0]?.fieldLabel) {
      toast.error('At least one field with a label is required');
      return;
    }

    const fieldsPayload = form.fields
      .filter((f) => f.fieldLabel.trim())
      .map((f) => ({
        fieldKey: f.fieldKey || labelToKey(f.fieldLabel),
        fieldLabel: f.fieldLabel,
        fieldType: f.fieldType,
        isRequired: f.isRequired,
        displayOrder: f.displayOrder,
        section: f.section || null,
        placeholder: f.placeholder || null,
        defaultValue: f.defaultValue || null,
        options: f.options.filter((o) => o.label && o.value),
        validationRules: cleanValidationRules(f.validationRules),
        prefillSource: f.prefillSource ?? null,
      }));

    if (dialogMode === 'edit' && editingId) {
      updateMutation.mutate({
        id: editingId,
        data: { name: form.name, fields: fieldsPayload },
      });
    } else {
      createMutation.mutate({
        clientId: Number(form.clientId),
        productId: Number(form.productId),
        name: form.name,
        fields: fieldsPayload,
      });
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const isViewMode = dialogMode === 'view';

  // Build a lookup map for client/product names
  const clientMap = useMemo(() => {
    const map = new Map<number, string>();
    clients.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [clients]);

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Case Data Templates</h1>
          <p className="text-muted-foreground text-sm">
            Define data entry templates for client-product combinations
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Upload Excel / CSV
          </Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Create Template
          </Button>
        </div>
      </div>

      {/* Template List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Templates</CardTitle>
        </CardHeader>
        <CardContent>
          {templatesLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No templates found. Create your first template to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Template Name</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Fields</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>{clientMap.get(t.clientId) ?? `Client #${t.clientId}`}</TableCell>
                      <TableCell>{`Product #${t.productId}`}</TableCell>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell>v{t.version}</TableCell>
                      <TableCell>{t.fields?.length ?? 0}</TableCell>
                      <TableCell>
                        <Badge variant={t.isActive ? 'default' : 'secondary'}>
                          {t.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditOrView(t, 'view')}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditOrView(t, 'edit')}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit / View Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === 'create'
                ? 'Create Template'
                : dialogMode === 'edit'
                  ? 'Edit Template'
                  : 'View Template'}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === 'view'
                ? 'Template configuration details'
                : 'Configure the data entry template fields'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Client + Product + Name */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label>Client</Label>
                <Select
                  value={form.clientId}
                  onValueChange={(v) =>
                    setForm((prev) => ({ ...prev, clientId: v, productId: '' }))
                  }
                  disabled={isViewMode || dialogMode === 'edit'}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Product</Label>
                <Select
                  value={form.productId}
                  onValueChange={(v) => setForm((prev) => ({ ...prev, productId: v }))}
                  disabled={isViewMode || dialogMode === 'edit' || !form.clientId}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={form.clientId ? 'Select product' : 'Select client first'}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Template Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Employment Verification"
                  disabled={isViewMode}
                />
              </div>
            </div>

            {/* Fields Builder */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Fields ({form.fields.length})</Label>
                {!isViewMode && (
                  <Button variant="outline" size="sm" onClick={handleAddField}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Field
                  </Button>
                )}
              </div>

              {form.fields.map((field, i) => (
                <FieldRow
                  key={i}
                  field={field}
                  index={i}
                  onChange={handleFieldChange}
                  onRemove={handleRemoveField}
                  isViewMode={isViewMode}
                />
              ))}

              {form.fields.length === 0 && (
                <div className="text-center py-4 text-sm text-muted-foreground border border-dashed rounded-lg">
                  No fields added yet. Click &quot;Add Field&quot; to start building the template.
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              {isViewMode ? 'Close' : 'Cancel'}
            </Button>
            {!isViewMode && (
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving
                  ? 'Saving...'
                  : dialogMode === 'edit'
                    ? 'Update Template'
                    : 'Create Template'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TemplateImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
};
