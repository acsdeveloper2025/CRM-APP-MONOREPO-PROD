/**
 * DEMO (no DB writes, no HTTP) — renders three Property APF reports to show
 * how `constructionActivity` can deterministically drive POSITIVE vs NEGATIVE
 * report generation.
 *
 * The proposed rule (Option A):
 *   constructionActivity === 'SEEN'                 → form_type = POSITIVE  → POSITIVE template
 *   constructionActivity === 'CONSTRUCTION IS STOP' → form_type = <agent>   → agent's finalStatus wins
 *   constructionActivity === 'PLOT IS VACANT'       → form_type = NEGATIVE  → NEGATIVE template (override)
 *
 * Run:  npx ts-node --transpile-only scripts/demo-apf-construction-activity-rule.ts
 */

import { templateReportService } from '../src/services/TemplateReportService';

// Simulates the proposed backend override applied inside submitPropertyApfVerification.
function applyConstructionActivityRule(
  formData: Record<string, unknown>,
): { formType: 'POSITIVE' | 'NEGATIVE'; outcome: string; overridden: boolean } {
  const activity = String(formData.constructionActivity || '').toUpperCase();
  const agentChoice = String(formData.finalStatus || 'Positive');

  if (activity === 'PLOT IS VACANT') {
    // Hard override — plot vacancy is an objective fact. Ignore agent's pick.
    return { formType: 'NEGATIVE', outcome: 'Negative', overridden: agentChoice !== 'Negative' };
  }
  if (activity === 'SEEN') {
    // Default to POSITIVE unless agent explicitly picked Negative/Refer/Fraud.
    const t = agentChoice === 'Negative' ? 'NEGATIVE' : 'POSITIVE';
    return { formType: t as 'POSITIVE' | 'NEGATIVE', outcome: agentChoice, overridden: false };
  }
  // CONSTRUCTION IS STOP → pure agent judgment
  const t = agentChoice === 'Negative' ? 'NEGATIVE' : 'POSITIVE';
  return { formType: t as 'POSITIVE' | 'NEGATIVE', outcome: agentChoice, overridden: false };
}

function baseFormData(extra: Record<string, unknown>): Record<string, unknown> {
  return {
    addressLocatable: 'Easy to Locate',
    addressRating: 'Good',
    locality: 'Commercial',
    landmark1: 'Near Metro',
    landmark2: 'Opposite Mall',
    politicalConnection: 'Not Having Political Connection',
    dominatedArea: 'Not A Community Dominated',
    feedbackFromNeighbour: 'Positive',
    otherObservation: 'Demo observation',
    companyNameBoard: 'SIGHTED AS',
    nameOnBoard: 'XYZ Projects Pvt Ltd',
    tpcMetPerson1: 'Neighbour',
    nameOfTpc1: 'Mr. Desai',
    tpcConfirmation1: 'Confirmed',
    tpcMetPerson2: 'Security',
    nameOfTpc2: 'Rakesh',
    tpcConfirmation2: 'Confirmed',
    projectName: 'Sunshine Heights',
    projectStartedDate: '2023-06-01',
    projectCompletionDate: '2026-12-31',
    totalWing: 3,
    totalFlats: 120,
    projectCompletionPercent: 70,
    staffStrength: 40,
    staffSeen: 35,
    buildingStatus: 'Under Construction',
    ...extra,
  };
}

function divider(title: string) {
  console.log('\n' + '═'.repeat(72));
  console.log('  ' + title);
  console.log('═'.repeat(72));
}

async function renderAndPrint(label: string, formData: Record<string, unknown>) {
  const rule = applyConstructionActivityRule(formData);

  divider(`SCENARIO: ${label}`);
  console.log(`  Input constructionActivity : ${formData.constructionActivity}`);
  console.log(`  Input finalStatus (agent)  : ${formData.finalStatus}`);
  console.log(`  Rule output form_type      : ${rule.formType}`);
  console.log(`  Rule overrode agent pick?  : ${rule.overridden ? 'YES (agent said Positive, rule said Negative)' : 'no'}`);
  console.log(`  Outcome string passed to picker: ${rule.outcome}`);

  const rendered = templateReportService.generateTemplateReport({
    verificationType: 'PROPERTY_APF',
    outcome: rule.outcome,
    formData: { ...formData, finalStatus: rule.outcome },
    caseDetails: {
      caseId: 'demo',
      customerName: 'DemoCustomer',
      applicantType: 'APPLICANT',
      address: 'Demo Address',
    },
  });

  console.log('\n--- RENDERED REPORT ---');
  console.log(rendered.success ? rendered.report : `ERROR: ${rendered.error}`);
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║  DEMO — Property APF: constructionActivity drives POSITIVE vs NEGATIVE║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');

  // Case 1 — SEEN + agent picks Positive → POSITIVE report (agent + rule agree)
  await renderAndPrint(
    'SEEN + agent=Positive',
    baseFormData({
      constructionActivity: 'SEEN',
      metPerson: 'Mr. Shah',
      designation: 'Manager',
      finalStatus: 'Positive',
    }),
  );

  // Case 2 — CONSTRUCTION IS STOP + agent picks Negative → NEGATIVE report (agent judgment)
  await renderAndPrint(
    'CONSTRUCTION IS STOP + agent=Negative',
    baseFormData({
      constructionActivity: 'CONSTRUCTION IS STOP',
      activityStopReason: 'Stalled for 18 months — funding issues',
      finalStatus: 'Negative',
    }),
  );

  // Case 3 — PLOT IS VACANT + agent tried to pick Positive → rule OVERRIDES to NEGATIVE
  await renderAndPrint(
    'PLOT IS VACANT + agent=Positive (RULE OVERRIDES)',
    baseFormData({
      constructionActivity: 'PLOT IS VACANT',
      finalStatus: 'Positive', // agent's wrong pick — rule must win
    }),
  );

  divider('SUMMARY');
  console.log(`
  Rule behavior proven:
   • SEEN + Positive     → POSITIVE report
   • STOP + Negative     → NEGATIVE report
   • VACANT + Positive   → NEGATIVE report (agent's choice overridden)

  The template picker is unchanged. The ONLY new logic is the 3-line
  applyConstructionActivityRule() that sits between the controller's
  form-type detector and the validator/INSERT step.
  `);
}

main();
