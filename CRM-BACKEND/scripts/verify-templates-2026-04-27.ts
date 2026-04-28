/**
 * Template-render verification for 2026-04-27 audit campaign.
 * Calls templateReportService.generateReport() directly with mock formData
 * for each verification type × outcome we touched. Looks for unresolved
 * `{Placeholder}` literals in the output (= drift).
 */

import { config } from 'dotenv';
config();

import { templateReportService } from '../src/services/TemplateReportService';

interface Probe {
  label: string;
  verificationType: string;
  outcome: string;
  formData: Record<string, unknown>;
}

const baseCase = {
  customerName: 'JOHN DOE',
  customerPhone: '+919999999999',
  applicantType: 'APPLICANT',
};

const probes: Probe[] = [
  {
    label: 'Property APF — POSITIVE (SEEN)',
    verificationType: 'PROPERTY_APF',
    outcome: 'Positive',
    formData: {
      ...baseCase,
      addressLocatable: 'Easy to Locate',
      addressRating: 'Good',
      constructionActivity: 'SEEN',
      metPersonName: 'Mr. Sharma',
      metPersonDesignation: 'Manager',
      tpcMetPerson1: 'Neighbour',
      tpcName1: 'Mr. Patel',
      tpcConfirmation1: 'Confirmed',
      tpcMetPerson2: 'Security',
      tpcName2: 'Mr. Kumar',
      tpcConfirmation2: 'Confirmed',
      locality: 'Commercial Tower',
      companyNamePlateStatus: 'Sighted As',
      nameOnBoard: 'ACS Tower',
      landmark1: 'Near Metro',
      landmark2: 'Near Mall',
      politicalConnection: 'Not Having Any Political Connection',
      dominatedArea: 'Not A Community Dominated',
      feedbackFromNeighbour: 'No Adverse',
      otherObservation: 'Project active',
      finalStatus: 'Positive',
    },
  },
  {
    label: 'Property APF — NEGATIVE_STOP',
    verificationType: 'PROPERTY_APF',
    outcome: 'Negative',
    formData: {
      ...baseCase,
      addressLocatable: 'Easy to Locate',
      addressRating: 'Good',
      constructionActivity: 'CONSTRUCTION IS STOP',
      buildingStatus: 'Under Construction',
      activityStopReason: 'Funds frozen',
      projectName: 'ACS Heights',
      projectStartedDate: '2024-01-15',
      projectCompletionDate: '2026-12-31',
      totalWing: '4',
      totalFlats: '120',
      projectCompletionPercent: 60,
      staffStrength: 25,
      staffSeen: 5,
      tpcMetPerson1: 'Neighbour',
      tpcName1: 'Mr. Patel',
      tpcConfirmation1: 'Confirmed',
      tpcMetPerson2: 'Security',
      tpcName2: 'Mr. Kumar',
      tpcConfirmation2: 'Not Confirmed',
      locality: 'Commercial Tower',
      companyNamePlateStatus: 'Sighted As',
      nameOnBoard: 'ACS Heights',
      landmark1: 'Near Metro',
      landmark2: 'Near Mall',
      politicalConnection: 'Not Having Any Political Connection',
      dominatedArea: 'Not A Community Dominated',
      feedbackFromNeighbour: 'Adverse',
      otherObservation: 'Construction halted',
      finalStatus: 'Negative',
    },
  },
  {
    label: 'Property APF — NEGATIVE_VACANT',
    verificationType: 'PROPERTY_APF',
    outcome: 'Negative',
    formData: {
      ...baseCase,
      addressLocatable: 'Easy to Locate',
      addressRating: 'Shabby',
      constructionActivity: 'PLOT IS VACANT',
      locality: 'Commercial Tower',
      landmark1: 'Near Metro',
      landmark2: 'Near Mall',
      politicalConnection: 'Not Having Any Political Connection',
      dominatedArea: 'Not A Community Dominated',
      feedbackFromNeighbour: 'No Adverse',
      otherObservation: 'Plot is vacant, no construction activity',
      finalStatus: 'Negative',
    },
  },
  {
    label: 'Property APF — ERT',
    verificationType: 'PROPERTY_APF',
    outcome: 'Entry Restricted',
    formData: {
      ...baseCase,
      addressLocatable: 'Easy to Locate',
      addressRating: 'Good',
      buildingStatus: 'New Construction',
      metPersonType: 'Security',
      metPersonName: 'Mr. Singh',
      metPersonConfirmation: 'Confirmed',
      tpcMetPerson1: 'Neighbour',
      tpcName1: 'Mr. Patel',
      tpcMetPerson2: 'Security',
      tpcName2: 'Mr. Kumar',
      locality: 'Commercial Tower',
      companyNamePlateStatus: 'Sighted As',
      nameOnBoard: 'ACS Heights',
      landmark1: 'Near Metro',
      landmark2: 'Near Mall',
      politicalConnection: 'Not Having Any Political Connection',
      dominatedArea: 'Not A Community Dominated',
      feedbackFromNeighbour: 'No Adverse',
      otherObservation: 'Entry not allowed',
      finalStatus: 'Refer',
    },
  },
  {
    label: 'Property APF — UNTRACEABLE',
    verificationType: 'PROPERTY_APF',
    outcome: 'Untraceable',
    formData: {
      ...baseCase,
      contactPerson: 'Mr. Verma',
      callRemark: 'Did Not Pick Up Call',
      locality: 'Tower',
      landmark1: 'Near Metro',
      landmark2: 'Near Mall',
      landmark3: 'Near School',
      landmark4: 'Near Park',
      dominatedArea: 'Not A Community Dominated',
      otherObservation: 'Address not traceable',
      finalStatus: 'Refer',
    },
  },
  {
    label: 'Property Individual — POSITIVE_DOOR_OPEN',
    verificationType: 'PROPERTY_INDIVIDUAL',
    outcome: 'Positive',
    formData: {
      ...baseCase,
      addressLocatable: 'Easy to Locate',
      addressRating: 'Good',
      buildingStatus: 'New Construction',
      flatStatus: 'Open',
      metPersonName: 'Mrs. Doe',
      relationship: 'Wife',
      metPersonRelation: 'Wife',
      propertyOwnerName: 'JOHN DOE',
      ownerName: 'JOHN DOE',
      approxArea: 850,
      tpcMetPerson1: 'Neighbour',
      tpcName1: 'Mr. Patel',
      tpcConfirmation1: 'Confirmed',
      tpcMetPerson2: 'Security',
      tpcName2: 'Mr. Kumar',
      tpcConfirmation2: 'Confirmed',
      locality: 'Resi Building',
      addressStructure: '6',
      addressExistAt: '4',
      addressStructureColor: 'White',
      doorColor: 'Brown',
      doorNamePlateStatus: 'Sighted As',
      nameOnDoorPlate: 'JOHN DOE',
      societyNamePlateStatus: 'Sighted As',
      nameOnSocietyBoard: 'ACS Heights',
      landmark1: 'Near Metro',
      landmark2: 'Near Mall',
      politicalConnection: 'Not Having Any Political Connection',
      dominatedArea: 'Not A Community Dominated',
      feedbackFromNeighbour: 'No Adverse',
      otherObservation: 'Property confirmed',
      finalStatus: 'Positive',
    },
  },
  {
    label: 'Property Individual — POSITIVE_DOOR_LOCKED',
    verificationType: 'PROPERTY_INDIVIDUAL',
    outcome: 'Positive',
    formData: {
      ...baseCase,
      addressLocatable: 'Easy to Locate',
      addressRating: 'Good',
      buildingStatus: 'Redevloped Construction',
      flatStatus: 'Closed',
      tpcMetPerson1: 'Neighbour',
      tpcName1: 'Mr. Patel',
      tpcConfirmation1: 'Confirmed',
      tpcMetPerson2: 'Security',
      tpcName2: 'Mr. Kumar',
      tpcConfirmation2: 'Confirmed',
      locality: 'Resi Building',
      addressStructure: '6',
      addressExistAt: '4',
      addressStructureColor: 'White',
      doorColor: 'Brown',
      doorNamePlateStatus: 'Sighted As',
      nameOnDoorPlate: 'JOHN DOE',
      societyNamePlateStatus: 'Sighted As',
      nameOnSocietyBoard: 'ACS Heights',
      landmark1: 'Near Metro',
      landmark2: 'Near Mall',
      politicalConnection: 'Not Having Any Political Connection',
      dominatedArea: 'Not A Community Dominated',
      feedbackFromNeighbour: 'No Adverse',
      otherObservation: 'Door locked, TPC confirms',
      finalStatus: 'Positive',
    },
  },
  {
    label: 'Property Individual — NSP_DOOR_OPEN',
    verificationType: 'PROPERTY_INDIVIDUAL',
    outcome: 'NSP',
    formData: {
      ...baseCase,
      addressLocatable: 'Easy to Locate',
      addressRating: 'Good',
      buildingStatus: 'New Construction',
      flatStatus: 'Open',
      metPersonName: 'Mr. Random',
      relationship: 'Other',
      metPersonRelation: 'Other',
      propertyOwnerName: 'DIFFERENT PERSON',
      ownerName: 'DIFFERENT PERSON',
      tpcMetPerson1: 'Neighbour',
      tpcName1: 'Mr. Patel',
      tpcConfirmation1: 'Not Confirmed',
      tpcMetPerson2: 'Security',
      tpcName2: 'Mr. Kumar',
      tpcConfirmation2: 'Not Confirmed',
      locality: 'Resi Building',
      addressStructure: '6',
      addressStructureColor: 'White',
      doorColor: 'Brown',
      doorNamePlateStatus: 'Sighted As',
      nameOnDoorPlate: 'DIFFERENT PERSON',
      societyNamePlateStatus: 'Sighted As',
      nameOnSocietyBoard: 'ACS Heights',
      landmark1: 'Near Metro',
      landmark2: 'Near Mall',
      dominatedArea: 'Not A Community Dominated',
      otherObservation: 'No such person at address',
      finalStatus: 'Negative',
    },
  },
  {
    label: 'Property Individual — ERT',
    verificationType: 'PROPERTY_INDIVIDUAL',
    outcome: 'Entry Restricted',
    formData: {
      ...baseCase,
      addressLocatable: 'Easy to Locate',
      addressRating: 'Good',
      buildingStatus: 'New Construction',
      flatStatus: 'Closed',
      metPersonType: 'Security',
      metPersonName: 'Mr. Guard',
      metPersonConfirmation: 'Confirmed',
      propertyOwnerName: 'JOHN DOE',
      ownerName: 'JOHN DOE',
      locality: 'Resi Building',
      addressStructure: '6',
      addressStructureColor: 'White',
      societyNamePlateStatus: 'Sighted As',
      nameOnSocietyBoard: 'ACS Heights',
      landmark1: 'Near Metro',
      landmark2: 'Near Mall',
      politicalConnection: 'Not Having Any Political Connection',
      dominatedArea: 'Not A Community Dominated',
      feedbackFromNeighbour: 'No Adverse',
      otherObservation: 'Society security confirmed',
      finalStatus: 'Refer',
    },
  },
  {
    label: 'Property Individual — UT',
    verificationType: 'PROPERTY_INDIVIDUAL',
    outcome: 'Untraceable',
    formData: {
      ...baseCase,
      contactPerson: 'Mr. Verma',
      callRemark: 'Number Is Switch Off',
      locality: 'Tower',
      landmark1: 'Near Metro',
      landmark2: 'Near Mall',
      landmark3: 'Near School',
      landmark4: 'Near Park',
      dominatedArea: 'Not A Community Dominated',
      otherObservation: 'Address could not be traced',
      finalStatus: 'Refer',
    },
  },
  // Office probes — verify designation→metPersonDesignation rename + met_person_type
  {
    label: 'Office — POSITIVE_DOOR_OPEN',
    verificationType: 'OFFICE',
    outcome: 'Positive',
    formData: {
      ...baseCase,
      addressLocatable: 'Easy to Locate',
      addressRating: 'Good',
      officeStatus: 'Open',
      metPersonName: 'Mr. Manager',
      metPersonDesignation: 'Manager',
      workingPeriodValue: '5',
      workingPeriodUnit: 'Years',
      applicantDesignation: 'Sr. Officer',
      workingStatus: 'Permanent',
      officeType: 'Private Limited',
      companyNatureOfBusiness: 'IT Services',
      staffStrength: 50,
      staffSeen: 30,
      establishmentPeriod: '10 Years',
      officeApproxArea: 5000,
      tpcMetPerson1: 'Neighbour',
      tpcName1: 'Mr. Patel',
      tpcConfirmation1: 'Confirmed',
      tpcMetPerson2: 'Security',
      tpcName2: 'Mr. Kumar',
      tpcConfirmation2: 'Confirmed',
      locality: 'Office Building',
      addressStructure: '10',
      addressStructureColor: 'White',
      doorColor: 'Brown',
      companyNamePlateStatus: 'Sighted As',
      nameOnBoard: 'ACS Tech',
      landmark1: 'Near Metro',
      landmark2: 'Near Mall',
      politicalConnection: 'Not Having Any Political Connection',
      dominatedArea: 'Not A Community Dominated',
      feedbackFromNeighbour: 'No Adverse',
      otherObservation: 'Office active',
      finalStatus: 'Positive',
    },
  },
  // Office ERT to verify met_person_type
  {
    label: 'Office — ERT',
    verificationType: 'OFFICE',
    outcome: 'Entry Restricted',
    formData: {
      ...baseCase,
      addressLocatable: 'Easy to Locate',
      addressRating: 'Good',
      metPersonType: 'Security',
      metPersonName: 'Mr. Guard',
      metPersonConfirmation: 'Confirmed',
      applicantWorkingStatus: 'Working',
      locality: 'Office Building',
      addressStructure: '10',
      addressStructureColor: 'White',
      companyNamePlateStatus: 'Sighted As',
      nameOnBoard: 'ACS Tech',
      landmark1: 'Near Metro',
      landmark2: 'Near Mall',
      politicalConnection: 'Not Having Any Political Connection',
      dominatedArea: 'Not A Community Dominated',
      feedbackFromNeighbour: 'No Adverse',
      otherObservation: 'Security confirms working',
      finalStatus: 'Refer',
    },
  },
];

