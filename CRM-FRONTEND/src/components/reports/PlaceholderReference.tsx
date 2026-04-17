import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Copy } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { caseDataService } from '@/services/caseDataService';
import { cn } from '@/lib/utils';

/**
 * Placeholder reference panel for the PDF report template editor.
 *
 * Lists every Handlebars placeholder the template author can use:
 *   - Static system fields (client.*, product.*, case.*, applicants[].*, tasks[].*, totals.*)
 *   - Dynamic fields from the Data Entry Template configured for the current
 *     (client, product) pair — fetched live
 *   - Available helper functions
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

// Static system fields — kept in sync with ReportContext exposed by the
// backend's reportContextBuilder.ts. Any addition there should be mirrored
// here so admins see it in the reference.
const STATIC_GROUPS: ReferenceGroup[] = [
  {
    id: 'client',
    title: 'Client (branding)',
    items: [
      { placeholder: '{{client.name}}', description: 'Client name' },
      {
        placeholder: '{{client.logoUrl}}',
        description: 'Logo image (base64 data URI; use in <img src>)',
      },
      { placeholder: '{{client.stampUrl}}', description: 'Agency stamp image (data URI)' },
      { placeholder: '{{client.primaryColor}}', description: 'Hex color for accents' },
      { placeholder: '{{client.headerColor}}', description: 'Hex color for header banner' },
    ],
  },
  {
    id: 'product',
    title: 'Product',
    items: [
      { placeholder: '{{product.name}}', description: 'Product name' },
      { placeholder: '{{product.id}}', description: 'Product id' },
    ],
  },
  {
    id: 'case',
    title: 'Case master',
    items: [
      { placeholder: '{{case.caseNumber}}', description: 'Numeric case number (public)' },
      { placeholder: '{{case.customerName}}', description: 'Customer name' },
      { placeholder: '{{case.customerPhone}}', description: 'Customer phone' },
      { placeholder: '{{case.panNumber}}', description: 'PAN number' },
      { placeholder: '{{case.applicantType}}', description: 'APPLICANT / CO_APPLICANT' },
      { placeholder: '{{case.backendContactNumber}}', description: 'Backend contact number' },
      { placeholder: '{{case.trigger}}', description: 'Trigger notes' },
      { placeholder: '{{case.priority}}', description: 'Priority level' },
      { placeholder: '{{case.status}}', description: 'Case status' },
      { placeholder: '{{case.pincode}}', description: 'Pincode' },
      { placeholder: '{{case.receivedDate}}', description: 'created_at — use formatDate' },
      { placeholder: '{{case.completedDate}}', description: 'completed_at — use formatDate' },
    ],
  },
  {
    id: 'applicants',
    title: 'Applicants (iterate)',
    note: 'Use {{#each applicants}}{{name}}{{/each}}',
    items: [
      { placeholder: '{{#each applicants}}...{{/each}}', description: 'Loop over applicants' },
      { placeholder: '{{name}}', description: 'Applicant name (inside each)' },
      { placeholder: '{{mobile}}', description: 'Applicant mobile' },
      { placeholder: '{{role}}', description: 'Role' },
      { placeholder: '{{panNumber}}', description: 'PAN number' },
    ],
  },
  {
    id: 'tasks',
    title: 'Verification tasks (iterate)',
    note: 'Use {{#each tasks}}...{{/each}}',
    items: [
      { placeholder: '{{#each tasks}}...{{/each}}', description: 'Loop over verification tasks' },
      { placeholder: '{{taskNumber}}', description: 'Task number' },
      {
        placeholder: '{{verificationTypeName}}',
        description: 'e.g. Residence / Office / Business',
      },
      { placeholder: '{{applicantType}}', description: 'APPLICANT / CO_APPLICANT per task' },
      { placeholder: '{{status}}', description: 'Task status' },
      { placeholder: '{{verificationOutcome}}', description: 'POSITIVE / NEGATIVE / etc.' },
      { placeholder: '{{address}}', description: 'Visit address' },
      { placeholder: '{{pincode}}', description: 'Task pincode' },
      { placeholder: '{{assignedToName}}', description: 'Verifier name' },
      { placeholder: '{{assignedByName}}', description: 'Assigner name' },
      { placeholder: '{{startedAt}}', description: 'Visit start time' },
      { placeholder: '{{completedAt}}', description: 'Visit completion time' },
      { placeholder: '{{#each attachments}}...{{/each}}', description: 'Loop over task photos' },
    ],
  },
  {
    id: 'attachments',
    title: 'Photos (inside each task)',
    items: [
      { placeholder: '{{url}}', description: 'Photo data URI — use in <img src>' },
      { placeholder: '{{latitude}}', description: 'GPS latitude' },
      { placeholder: '{{longitude}}', description: 'GPS longitude' },
      { placeholder: '{{captureTime}}', description: 'When photo was taken' },
      { placeholder: '{{createdAt}}', description: 'When photo was uploaded' },
      { placeholder: '{{photoType}}', description: 'photo / selfie' },
    ],
  },
  {
    id: 'dataEntriesStatic',
    title: 'Data entries (iterate)',
    note: 'Access dynamic fields via {{data.<fieldKey>}} — see list below',
    items: [
      {
        placeholder: '{{#each dataEntries}}...{{/each}}',
        description: 'Loop over all data entries for this case',
      },
      { placeholder: '{{instanceLabel}}', description: 'e.g. "Primary" / "Co-Applicant 1"' },
      { placeholder: '{{verificationTypeName}}', description: 'Linked verification type (if any)' },
      { placeholder: '{{isCompleted}}', description: 'Whether the entry is completed' },
      {
        placeholder: '{{data.FIELD_KEY}}',
        description: 'A dynamic field value. Field keys below.',
      },
    ],
  },
  {
    id: 'totals',
    title: 'Totals / computed',
    items: [
      { placeholder: '{{totals.totalTasks}}', description: 'Count of all tasks' },
      { placeholder: '{{totals.completedTasks}}', description: 'Count of COMPLETED tasks' },
      {
        placeholder: '{{totals.positiveTasks}}',
        description: 'Count of POSITIVE outcome tasks',
      },
      {
        placeholder: '{{totals.negativeTasks}}',
        description: 'Count of NEGATIVE outcome tasks',
      },
      { placeholder: '{{totals.tatDays}}', description: 'Turn-around in days (null-safe)' },
      { placeholder: '{{totals.photoCount}}', description: 'Total photos on the case' },
    ],
  },
  {
    id: 'generation',
    title: 'Generation',
    items: [
      { placeholder: '{{generation.generatedAt}}', description: 'Timestamp of generation' },
      { placeholder: '{{generation.generatedByName}}', description: 'Name of user generating' },
    ],
  },
  {
    id: 'helpers',
    title: 'Helpers',
    note: 'Use inline inside any placeholder',
    items: [
      {
        placeholder: '{{formatDate value "DD-MM-YYYY"}}',
        description: 'Format a date (supports HH:mm:ss tokens)',
      },
      { placeholder: '{{default value "N/A"}}', description: 'Fallback for null/empty' },
      { placeholder: '{{uppercase value}}', description: 'Uppercase text' },
      { placeholder: '{{count array}}', description: 'Length of an array' },
      {
        placeholder: '{{countWhere tasks "status" "POSITIVE"}}',
        description: 'Count items matching key=value',
      },
      { placeholder: '{{formatNumber 1466999}}', description: 'Indian-grouped number format' },
      {
        placeholder: '{{#eq a b}}match{{else}}no-match{{/eq}}',
        description: 'Conditional equality block',
      },
    ],
  },
];

export function PlaceholderReference({ clientId, productId }: PlaceholderReferenceProps) {
  const [search, setSearch] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Fetch the data entry template for the pair so we can enumerate the
  // dynamic fields the template author can reference via {{data.<key>}}.
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
    () => [...STATIC_GROUPS, ...(dynamicGroup ? [dynamicGroup] : [])],
    [dynamicGroup]
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
      // Clipboard API may be unavailable in some browsers — fall through silently.
    }
  };

  return (
    <div className="rounded-md border bg-muted/30 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-medium">Available placeholders</h4>
        <Input
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-7 w-44 text-xs"
        />
      </div>
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
        {filteredGroups.length === 0 ? (
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
