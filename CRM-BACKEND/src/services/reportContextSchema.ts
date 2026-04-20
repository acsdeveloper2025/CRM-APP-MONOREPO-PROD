/**
 * Single source of truth for the Handlebars placeholder catalog exposed to
 * report templates. Every row here corresponds to a field on the
 * `ReportContext` built by reportContextBuilder.ts and is what the template
 * editor's "Available placeholders" panel renders.
 *
 * When you add a field to `ReportContext`, add a row here too. The endpoint
 * `GET /api/report-templates/context-schema` serves this directly to the
 * frontend so the panel never drifts from the actual render context again.
 *
 * Dynamic data-entry fields (per client+product `{{data.<fieldKey>}}`) are
 * NOT listed here — the frontend continues to fetch those live from the
 * data entry template service.
 */

export interface PlaceholderItem {
  placeholder: string;
  description: string;
}

export interface PlaceholderGroup {
  id: string;
  title: string;
  note?: string;
  items: PlaceholderItem[];
}

export const REPORT_CONTEXT_SCHEMA: PlaceholderGroup[] = [
  {
    id: 'client',
    title: 'Client (branding)',
    items: [
      { placeholder: '{{client.id}}', description: 'Client id' },
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
      { placeholder: '{{product.id}}', description: 'Product id' },
      { placeholder: '{{product.name}}', description: 'Product name' },
    ],
  },
  {
    id: 'case',
    title: 'Case master',
    items: [
      { placeholder: '{{case.id}}', description: 'Case UUID' },
      { placeholder: '{{case.caseNumber}}', description: 'Numeric case number (public)' },
      { placeholder: '{{case.customerName}}', description: 'Customer name' },
      { placeholder: '{{case.customerPhone}}', description: 'Customer phone' },
      { placeholder: '{{case.customerCallingCode}}', description: 'Dialing prefix (e.g. +91)' },
      { placeholder: '{{case.panNumber}}', description: 'PAN number' },
      { placeholder: '{{case.applicantType}}', description: 'APPLICANT / CO_APPLICANT' },
      { placeholder: '{{case.backendContactNumber}}', description: 'Backend contact number' },
      { placeholder: '{{case.trigger}}', description: 'Trigger notes' },
      { placeholder: '{{case.priority}}', description: 'Priority level' },
      { placeholder: '{{case.status}}', description: 'Case status' },
      { placeholder: '{{case.pincode}}', description: 'Pincode' },
      {
        placeholder: '{{case.verificationOutcome}}',
        description: 'Rolled-up case outcome',
      },
      { placeholder: '{{case.receivedDate}}', description: 'created_at — use formatDate' },
      { placeholder: '{{case.completedDate}}', description: 'completed_at — use formatDate' },
      {
        placeholder: '{{case.formCompletionPercentage}}',
        description: 'Percent of data entries filled',
      },
      { placeholder: '{{case.totalTasksCount}}', description: 'Tasks on this case' },
      { placeholder: '{{case.completedTasksCount}}', description: 'Completed tasks on this case' },
    ],
  },
  {
    id: 'applicants',
    title: 'Applicants (iterate)',
    note: 'Use {{#each applicants}}{{name}}{{/each}}',
    items: [
      { placeholder: '{{#each applicants}}...{{/each}}', description: 'Loop over applicants' },
      { placeholder: '{{id}}', description: 'Applicant id (inside each)' },
      { placeholder: '{{name}}', description: 'Applicant name' },
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
      { placeholder: '{{id}}', description: 'Task UUID (inside each)' },
      { placeholder: '{{taskNumber}}', description: 'Task number' },
      { placeholder: '{{taskTitle}}', description: 'Task title' },
      { placeholder: '{{taskDescription}}', description: 'Task description' },
      {
        placeholder: '{{verificationTypeName}}',
        description: 'e.g. Residence / Office / Business',
      },
      { placeholder: '{{applicantType}}', description: 'APPLICANT / CO_APPLICANT per task' },
      { placeholder: '{{status}}', description: 'Task status' },
      { placeholder: '{{verificationOutcome}}', description: 'POSITIVE / NEGATIVE / etc.' },
      { placeholder: '{{priority}}', description: 'Per-task priority' },
      { placeholder: '{{estimatedAmount}}', description: 'Estimated amount (with formatNumber)' },
      { placeholder: '{{actualAmount}}', description: 'Actual amount post-verification' },
      { placeholder: '{{address}}', description: 'Visit address' },
      { placeholder: '{{pincode}}', description: 'Task pincode' },
      { placeholder: '{{assignedToName}}', description: 'Verifier name' },
      { placeholder: '{{assignedByName}}', description: 'Assigner name' },
      { placeholder: '{{assignedAt}}', description: 'Assignment time (use formatDate)' },
      { placeholder: '{{startedAt}}', description: 'Visit start time' },
      { placeholder: '{{completedAt}}', description: 'Visit completion time' },
      { placeholder: '{{reviewedAt}}', description: 'Reviewer completion time' },
      { placeholder: '{{#each attachments}}...{{/each}}', description: 'Loop over task photos' },
    ],
  },
  {
    id: 'attachments',
    title: 'Photos (inside each task)',
    items: [
      { placeholder: '{{url}}', description: 'Photo data URI — use in <img src>' },
      { placeholder: '{{photoType}}', description: 'photo / selfie / document / etc.' },
      { placeholder: '{{latitude}}', description: 'GPS latitude' },
      { placeholder: '{{longitude}}', description: 'GPS longitude' },
      { placeholder: '{{captureTime}}', description: 'When photo was taken' },
      { placeholder: '{{createdAt}}', description: 'When photo was uploaded' },
      { placeholder: '{{filename}}', description: 'Stored filename' },
      { placeholder: '{{originalName}}', description: 'Original uploaded name' },
      { placeholder: '{{mimeType}}', description: 'Mime type' },
      { placeholder: '{{fileSize}}', description: 'Bytes' },
    ],
  },
  {
    id: 'dataEntriesStatic',
    title: 'Data entries (iterate)',
    note: 'Dynamic fields appear below as {{data.<fieldKey>}} once a client+product is picked',
    items: [
      {
        placeholder: '{{#each dataEntries}}...{{/each}}',
        description: 'Loop over all data entries for this case',
      },
      { placeholder: '{{instanceIndex}}', description: 'Numeric index of the instance' },
      { placeholder: '{{instanceLabel}}', description: 'e.g. "Primary" / "Co-Applicant 1"' },
      { placeholder: '{{verificationTypeName}}', description: 'Linked verification type (if any)' },
      { placeholder: '{{isCompleted}}', description: 'Whether the entry is completed' },
      { placeholder: '{{completedAt}}', description: 'When this entry was finalized' },
      {
        placeholder: '{{data.FIELD_KEY}}',
        description: 'A dynamic field value — field keys listed below',
      },
    ],
  },
  {
    id: 'totals',
    title: 'Totals / computed',
    items: [
      { placeholder: '{{totals.totalTasks}}', description: 'Count of all tasks' },
      { placeholder: '{{totals.completedTasks}}', description: 'Count of COMPLETED tasks' },
      { placeholder: '{{totals.positiveTasks}}', description: 'Count of POSITIVE outcome tasks' },
      { placeholder: '{{totals.negativeTasks}}', description: 'Count of NEGATIVE outcome tasks' },
      { placeholder: '{{totals.tatDays}}', description: 'Turn-around in days (null-safe)' },
      { placeholder: '{{totals.photoCount}}', description: 'Total photos on the case' },
    ],
  },
  {
    id: 'generation',
    title: 'Generation',
    items: [
      { placeholder: '{{generation.generatedAt}}', description: 'Timestamp of generation' },
      { placeholder: '{{generation.generatedById}}', description: 'User UUID who generated' },
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