interface RenderResult {
  label: string;
  ok: boolean;
  unresolved: string[];
  preview: string;
  error?: string;
}

function renderOne(probe: Probe): RenderResult {
  try {
    const result = templateReportService.generateTemplateReport({
      verificationType: probe.verificationType,
      outcome: probe.outcome,
      formData: probe.formData,
      caseDetails: {
        caseId: '00000000-0000-0000-0000-000000000000',
        customerName: (probe.formData.customerName as string) || 'TEST',
        address: 'TEST ADDRESS',
        applicantType: 'APPLICANT',
      },
    });

    if (!result.success) {
      return {
        label: probe.label,
        ok: false,
        unresolved: [],
        preview: '',
        error: result.error || 'unknown error',
      };
    }

    const report = result.report || '';
    const unresolved = Array.from(report.matchAll(/\{[A-Za-z_0-9]+\}/g)).map(m => m[0]);
    const uniq = Array.from(new Set(unresolved));
    return {
      label: probe.label,
      ok: uniq.length === 0,
      unresolved: uniq,
      preview: report.slice(0, 600),
    };
  } catch (err) {
    return {
      label: probe.label,
      ok: false,
      unresolved: [],
      preview: '',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function main() {
  console.log('═'.repeat(72));
  console.log('  TEMPLATE-RENDER VERIFICATION — 2026-04-27');
  console.log('═'.repeat(72));
  console.log();

  const results: RenderResult[] = probes.map(renderOne);

  let pass = 0;
  let fail = 0;
  for (const r of results) {
    const tag = r.ok ? '✓ PASS' : '✗ FAIL';
    console.log(`${tag}  ${r.label}`);
    if (!r.ok) {
      if (r.error) {
        console.log(`        ERROR: ${r.error}`);
      } else if (r.unresolved.length > 0) {
        console.log(`        Unresolved: ${r.unresolved.join(', ')}`);
      }
      fail++;
    } else {
      pass++;
    }
  }

  console.log();
  console.log('─'.repeat(72));
  console.log(`  SUMMARY: ${pass} pass / ${fail} fail / ${results.length} total`);
  console.log('─'.repeat(72));

  // Print 3 rendered previews for spot check
  console.log();
  console.log('═'.repeat(72));
  console.log('  RENDERED PREVIEWS (spot check)');
  console.log('═'.repeat(72));
  for (const lbl of [
    'Property APF — POSITIVE (SEEN)',
    'Property APF — NEGATIVE_VACANT',
    'Property Individual — ERT',
  ]) {
    const r = results.find(x => x.label === lbl);
    if (r) {
      console.log();
      console.log(`── ${r.label} ──`);
      console.log(r.preview);
    }
  }

  if (fail > 0) {
    console.log();
    console.log('FIRST FAILED PREVIEW:');
    const firstFail = results.find(r => !r.ok);
    if (firstFail && firstFail.preview) {
      console.log(firstFail.preview);
    }
    process.exit(1);
  }
  process.exit(0);
}

try {
  main();
} catch (err) {
  console.error('FATAL:', err);
  process.exit(2);
}
