/**
 * Starter HTML/Handlebars report template shipped with the PDF Report
 * Template editor's "Insert Sample" action. Loosely based on the Shubham
 * RCU report layout: top banner, summary table, document matrix, overall
 * remarks from data-entry instances, and a photo grid grouped by task.
 *
 * Admins are expected to copy-edit this to match their own client's exact
 * field labels. The point of shipping a sample is to make the "blank
 * editor" problem less daunting, not to prescribe a layout.
 */
export const SAMPLE_REPORT_TEMPLATE_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  body { font-family: Arial, sans-serif; margin: 0; padding: 16px; color: #111; font-size: 11px; }
  .header-bar {
    background: {{default client.headerColor "#FFEB3B"}};
    padding: 8px 12px; font-weight: 700; font-size: 13px;
    display: flex; justify-content: space-between; align-items: center;
  }
  .header-bar img { max-height: 34px; }
  h1, h2, h3 { margin: 12px 0 6px; }
  table { border-collapse: collapse; width: 100%; margin-top: 8px; }
  th {
    background: {{default client.primaryColor "#FF9800"}};
    color: #fff; text-align: left; padding: 6px 8px; font-weight: 600;
  }
  td { border: 1px solid #ccc; padding: 6px 8px; vertical-align: top; }
  .label-cell {
    background: {{default client.primaryColor "#FF9800"}};
    color: #fff; font-weight: 600; width: 180px;
  }
  .remarks { white-space: pre-wrap; margin: 6px 0 12px; }
  .section-title {
    background: {{default client.primaryColor "#FF9800"}};
    color: #fff; padding: 6px 10px; font-weight: 700; margin-top: 14px;
  }
  .photo-grid {
    display: grid; grid-template-columns: repeat(2, 1fr);
    gap: 10px; margin-top: 8px;
  }
  .photo-cell { border: 1px solid #ddd; padding: 6px; }
  .photo-cell img { width: 100%; max-height: 260px; object-fit: cover; display: block; }
  .geo-tag { font-size: 10px; color: #1a73e8; margin-top: 4px; }
  .stamp { margin-top: 18px; }
  .stamp img { max-height: 80px; }
  .footer-note { margin-top: 18px; font-size: 10px; color: #666; }
</style>
</head>
<body>

  <div class="header-bar">
    <div>
      {{#if client.logoUrl}}<img src="{{client.logoUrl}}" alt="{{client.name}}" />{{/if}}
    </div>
    <div>RCU REPORT — Generation Date: {{formatDate generation.generatedAt "DD-MM-YYYY"}}</div>
  </div>

  <table>
    <tr>
      <td class="label-cell">RCU AGENCY NAME</td>
      <td>{{uppercase client.name}}</td>
    </tr>
    <tr>
      <td class="label-cell">APPLICATION NO.</td>
      <td>{{default case.caseNumber "-"}}</td>
    </tr>
    <tr>
      <td class="label-cell">CUSTOMER NAME</td>
      <td>{{uppercase (default case.customerName "-")}}</td>
    </tr>
    <tr>
      <td class="label-cell">PRODUCT</td>
      <td>{{uppercase product.name}}</td>
    </tr>
    <tr>
      <td class="label-cell">PICKUP DATE</td>
      <td>{{formatDate case.receivedDate "DD-MM-YYYY"}}</td>
    </tr>
    <tr>
      <td class="label-cell">REPORTED DATE</td>
      <td>{{formatDate case.completedDate "DD-MM-YYYY"}}</td>
    </tr>
    <tr>
      <td class="label-cell">TAT</td>
      <td>{{default totals.tatDays "-"}}</td>
    </tr>
  </table>

  <table>
    <thead>
      <tr>
        <th>APPLICANT TYPE</th>
        <th>DOCUMENT</th>
        <th>STATUS</th>
        <th>OUTCOME</th>
      </tr>
    </thead>
    <tbody>
      {{#each tasks}}
      <tr>
        <td>{{default applicantType "-"}}</td>
        <td>{{default verificationTypeName "-"}}</td>
        <td>{{default status "-"}}</td>
        <td>{{default verificationOutcome "-"}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>

  <table style="margin-top: 8px;">
    <tr>
      <td class="label-cell">TOTAL TASKS</td>
      <td>{{totals.totalTasks}}</td>
      <td class="label-cell">COMPLETED</td>
      <td>{{totals.completedTasks}}</td>
    </tr>
    <tr>
      <td class="label-cell">POSITIVE</td>
      <td>{{totals.positiveTasks}}</td>
      <td class="label-cell">NEGATIVE</td>
      <td>{{totals.negativeTasks}}</td>
    </tr>
  </table>

  <div class="section-title">OVERALL REMARKS</div>
  {{#each dataEntries}}
    <div class="remarks">
      <strong>{{@index}}) {{default verificationTypeName instanceLabel}}:</strong>
      {{default data.overall_remarks data.remarks}}
    </div>
  {{/each}}

  {{#each tasks}}
    {{#if attachments.length}}
      <div class="section-title">PHOTOS — {{default verificationTypeName "Site"}}</div>
      <div class="photo-grid">
        {{#each attachments}}
          <div class="photo-cell">
            {{#if url}}
              <img src="{{url}}" alt="photo" />
            {{else}}
              <div style="height:200px; background:#eee; display:flex; align-items:center; justify-content:center;">
                [missing file]
              </div>
            {{/if}}
            <div class="geo-tag">
              GEO TAG: {{formatDate createdAt "MMM DD YYYY HH:mm:ss"}}
              / {{default latitude "-"}}, {{default longitude "-"}}
            </div>
          </div>
        {{/each}}
      </div>
    {{/if}}
  {{/each}}

  <div class="stamp">
    {{#if client.stampUrl}}<img src="{{client.stampUrl}}" alt="{{client.name}} stamp" />{{/if}}
    <div class="footer-note">
      Verified by: {{default (lookup tasks.0 'assignedToName') "-"}}
      &nbsp;·&nbsp; Generated by: {{default generation.generatedByName "-"}}
      &nbsp;·&nbsp; {{formatDate generation.generatedAt "DD-MM-YYYY HH:mm"}}
    </div>
  </div>
</body>
</html>
`;
