import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Copy } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { caseDataService } from '@/services/caseDataService';
import { reportTemplatesService } from '@/services/reportTemplates';
import { cn } from '@/lib/utils';

/**
 * Placeholder reference panel for the PDF report template editor.
 *
 * Lists every Handlebars placeholder the template author can use:
 *   - System fields fetched live from `GET /report-templates/context-schema`
 *     (single source of truth — the backend's reportContextSchema module)
 *   - Dynamic fields from the Data Entry Template configured for the current
 *     (client, product) pair
 *   - Helper functions
 *
 * Each row has a click-to-copy button so authors don't have to hand-type
 * long dotted paths. Search box narrows the list as they type.
 */

interface PlaceholderReferenceProps {
  clientId: number | null;
  productId: number | null;
}

interface ReferenceItem {
  placeholder: string;
  description: string;
}

interface ReferenceGroup {
  id: string;
  title: string;
  note?: string;
  items: ReferenceItem[];
}

export function PlaceholderReference({ clientId, productId }: PlaceholderReferenceProps) {
  const [search, setSearch] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // System catalog — single source of truth lives on the backend. Cache
  // aggressively since it's static per-deploy.
  const {
    data: schemaRes,
    isLoading: schemaLoading,
    error: schemaError,
  } = useQuery({
    queryKey: ['report-template-context-schema'],
    queryFn: () => reportTemplatesService.getContextSchema(),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const staticGroups: ReferenceGroup[] = useMemo(() => {
    return schemaRes?.data?.groups ?? [];
  }, [schemaRes]);

  // Dynamic per-(client,product) data-entry template fields.
  const { data: dataEntryTplRes } = useQuery({
    queryKey: ['report-template-ref-de-fields', clientId, productId],
    queryFn: () => {
      if (!clientId || !productId) {
        throw new Error('client and product required');
      }
      return caseDataService.getTemplateForCase(clientId, productId);
    },
    enabled: !!clientId && !!productId,
  });

  const dynamicGroup = useMemo<ReferenceGroup | null>(() => {
    const tpl = dataEntryTplRes?.data;
    if (!tpl || !Array.isArray(tpl.fields) || tpl.fields.length === 0) {
      return null;
    }
    return {
      id: 'dataEntryDynamic',
      title: `Data entry fields (${tpl.name ?? 'template'})`,
      note: 'Inside {{#each dataEntries}} ... {{/each}} use {{data.<key>}}',
      items: tpl.fields
        .filter((f) => f.isActive !== false)
        .map((f) => ({
          placeholder: `{{data.${f.fieldKey}}}`,
          description: `${f.fieldLabel} (${f.fieldType})${f.prefillSource ? ' — prefilled' : ''}`,
        })),
    };
  }, [dataEntryTplRes]);

  const allGroups: ReferenceGroup[] = useMemo(
    () => [...staticGroups, ...(dynamicGroup ? [dynamicGroup] : [])],
    [staticGroups, dynamicGroup]
  );

  const filteredGroups = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) {
      return allGroups;
    }
    return allGroups
      .map((g) => ({
        ...g,
        items: g.items.filter(
          (i) =>
            i.placeholder.toLowerCase().includes(term) || i.description.toLowerCase().includes(term)
        ),
      }))
      .filter((g) => g.items.length > 0);
  }, [allGroups, search]);

  const handleCopy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(value);
      setTimeout(() => {
        setCopiedKey((prev) => (prev === value ? null : prev));
      }, 1200);
    } catch {
      // Clipboard API may be unavailable — fall through silently.
    }
  };

  const totalPlaceholders = useMemo(
    () => allGroups.reduce((sum, g) => sum + g.items.length, 0),
    [allGroups]
  );

  return (
    <div className="rounded-md border bg-muted/30 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-medium">
          Available placeholders
          {totalPlaceholders > 0 ? (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              ({totalPlaceholders})
            </span>
          ) : null}
        </h4>
        <Input
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-7 w-44 text-xs"
        />
      </div>
      {schemaLoading ? (
        <p className="text-xs text-muted-foreground">Loading placeholders…</p>
      ) : schemaError ? (
        <p className="text-xs text-red-600">
          Failed to load placeholder catalog. Refresh the page to retry.
        </p>
      ) : null}
      {!clientId || !productId ? (
        <p className="text-xs text-muted-foreground">
          Select a client and product to see data-entry fields available for this template.
        </p>
      ) : !dynamicGroup ? (
        <p className="text-xs text-amber-600">
          No Data Entry Template is configured for this client + product yet — dynamic fields
          won&apos;t be available until you create one in Settings → Data Entry Templates.
        </p>
      ) : null}
      <div className="max-h-64 overflow-y-auto pr-1 space-y-3">
        {filteredGroups.length === 0 && !schemaLoading ? (
          <p className="text-xs text-muted-foreground">No placeholders match your search.</p>
        ) : (
          filteredGroups.map((group) => (
            <div key={group.id}>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {group.title}
              </div>
              {group.note && (
                <div className="text-[11px] text-muted-foreground italic">{group.note}</div>
              )}
              <ul className="mt-1 space-y-1">
                {group.items.map((item) => (
                  <li
                    key={`${group.id}-${item.placeholder}`}
                    className="flex items-center gap-2 rounded px-1 py-0.5 hover:bg-background"
                  >
                    <code className="flex-1 truncate font-mono text-xs">{item.placeholder}</code>
                    <span className="hidden flex-[2] truncate text-xs text-muted-foreground md:inline">
                      {item.description}
                    </span>
                    <button
                      type="button"
                      className={cn(
                        'inline-flex h-6 w-6 items-center justify-center rounded transition-colors',
                        copiedKey === item.placeholder
                          ? 'text-green-600'
                          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                      )}
                      onClick={() => void handleCopy(item.placeholder)}
                      aria-label={`Copy ${item.placeholder}`}
                      title="Copy to clipboard"
                    >
                      {copiedKey === item.placeholder ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
