import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useStandardizedMutation } from '@/hooks/useStandardizedMutation';
import { Upload, Loader2, FileSpreadsheet, X, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useClients, useProductsByClient } from '@/hooks/useClients';
import { caseDataService, type CaseDataTemplateField } from '@/services/caseDataService';
import {
  PREFILL_CATALOG,
  PREFILL_GROUP_ORDER,
  PREFILL_GROUP_LABELS,
  suggestPrefillSourceForHeader,
} from '@/constants/templateFieldPrefillCatalog';
import { toast } from 'sonner';

// Fields returned by the parse endpoint (server already strips id/templateId/
// isActive/createdAt/updatedAt from what a caller would send back to /POST).
type DraftField = Omit<
  CaseDataTemplateField,
  'id' | 'templateId' | 'isActive' | 'createdAt' | 'updatedAt'
>;

const FIELD_TYPES: CaseDataTemplateField['fieldType'][] = [
  'TEXT',
  'NUMBER',
  'DATE',
  'SELECT',
  'MULTISELECT',
  'BOOLEAN',
  'TEXTAREA',
];

interface TemplateImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = 'pick' | 'preview';

export function TemplateImportDialog({ open, onOpenChange }: TemplateImportDialogProps) {
  const queryClient = useQueryClient();
  const { data: clientsRes } = useClients({ limit: 200 });
  // The service returns `{ data: Client[] }` (see CaseDataTemplatesPage
  // which reads clientsRes.data as an array). Keep the same shape here
  // so both entry points go through the same unwrap.
  const clients = useMemo<Array<{ id: number; name: string }>>(() => {
    const d = (clientsRes as { data?: Array<{ id: number; name: string }> } | undefined)?.data;
    return Array.isArray(d) ? d : [];
  }, [clientsRes]);

  const [step, setStep] = useState<Step>('pick');
  const [clientId, setClientId] = useState<string>('');
  const [productId, setProductId] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [templateName, setTemplateName] = useState<string>('');
  const [fields, setFields] = useState<DraftField[]>([]);
  // null → saving will CREATE a new template; non-null → saving will
  // UPDATE this id (triggers the versioning logic on the backend).
  const [existingTemplateId, setExistingTemplateId] = useState<number | null>(null);
  const [existingTemplateVersion, setExistingTemplateVersion] = useState<number | null>(null);

  const { data: productsRes } = useProductsByClient(clientId || undefined);
  const products = useMemo<Array<{ id: number; name: string }>>(() => {
    const d = (productsRes as { data?: Array<{ id: number; name: string }> } | undefined)?.data;
    return Array.isArray(d) ? d : [];
  }, [productsRes]);

  const resetAll = () => {
    setStep('pick');
    setClientId('');
    setProductId('');
    setFile(null);
    setTemplateName('');
    setFields([]);
    setExistingTemplateId(null);
    setExistingTemplateVersion(null);
  };

  const closeDialog = () => {
    resetAll();
    onOpenChange(false);
  };

  const parseMutation = useStandardizedMutation({
    mutationFn: async () => {
      if (!file || !clientId || !productId) {
        throw new Error('Client, product, and file are required');
      }
      return caseDataService.parseUpload(Number(clientId), Number(productId), file);
    },
    errorContext: 'Template Parse',
    onSuccess: (res) => {
      const payload = (
        res as {
          data?: {
            fields?: DraftField[];
            sheetName?: string | null;
            existingTemplateId?: number | null;
            existingTemplateVersion?: number | null;
          };
        }
      ).data;
      if (!payload?.fields?.length) {
        toast.error('No fields found in file');
        return;
      }
      // Heuristic auto-suggest a mapping for each parsed field. The
      // admin can clear or change any suggestion on the preview screen.
      const withSuggestions: DraftField[] = payload.fields.map((f) => ({
        ...f,
        prefillSource: suggestPrefillSourceForHeader(f.fieldLabel),
      }));
      setFields(withSuggestions);
      setExistingTemplateId(payload.existingTemplateId ?? null);
      setExistingTemplateVersion(payload.existingTemplateVersion ?? null);
      // Default the template name to "<ClientName> — <ProductName>" as a
      // convenience; admin can override in the preview.
      const cName = clients.find((c) => String(c.id) === clientId)?.name ?? 'Template';
      const pName = products.find((p) => String(p.id) === productId)?.name ?? '';
      setTemplateName(`${cName}${pName ? ` — ${pName}` : ''}`);
      setStep('preview');
    },
  });

  const saveMutation = useStandardizedMutation({
    mutationFn: async () => {
      if (existingTemplateId !== null) {
        // Update existing — backend triggers the versioning logic:
        // new version if cases have entries on it, otherwise in-place
        // field replacement.
        return caseDataService.updateTemplate(existingTemplateId, {
          name: templateName.trim(),
          fields,
        });
      }
      return caseDataService.createTemplate({
        clientId: Number(clientId),
        productId: Number(productId),
        name: templateName.trim(),
        fields,
      });
    },
    successMessage: existingTemplateId !== null ? 'Template replaced' : 'Template created',
    errorContext: 'Template Save',
    errorFallbackMessage: 'Failed to save template',
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case-data-templates'] });
      closeDialog();
    },
  });

  const updateField = (idx: number, patch: Partial<DraftField>) => {
    setFields((prev) => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  };

  const removeField = (idx: number) => {
    setFields((prev) => prev.filter((_, i) => i !== idx));
  };

  const addOption = (idx: number) => {
    setFields((prev) =>
      prev.map((f, i) =>
        i === idx ? { ...f, options: [...(f.options ?? []), { label: '', value: '' }] } : f
      )
    );
  };

  const updateOption = (
    fieldIdx: number,
    optIdx: number,
    patch: { label?: string; value?: string }
  ) => {
    setFields((prev) =>
      prev.map((f, i) =>
        i !== fieldIdx
          ? f
          : {
              ...f,
              options: (f.options ?? []).map((o, oi) => (oi === optIdx ? { ...o, ...patch } : o)),
            }
      )
    );
  };

  const removeOption = (fieldIdx: number, optIdx: number) => {
    setFields((prev) =>
      prev.map((f, i) =>
        i !== fieldIdx ? f : { ...f, options: (f.options ?? []).filter((_, oi) => oi !== optIdx) }
      )
    );
  };

  const canParse = !!(clientId && productId && file);
  const canSave =
    fields.length > 0 &&
    templateName.trim().length > 0 &&
    fields.every((f) => {
      // Guardrail: a SELECT/MULTISELECT with no options won't pass backend
      // validation, so block save client-side with a clear inline hint.
      if (f.fieldType === 'SELECT' || f.fieldType === 'MULTISELECT') {
        return (f.options ?? []).length > 0 && f.options.every((o) => o.value.trim());
      }
      return true;
    });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          resetAll();
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Template from Excel / CSV
          </DialogTitle>
          <DialogDescription>
            {step === 'pick'
              ? 'Choose the client, product, and the file. Field types default to TEXT — you can adjust them on the next screen.'
              : 'Review the parsed fields. Change field type, mark required, add options for dropdowns, then save.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'pick' && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="import-client">Client</Label>
              <Select
                value={clientId}
                onValueChange={(v) => {
                  setClientId(v);
                  setProductId('');
                }}
              >
                <SelectTrigger id="import-client">
                  <SelectValue placeholder="Select client…" />
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
              <Label htmlFor="import-product">Product</Label>
              <Select value={productId} onValueChange={setProductId} disabled={!clientId}>
                <SelectTrigger id="import-product">
                  <SelectValue placeholder={clientId ? 'Select product…' : 'Pick a client first'} />
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
              <Label htmlFor="import-file">File (.xlsx or .csv, max 2 MB)</Label>
              <Input
                id="import-file"
                type="file"
                // Extensions only — including the MIME types causes macOS
                // to hide .xlsx files when the OS can't resolve the UTI
                // mapping. Real format validation happens on the backend
                // (multer fileFilter rejects anything non-xlsx/csv).
                accept=".xlsx,.csv"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              {file && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <FileSpreadsheet className="h-3 w-3" />
                  {file.name} · {(file.size / 1024).toFixed(1)} KB
                </p>
              )}
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            {existingTemplateId !== null && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <p className="font-medium">Replacing existing template</p>
                <p className="text-xs">
                  An active template (v{existingTemplateVersion}) already exists for this client +
                  product. Saving will{' '}
                  <strong>
                    create a new version if any case already has data on the current template
                  </strong>
                  ; otherwise fields are replaced in place.
                </p>
              </div>
            )}
            <div>
              <Label htmlFor="import-name">Template Name</Label>
              <Input
                id="import-name"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g. Bajaj Finance — Home Loan"
              />
            </div>

            <div className="border rounded-md divide-y">
              {fields.map((f, idx) => {
                const needsOptions = f.fieldType === 'SELECT' || f.fieldType === 'MULTISELECT';
                return (
                  <div key={`${f.fieldKey}_${idx}`} className="p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Label</Label>
                          <Input
                            value={f.fieldLabel}
                            onChange={(e) => updateField(idx, { fieldLabel: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Type</Label>
                          <Select
                            value={f.fieldType}
                            onValueChange={(v) =>
                              updateField(idx, {
                                fieldType: v as CaseDataTemplateField['fieldType'],
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {FIELD_TYPES.map((t) => (
                                <SelectItem key={t} value={t}>
                                  {t}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="flex flex-col items-center gap-1 pt-5">
                        <Label className="text-xs">Required</Label>
                        <Switch
                          checked={f.isRequired}
                          onCheckedChange={(checked) => updateField(idx, { isRequired: checked })}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeField(idx)}
                        className="mt-5 text-red-600"
                        title="Remove field"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Field key: <code className="bg-muted px-1 rounded">{f.fieldKey}</code>
                    </p>

                    <div>
                      <Label className="text-xs">
                        Map to system field (optional — makes the field read-only, value comes live
                        from the case)
                      </Label>
                      <Select
                        value={f.prefillSource ?? '__none__'}
                        onValueChange={(v) =>
                          updateField(idx, {
                            prefillSource: v === '__none__' ? null : v,
                          })
                        }
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

                    {needsOptions && (
                      <div className="pl-2 border-l-2 border-muted space-y-1">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">Options</Label>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => addOption(idx)}
                            className="h-6 text-xs"
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Add option
                          </Button>
                        </div>
                        {(f.options ?? []).length === 0 && (
                          <p className="text-xs text-red-500">
                            {f.fieldType} fields need at least one option.
                          </p>
                        )}
                        {(f.options ?? []).map((opt, oi) => (
                          <div key={oi} className="flex gap-2 items-center">
                            <Input
                              value={opt.label}
                              onChange={(e) => updateOption(idx, oi, { label: e.target.value })}
                              placeholder="Label"
                              className="h-7 text-xs"
                            />
                            <Input
                              value={opt.value}
                              onChange={(e) => updateOption(idx, oi, { value: e.target.value })}
                              placeholder="Value"
                              className="h-7 text-xs"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-red-600"
                              onClick={() => removeOption(idx, oi)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={closeDialog}>
            Cancel
          </Button>
          {step === 'pick' && (
            <Button
              onClick={() => parseMutation.mutate()}
              disabled={!canParse || parseMutation.isPending}
            >
              {parseMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-1" />
              )}
              Parse File
            </Button>
          )}
          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => setStep('pick')}>
                Back
              </Button>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={!canSave || saveMutation.isPending}
              >
                {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                {existingTemplateId !== null ? 'Replace Template' : 'Save Template'} (
                {fields.length} fields)
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
