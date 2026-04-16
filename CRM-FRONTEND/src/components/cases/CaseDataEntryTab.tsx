import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Save, CheckCircle, AlertCircle, FileText, Loader2, Plus, Trash2 } from 'lucide-react';
import {
  useCaseDataBundle,
  useCreateInstance,
  useSaveInstance,
  useDeleteInstance,
  useCompleteCaseDataEntry,
} from '@/hooks/useCaseData';
import type { CaseDataEntry, CaseDataTemplateField } from '@/services/caseDataService';
import { getPrefillEntry } from '@/constants/templateFieldPrefillCatalog';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';

interface CaseDataEntryTabProps {
  caseId: string;
  clientId?: number;
  productId?: number;
  readonly?: boolean;
}

// ---- Shared error extraction ------------------------------------------------

interface ApiErrorShape {
  response?: {
    status?: number;
    data?: {
      message?: string;
      error?: { code?: string; details?: string[]; activeVersion?: number; yourVersion?: number };
    };
  };
}

const extractApiError = (err: unknown): ApiErrorShape['response']['data'] & { status?: number } => {
  const e = err as ApiErrorShape;
  return {
    status: e.response?.status,
    ...(e.response?.data || {}),
  };
};

/**
 * Apply template-defined default values to a freshly created (empty)
 * instance. Type-safe coercion: NUMBER defaults that don't parse are
 * dropped rather than written as NaN, BOOLEAN defaults honour string
 * "true"/"false", MULTISELECT defaults are split on commas.
 */
const buildDefaultsForFields = (fields: CaseDataTemplateField[]): Record<string, unknown> => {
  const defaults: Record<string, unknown> = {};
  for (const field of fields) {
    if (field.defaultValue == null || field.defaultValue === '') {
      continue;
    }
    switch (field.fieldType) {
      case 'NUMBER': {
        const n = Number(field.defaultValue);
        if (Number.isFinite(n)) {
          defaults[field.fieldKey] = n;
        }
        break;
      }
      case 'BOOLEAN':
        defaults[field.fieldKey] = field.defaultValue === 'true';
        break;
      case 'MULTISELECT':
        defaults[field.fieldKey] = field.defaultValue
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        break;
      default:
        defaults[field.fieldKey] = field.defaultValue;
    }
  }
  return defaults;
};

// ---- Main component ---------------------------------------------------------

