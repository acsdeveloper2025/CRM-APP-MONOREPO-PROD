import { useMemo, useState } from 'react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
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
import { toast } from 'sonner';
import { logger } from '@/utils/logger';

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
  const clients = useMemo(
    () =>
      (clientsRes as unknown as { data?: { data?: Array<{ id: number; name: string }> } })?.data
        ?.data ?? [],
    [clientsRes]
  );

  const [step, setStep] = useState<Step>('pick');
  const [clientId, setClientId] = useState<string>('');
  const [productId, setProductId] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [templateName, setTemplateName] = useState<string>('');
  const [fields, setFields] = useState<DraftField[]>([]);

  const { data: productsRes } = useProductsByClient(clientId || undefined);
  const products = useMemo(
    () =>
      (productsRes as unknown as { data?: { data?: Array<{ id: number; name: string }> } })?.data
        ?.data ?? [],
    [productsRes]
  );

  const resetAll = () => {
    setStep('pick');
    setClientId('');
    setProductId('');
    setFile(null);
    setTemplateName('');
    setFields([]);
  };

  const closeDialog = () => {
    resetAll();
    onOpenChange(false);
  };

  const parseMutation = useMutation({
    mutationFn: async () => {
      if (!file || !clientId || !productId) {
        throw new Error('Client, product, and file are required');
      }
      return caseDataService.parseUpload(Number(clientId), Number(productId), file);
    },
    onSuccess: (res) => {
      const payload = (res as { data?: { fields?: DraftField[]; sheetName?: string | null } }).data;
      if (!payload?.fields?.length) {
        toast.error('No fields found in file');
        return;
      }
      setFields(payload.fields);
      // Default the template name to "<ClientName> — <ProductName>" as a
      // convenience; admin can override in the preview.
      const cName = clients.find((c) => String(c.id) === clientId)?.name ?? 'Template';
      const pName = products.find((p) => String(p.id) === productId)?.name ?? '';
      setTemplateName(`${cName}${pName ? ` — ${pName}` : ''}`);
      setStep('preview');
    },
    onError: (err: unknown) => {
      const apiErr = err as {
        response?: { data?: { message?: string; error?: { code?: string } } };
      };
      const msg = apiErr.response?.data?.message ?? (err as Error).message ?? 'Failed to parse';
      toast.error(msg);
      logger.error('parseUpload failed', err);
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      return caseDataService.createTemplate({
        clientId: Number(clientId),
        productId: Number(productId),
        name: templateName.trim(),
        fields,
      });
    },
    onSuccess: () => {
      toast.success('Template created');
      queryClient.invalidateQueries({ queryKey: ['case-data-templates'] });
      closeDialog();
    },
    onError: (err: unknown) => {
      const apiErr = err as {
        response?: { data?: { message?: string; error?: { details?: string[] } } };
      };
      const details = apiErr.response?.data?.error?.details;
      if (details?.length) {
        toast.error(details.join('\n'));
      } else {
        toast.error(apiErr.response?.data?.message ?? 'Failed to save template');
      }
      logger.error('createTemplate (from import) failed', err);
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
                accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
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
                Save Template ({fields.length} fields)
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