export function CaseDataEntryTab({ caseId, readonly = false }: CaseDataEntryTabProps) {
  const { data: bundle, isLoading, refetch } = useCaseDataBundle(caseId);
  const createInstance = useCreateInstance(caseId);
  const saveInstance = useSaveInstance(caseId);
  const deleteInstance = useDeleteInstance(caseId);
  const completeMutation = useCompleteCaseDataEntry(caseId);

  // Per-instance local form state, keyed by instance_index.
  const [formByIndex, setFormByIndex] = useState<Record<number, Record<string, unknown>>>({});
  const [dirtyIndexes, setDirtyIndexes] = useState<Set<number>>(new Set());
  const [activeTab, setActiveTab] = useState<string>('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [confirmCompleteOpen, setConfirmCompleteOpen] = useState(false);
  const [confirmDeleteIdx, setConfirmDeleteIdx] = useState<number | null>(null);

  const template = bundle?.template;
  // Memoised so the empty-array fallback doesn't create a new reference
  // on every render and retrigger dependent useEffect / useBlocker hooks.
  const entries = useMemo(() => bundle?.entries ?? [], [bundle?.entries]);
  // Data entry readonly is driven by whether ALL instances are
  // individually completed, NOT by the case's status. The case may
  // be COMPLETED (all tasks done) while data entry is still pending
  // — that's intentional so the backend user can fill and submit
  // after field agents have finished.
  const allInstancesCompleted =
    entries.length > 0 && entries.every((e) => e.isCompleted);
  const effectiveReadonly = readonly || allInstancesCompleted;
  const isDirty = dirtyIndexes.size > 0;

  // Initialise local form state from server entries. Runs only for entries
  // the user hasn't started editing yet — we never clobber dirty state.
  // For freshly-created instances whose server data is still empty, seed
  // the form with template defaults (type-safe — no NaN leaks).
  useEffect(() => {
    if (!entries.length) {
      return;
    }
    const defaults = template?.fields ? buildDefaultsForFields(template.fields) : {};
    setFormByIndex((prev) => {
      const next = { ...prev };
      for (const entry of entries) {
        if (dirtyIndexes.has(entry.instanceIndex)) {
          continue;
        }
        const serverData = (entry.data || {}) as Record<string, unknown>;
        next[entry.instanceIndex] =
          Object.keys(serverData).length === 0 ? { ...defaults } : serverData;
      }
      return next;
    });
    // Ensure activeTab points to a real instance.
    setActiveTab((prev) => {
      const ids = entries.map((e) => String(e.instanceIndex));
      if (ids.includes(prev)) {
        return prev;
      }
      return ids[0] || '';
    });
  }, [entries, dirtyIndexes, template]);

  // NOTE: In-app route-change guard via react-router's useBlocker requires
  // a data router (createBrowserRouter). This app uses BrowserRouter, so
  // useBlocker throws at runtime. We rely on the beforeunload listener
  // below for hard navigation / tab close, and on the orange-dot dirty
  // indicator on each instance tab for intra-page awareness. The user can
  // still lose unsaved work by clicking a different route in the sidebar;
  // restoring that guard requires migrating the app to createBrowserRouter.

  // Guard hard navigation / tab close.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const handleFieldChange = (index: number, fieldKey: string, value: unknown) => {
    setFormByIndex((prev) => ({
      ...prev,
      [index]: { ...(prev[index] || {}), [fieldKey]: value },
    }));
    setDirtyIndexes((prev) => new Set(prev).add(index));
  };

  const handleCreateInstance = async () => {
    // No label prompt — the backend auto-assigns "Primary" for the first
    // instance and "Instance N" for subsequent ones. If a client ever
    // needs custom labels, we can surface them via an inline rename on
    // each tab rather than a modal at creation time.
    try {
      const created = await createInstance.mutateAsync(undefined);
      setActiveTab(String(created.instanceIndex));
    } catch (err) {
      const apiErr = extractApiError(err);
      toast.error(apiErr.message || 'Failed to create instance');
    }
  };

  const handleDeleteInstance = async (idx: number) => {
    try {
      await deleteInstance.mutateAsync(idx);
      setDirtyIndexes((prev) => {
        const next = new Set(prev);
        next.delete(idx);
        return next;
      });
      setFormByIndex((prev) => {
        const next = { ...prev };
        delete next[idx];
        return next;
      });
      toast.success('Instance removed');
    } catch (err) {
      const apiErr = extractApiError(err);
      toast.error(apiErr.message || 'Failed to delete instance');
    } finally {
      setConfirmDeleteIdx(null);
    }
  };

  const handleSaveDraft = async (index: number) => {
    if (!template) {
      return;
    }
    const data = formByIndex[index] || {};
    // Strip mapped fields before sending. The backend will do the same
    // on receipt (defence in depth), but clearing them client-side
    // keeps the request smaller and avoids round-tripping data the
    // server won't store anyway.
    const mappedKeys = new Set(
      (template.fields ?? []).filter(f => f.prefillSource).map(f => f.fieldKey)
    );
    const cleanData = Object.fromEntries(
      Object.entries(data).filter(([k]) => !mappedKeys.has(k))
    );
    try {
      await saveInstance.mutateAsync({
        instanceIndex: index,
        data: cleanData,
        templateVersion: template.version,
      });
      setDirtyIndexes((prev) => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
      setValidationErrors([]);
      toast.success('Draft saved');
    } catch (err) {
      const apiErr = extractApiError(err);
      if (apiErr.error?.code === 'TEMPLATE_VERSION_CHANGED') {
        toast.error(`Template was updated (v${apiErr.error.activeVersion}). Reloading the form…`);
        await refetch();
        setDirtyIndexes(new Set());
        return;
      }
      if (apiErr.error?.details?.length) {
        setValidationErrors(apiErr.error.details);
        toast.error('Please fix the validation errors');
      } else {
        toast.error(apiErr.message || 'Failed to save');
      }
      logger.error('Save draft failed', err);
    }
  };

  const handleCompleteConfirmed = async () => {
    setConfirmCompleteOpen(false);
    if (!template) {
      return;
    }
    const mappedKeys = new Set(
      (template.fields ?? []).filter(f => f.prefillSource).map(f => f.fieldKey)
    );
    try {
      // Save any dirty drafts first so the server validates the latest state.
      for (const idx of Array.from(dirtyIndexes)) {
        const raw = formByIndex[idx] || {};
        const cleanData = Object.fromEntries(
          Object.entries(raw).filter(([k]) => !mappedKeys.has(k))
        );
        await saveInstance.mutateAsync({
          instanceIndex: idx,
          data: cleanData,
          templateVersion: template.version,
        });
      }
      setDirtyIndexes(new Set());

      await completeMutation.mutateAsync();
      setValidationErrors([]);
      toast.success('Case completed');
    } catch (err) {
      const apiErr = extractApiError(err);
      if (apiErr.error?.code === 'TEMPLATE_VERSION_CHANGED') {
        toast.error(`Template was updated (v${apiErr.error.activeVersion}). Reloading the form…`);
        await refetch();
        return;
      }
      if (apiErr.error?.details?.length) {
        setValidationErrors(apiErr.error.details);
        toast.error('Fix the validation errors before completing');
      } else {
        toast.error(apiErr.message || 'Failed to complete');
      }
      logger.error('Complete failed', err);
    }
  };

  // ------------------ render ------------------

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-green-600 mr-2" />
          <span>Loading data entry…</span>
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold">{template.name}</h3>
          <Badge variant="outline" className="text-xs">
            v{template.version}
          </Badge>
          {allInstancesCompleted ? (
            <Badge className="bg-green-100 text-green-800">
              <CheckCircle className="h-3 w-3 mr-1" />
              Data Entry Completed
            </Badge>
          ) : entries.length > 0 ? (
            <Badge className="bg-yellow-100 text-yellow-800">In Progress</Badge>
          ) : (
            <Badge className="bg-gray-100 text-gray-600">Not Started</Badge>
          )}
        </div>
        {!effectiveReadonly && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCreateInstance}
              disabled={createInstance.isPending}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Instance
            </Button>
            <Button
              size="sm"
              onClick={() => setConfirmCompleteOpen(true)}
              disabled={
                entries.length === 0 || saveInstance.isPending || completeMutation.isPending
              }
            >
              {completeMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-1" />
              )}
              Mark Complete
            </Button>
          </div>
        )}
      </div>

      {/* Aggregate validation errors */}
      {validationErrors.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-red-800 mb-1">Please fix:</p>
                <ul className="list-disc pl-4 text-red-700 space-y-0.5">
                  {validationErrors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {entries.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <FileText className="h-10 w-10 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 mb-3">No data entered yet.</p>
            {!effectiveReadonly && (
              <Button onClick={handleCreateInstance} disabled={createInstance.isPending}>
                <Plus className="h-4 w-4 mr-1" />
                Start Data Entry
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Instance tabs */}
      {entries.length > 0 && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex-wrap h-auto">
            {entries.map((entry) => (
              <TabsTrigger key={entry.instanceIndex} value={String(entry.instanceIndex)}>
                {entry.instanceLabel}
                {dirtyIndexes.has(entry.instanceIndex) && (
                  <span className="ml-1 text-orange-500">●</span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {entries.map((entry) => (
            <TabsContent key={entry.instanceIndex} value={String(entry.instanceIndex)}>
              <InstanceForm
                entry={entry}
                fields={template.fields}
                formData={formByIndex[entry.instanceIndex] || {}}
                onFieldChange={(k, v) => handleFieldChange(entry.instanceIndex, k, v)}
                onSave={() => handleSaveDraft(entry.instanceIndex)}
                onRequestDelete={() => setConfirmDeleteIdx(entry.instanceIndex)}
                isSaving={saveInstance.isPending}
                isDirty={dirtyIndexes.has(entry.instanceIndex)}
                readonly={effectiveReadonly}
              />
            </TabsContent>
          ))}
        </Tabs>
      )}

      {/* Confirm complete */}
      <AlertDialog open={confirmCompleteOpen} onOpenChange={setConfirmCompleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark case as complete?</AlertDialogTitle>
            <AlertDialogDescription>
              This will validate every instance ({entries.length}) and, if all required fields pass,
              lock the case as <strong>COMPLETED</strong>. This cannot be undone from this screen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleCompleteConfirmed}>Complete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm delete instance */}
      <AlertDialog
        open={confirmDeleteIdx !== null}
        onOpenChange={(open) => !open && setConfirmDeleteIdx(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this instance?</AlertDialogTitle>
            <AlertDialogDescription>
              All data entered for this instance will be removed. Audit history is preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDeleteIdx !== null && handleDeleteInstance(confirmDeleteIdx)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---- Per-instance form ------------------------------------------------------

function InstanceForm({
  entry,
  fields,
  formData,
  onFieldChange,
  onSave,
  onRequestDelete,
  isSaving,
  isDirty,
  readonly,
}: {
  entry: CaseDataEntry;
  fields: CaseDataTemplateField[];
  formData: Record<string, unknown>;
  onFieldChange: (fieldKey: string, value: unknown) => void;
  onSave: () => void;
  onRequestDelete: () => void;
  isSaving: boolean;
  isDirty: boolean;
  readonly: boolean;
}) {
  const sections = useMemo(() => {
    const map = new Map<string, CaseDataTemplateField[]>();
    for (const field of fields) {
      if (!field.isActive) {
        continue;
      }
      const section = field.section || 'General';
      if (!map.has(section)) {
        map.set(section, []);
      }
      map.get(section)?.push(field);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.displayOrder - b.displayOrder);
    }
    return map;
  }, [fields]);

  return (
    <div className="space-y-4 mt-3">
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">
          {entry.isCompleted ? (
            <Badge className="bg-green-100 text-green-800">
              <CheckCircle className="h-3 w-3 mr-1" />
              This instance is completed
            </Badge>
          ) : (
            <span>Editing: {entry.instanceLabel}</span>
          )}
        </div>
        {!readonly && (
          <div className="flex gap-2">
            {!entry.isCompleted && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRequestDelete}
                className="text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Remove
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={onSave} disabled={!isDirty || isSaving}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              Save Draft
            </Button>
          </div>
        )}
      </div>

      {Array.from(sections.entries()).map(([sectionName, list]) => (
        <Card key={sectionName}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{sectionName}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {list.map((field) => (
                <DynamicField
                  key={field.fieldKey}
                  field={field}
                  value={formData[field.fieldKey]}
                  onChange={(v) => onFieldChange(field.fieldKey, v)}
                  readonly={readonly || entry.isCompleted}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---- Field renderer (unchanged from Sprint 0) ------------------------------

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

  const handleToggle = useCallback(
    (opt: string, selected: boolean) => {
      const current = Array.isArray(value) ? [...(value as string[])] : [];
      onChange(selected ? current.filter((v) => v !== opt) : [...current, opt]);
    },
    [value, onChange]
  );

  // Sprint 5: read-only mirror of a system field. The value comes from
  // `field.prefillValue` which the backend resolves live on every bundle
  // render. Rendering is always a disabled <Input> regardless of the
  // configured fieldType — mapped fields can't be edited, so fancy
  // SELECT/MULTISELECT/BOOLEAN controls would only confuse the user.
  if (field.prefillSource) {
    const entry = getPrefillEntry(field.prefillSource);
    const displayValue =
      field.prefillValue === null || field.prefillValue === undefined
        ? ''
        : typeof field.prefillValue === 'object'
          ? JSON.stringify(field.prefillValue)
          : String(field.prefillValue);
    return (
      <div className="md:col-span-2">
        <Label htmlFor={fieldId} className="mb-1.5 block">
          {field.fieldLabel}
          {field.isRequired && <span className="text-red-500 ml-1">*</span>}
          <span className="ml-2 text-xs font-normal text-gray-500">
            (from {entry?.label ?? field.prefillSource})
          </span>
        </Label>
        <Input
          id={fieldId}
          value={displayValue}
          disabled
          placeholder={
            displayValue
              ? ''
              : `Not set on this case — fix via Edit Case to populate ${entry?.label ?? 'source'}`
          }
        />
      </div>
    );
  }

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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
          {(field.options || []).map((opt) => {
            const selected = Array.isArray(value) && (value as string[]).includes(opt.value);
            const optionId = `${fieldId}-${opt.value}`;
            return (
              <label
                key={opt.value}
                htmlFor={optionId}
                className={`flex items-center gap-2 text-sm ${
                  readonly ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'
                }`}
              >
                <Checkbox
                  id={optionId}
                  checked={selected}
                  onCheckedChange={() => handleToggle(opt.value, selected)}
                  disabled={readonly}
                />
                <span>{opt.label}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
