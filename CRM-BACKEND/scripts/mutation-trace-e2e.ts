/**
 * MUTATION TRACE — proof-based data integrity test.
 *
 * For each of 10 cases (Residence × 5 outcomes + Office × 5 outcomes):
 *   1. DELETE old rows to start clean
 *   2. INSERT row with baseline sentinels (V1)
 *   3. SELECT from DB → build formData → render V1
 *   4. UPDATE DB: mutate 1 text column + 1 dropdown column
 *   5. Re-SELECT from DB → build formData → render V2
 *   6. Insert image attachment V1 filename → UPDATE filename → SELECT
 *   7. Diff: report whether V1/V2 values appear correctly in respective renders
 *
 * Exits 0 if every case passes all 3 mutations. Any failure prints ❌ with context.
 */

import { config } from 'dotenv';
config();

import { Pool } from 'pg';
import { templateReportService } from '../src/services/TemplateReportService';

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    'postgresql://acs_user:acs_password@localhost:5432/acs_db',
});

const TASK_ID = '877da91d-3a95-42cc-90c9-193be02bb4f6';
const USER_ID = 'c9a680d9-cca9-4cd1-b500-54f301c11c7a';

type Case = {
  name: string;
  table: string;
  formType: string;
  outcome: string;
  verificationType: string;
  baseline: Record<string, unknown>; // snake_case DB columns
  mutations: { text: [string, string, string]; dropdown: [string, string, string] }; // [column, v1, v2]
  remap: (row: Record<string, unknown>) => Record<string, unknown>;
};

// Helper — extract common snake→camel mapping for residence/office
const r2c = (row: Record<string, unknown>, columns: string[]): Record<string, unknown> => {
  const fd: Record<string, unknown> = {};
  for (const col of columns) {
    const camel = col.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    fd[camel] = row[col];
  }
  return fd;
};

const COMMON_BASE = {
  verification_task_id: TASK_ID,
  case_id: '5f814068-34d8-4679-a7ac-76c872211042',
  verified_by: USER_ID,
  verification_date: new Date(),
};

const cases: Case[] = [
  {
    name: 'Residence POSITIVE Door Open',
    table: 'residence_verification_reports',
    formType: 'POSITIVE',
    outcome: 'Positive & Door Open',
    verificationType: 'RESIDENCE',
    baseline: {
      ...COMMON_BASE,
      form_type: 'POSITIVE',
      verification_outcome: 'Positive & Door Open',
      customer_name: 'SENTINEL-CUST-V1',
      address_locatable: 'Easy to Locate',
      address_rating: 'Good',
      house_status: 'Open',
      met_person_name: 'SENTINEL-MET-V1',
      met_person_relation: 'Self',
      staying_period: '3 Year',
      staying_status: 'On a Self Owned Basis',
      total_family_members: 4,
      total_earning_member: 2,
      working_status: 'Salaried',
      company_name: 'TestCo',
      approx_area: 850,
      document_shown_status: 'Showed',
      document_type: 'Aadhar Card',
      tpc_met_person1: 'Neighbour',
      tpc_name1: 'Mr. Shah',
      tpc_confirmation1: 'Confirmed',
      tpc_met_person2: 'Security',
      tpc_name2: 'Rajesh',
      tpc_confirmation2: 'Confirmed',
      locality: 'Resi Building',
      address_structure: '10',
      applicant_staying_floor: '4',
      address_structure_color: 'White',
      door_color: 'Brown',
      door_nameplate_status: 'SIGHTED AS',
      name_on_door_plate: 'PARAB',
      society_nameplate_status: 'SIGHTED AS',
      name_on_society_board: 'Test Tower',
      landmark1: 'Metro',
      landmark2: 'Mall',
      political_connection: 'Not Having Political Connection',
      dominated_area: 'Not A Community Dominated',
      feedback_from_neighbour: 'Positive',
      other_observation: 'SENTINEL-OBS-V1',
      final_status: 'Positive',
    },
    mutations: {
      text: ['other_observation', 'SENTINEL-OBS-V1', 'MUTATED-OBS-V2'],
      dropdown: ['staying_status', 'On a Self Owned Basis', 'On a Rented Basis'],
    },
    remap: (row) =>
      r2c(row, [
        'customer_name', 'address_locatable', 'address_rating', 'house_status',
        'met_person_name', 'met_person_relation', 'staying_period', 'staying_status',
        'total_family_members', 'total_earning_member', 'working_status', 'company_name',
        'approx_area', 'document_shown_status', 'document_type',
        'tpc_met_person1', 'tpc_name1', 'tpc_confirmation1',
        'tpc_met_person2', 'tpc_name2', 'tpc_confirmation2',
        'locality', 'address_structure', 'applicant_staying_floor',
        'address_structure_color', 'door_color',
        'door_nameplate_status', 'name_on_door_plate',
        'society_nameplate_status', 'name_on_society_board',
        'landmark1', 'landmark2',
        'political_connection', 'dominated_area', 'feedback_from_neighbour',
        'other_observation', 'final_status',
      ]),
  },
  {
    name: 'Residence SHIFTED Door Open',
    table: 'residence_verification_reports',
    formType: 'SHIFTED',
    outcome: 'Shifted & Door Open',
    verificationType: 'RESIDENCE',
    baseline: {
      ...COMMON_BASE,
      form_type: 'SHIFTED',
      verification_outcome: 'Shifted & Door Open',
      customer_name: 'SENTINEL-CUST-V1',
      address_locatable: 'Easy to Locate',
      address_rating: 'Good',
      house_status: 'Open',
      met_person_name: 'SENTINEL-MET-V1',
      met_person_status: 'Current Tenant',
      shifted_period: '8 Month',
      locality: 'Resi Building',
      address_structure: '10',
      address_floor: '4',
      address_structure_color: 'White',
      door_color: 'Brown',
      door_nameplate_status: 'SIGHTED AS',
      name_on_door_plate: 'SHARMA',
      society_nameplate_status: 'SIGHTED AS',
      name_on_society_board: 'Test Tower',
      tpc_met_person1: 'Neighbour', tpc_name1: 'Mr. Shah', tpc_confirmation1: 'Confirmed',
      tpc_met_person2: 'Security', tpc_name2: 'Rajesh', tpc_confirmation2: 'Confirmed',
      landmark1: 'Metro', landmark2: 'Mall',
      political_connection: 'Not Having Political Connection',
      dominated_area: 'Not A Community Dominated',
      feedback_from_neighbour: 'No Adverse',
      other_observation: 'SENTINEL-OBS-V1',
      final_status: 'Refer',
    },
    mutations: {
      text: ['other_observation', 'SENTINEL-OBS-V1', 'MUTATED-OBS-V2'],
      dropdown: ['met_person_status', 'Current Tenant', 'Owner'],
    },
    remap: (row) =>
      r2c(row, [
        'customer_name', 'address_locatable', 'address_rating', 'house_status',
        'met_person_name', 'met_person_status', 'shifted_period',
        'locality', 'address_structure', 'address_floor',
        'address_structure_color', 'door_color',
        'door_nameplate_status', 'name_on_door_plate',
        'society_nameplate_status', 'name_on_society_board',
        'tpc_met_person1', 'tpc_name1', 'tpc_confirmation1',
        'tpc_met_person2', 'tpc_name2', 'tpc_confirmation2',
        'landmark1', 'landmark2',
        'political_connection', 'dominated_area', 'feedback_from_neighbour',
        'other_observation', 'final_status',
      ]),
  },
  {
    name: 'Residence NSP Door Open',
    table: 'residence_verification_reports',
    formType: 'NSP',
    outcome: 'NSP & Door Open',
    verificationType: 'RESIDENCE',
    baseline: {
      ...COMMON_BASE,
      form_type: 'NSP',
      verification_outcome: 'NSP & Door Open',
      customer_name: 'SENTINEL-CUST-V1',
      address_locatable: 'Easy to Locate',
      address_rating: 'Good',
      house_status: 'Open',
      met_person_name: 'SENTINEL-MET-V1',
      met_person_status: 'Current Resident',
      staying_period: '10 Year',
      locality: 'Resi Building',
      address_structure: '10',
      applicant_staying_floor: '4',
      address_structure_color: 'White',
      door_color: 'Brown',
      door_nameplate_status: 'SIGHTED AS',
      name_on_door_plate: 'PATEL',
      society_nameplate_status: 'SIGHTED AS',
      name_on_society_board: 'Test Tower',
      tpc_met_person1: 'Neighbour', tpc_name1: 'Mr. Shah', tpc_confirmation1: 'Confirmed',
      tpc_met_person2: 'Security', tpc_name2: 'Rajesh', tpc_confirmation2: 'Confirmed',
      landmark1: 'Metro', landmark2: 'Mall',
      dominated_area: 'Not A Community Dominated',
      other_observation: 'SENTINEL-OBS-V1',
      final_status: 'Negative',
    },
    mutations: {
      text: ['other_observation', 'SENTINEL-OBS-V1', 'MUTATED-OBS-V2'],
      // Switched from met_person_status (V1 "Current Resident" collides with template line 161
      // hardcoded phrase "As per the current resident") to address_rating (pure pass-through).
      dropdown: ['address_rating', 'Good', 'Average'],
    },
    remap: (row) =>
      r2c(row, [
        'customer_name', 'address_locatable', 'address_rating', 'house_status',
        'met_person_name', 'met_person_status', 'staying_period',
        'locality', 'address_structure', 'applicant_staying_floor',
        'address_structure_color', 'door_color',
        'door_nameplate_status', 'name_on_door_plate',
        'society_nameplate_status', 'name_on_society_board',
        'tpc_met_person1', 'tpc_name1', 'tpc_confirmation1',
        'tpc_met_person2', 'tpc_name2', 'tpc_confirmation2',
        'landmark1', 'landmark2', 'dominated_area',
        'other_observation', 'final_status',
      ]),
  },
  {
    name: 'Residence ERT',
    table: 'residence_verification_reports',
    formType: 'ENTRY_RESTRICTED',
    outcome: 'Entry Restricted',
    verificationType: 'RESIDENCE',
    baseline: {
      ...COMMON_BASE,
      form_type: 'ENTRY_RESTRICTED',
      verification_outcome: 'Entry Restricted',
      customer_name: 'SENTINEL-CUST-V1',
      address_locatable: 'Easy to Locate',
      address_rating: 'Good',
      name_of_met_person: 'SENTINEL-MET-V1',
      met_person_type: 'Security',
      met_person_confirmation: 'Confirmed',
      applicant_staying_status: 'Applicant is Staying At',
      locality: 'Resi Building',
      address_structure: '10',
      applicant_staying_floor: '4',
      address_structure_color: 'White',
      society_nameplate_status: 'SIGHTED AS',
      name_on_society_board: 'Test Tower',
      landmark1: 'Metro', landmark2: 'Mall',
      political_connection: 'Not Having Political Connection',
      dominated_area: 'Not A Community Dominated',
      feedback_from_neighbour: 'Positive',
      other_observation: 'SENTINEL-OBS-V1',
      final_status: 'Refer',
    },
    mutations: {
      text: ['name_of_met_person', 'SENTINEL-MET-V1', 'MUTATED-MET-V2'],
      // Switched from applicant_staying_status (helper transforms raw value to
      // "the applicant is staying at the given address" — raw substring won't
      // appear verbatim). Using met_person_type (pass-through {Met_Person_Type}).
      dropdown: ['met_person_type', 'Security', 'Receptionist'],
    },
    remap: (row) =>
      r2c(row, [
        'customer_name', 'address_locatable', 'address_rating',
        'name_of_met_person', 'met_person_type', 'met_person_confirmation',
        'applicant_staying_status',
        'locality', 'address_structure', 'applicant_staying_floor',
        'address_structure_color',
        'society_nameplate_status', 'name_on_society_board',
        'landmark1', 'landmark2',
        'political_connection', 'dominated_area', 'feedback_from_neighbour',
        'other_observation', 'final_status',
      ]),
  },
  {
    name: 'Residence UNTRACEABLE',
    table: 'residence_verification_reports',
    formType: 'UNTRACEABLE',
    outcome: 'Untraceable',
    verificationType: 'RESIDENCE',
    baseline: {
      ...COMMON_BASE,
      form_type: 'UNTRACEABLE',
      verification_outcome: 'Untraceable',
      customer_name: 'SENTINEL-CUST-V1',
      contact_person: 'SENTINEL-CONTACT-V1',
      call_remark: 'Did Not Pick Up Call',
      locality: 'Chawl',
      landmark1: 'Metro', landmark2: 'Mall',
      landmark3: 'Park', landmark4: 'Bank',
      dominated_area: 'Not A Community Dominated',
      other_observation: 'SENTINEL-OBS-V1',
      final_status: 'Negative',
    },
    mutations: {
      text: ['contact_person', 'SENTINEL-CONTACT-V1', 'MUTATED-CONTACT-V2'],
      // Switched from call_remark (helper transforms "Did Not Pick Up Call" →
      // "the call was not picked up" — raw substring won't match). Using
      // locality (pass-through {Locality}).
      dropdown: ['locality', 'Chawl', 'Slum'],
    },
    remap: (row) =>
      r2c(row, [
        'customer_name', 'contact_person', 'call_remark', 'locality',
        'landmark1', 'landmark2', 'landmark3', 'landmark4',
        'dominated_area', 'other_observation', 'final_status',
      ]),
  },
  // ============== OFFICE ==============
  {
    name: 'Office POSITIVE Door Open',
    table: 'office_verification_reports',
    formType: 'POSITIVE',
    outcome: 'Positive & Door Open',
    verificationType: 'OFFICE',
    baseline: {
      ...COMMON_BASE,
      form_type: 'POSITIVE',
      verification_outcome: 'Positive & Door Open',
      customer_name: 'SENTINEL-CUST-V1',
      address_locatable: 'Easy to Locate',
      address_rating: 'Good',
      office_status: 'Open',
      met_person_name: 'SENTINEL-MET-V1',
      designation: 'HR Manager',
      working_period: '3 Year',
      applicant_designation: 'Software Engineer',
      working_status: 'Company Payroll',
      applicant_working_premises: 'Same Location',
      sitting_location: '',
      office_type: 'PVT. LTD. Company',
      company_nature_of_business: 'IT Services',
      staff_strength: 50,
      staff_seen: 30,
      office_approx_area: 2000,
      company_nameplate_status: 'SIGHTED AS',
      name_on_board: 'SENTINEL-CO-V1',
      establishment_period: '5 Year',
      tpc_met_person1: 'Neighbour', tpc_name1: 'Mr. Shah', tpc_confirmation1: 'Confirmed',
      tpc_met_person2: 'Security', tpc_name2: 'Rajesh', tpc_confirmation2: 'Confirmed',
      locality: 'Commercial',
      address_structure: '8',
      address_structure_color: 'White',
      door_color: 'Brown',
      landmark1: 'Metro', landmark2: 'Mall',
      political_connection: 'Not Having Political Connection',
      dominated_area: 'Not A Community Dominated',
      feedback_from_neighbour: 'Positive',
      other_observation: 'SENTINEL-OBS-V1',
      final_status: 'Positive',
    },
    mutations: {
      text: ['other_observation', 'SENTINEL-OBS-V1', 'MUTATED-OBS-V2'],
      // Switched from working_status (not narrated in Office POSITIVE template)
      // to designation (used in line 205 "({Designation})" — pass-through).
      dropdown: ['designation', 'HR Manager', 'General Manager'],
    },
    remap: (row) =>
      r2c(row, [
        'customer_name', 'address_locatable', 'address_rating', 'office_status',
        'met_person_name', 'designation', 'working_period', 'applicant_designation',
        'working_status', 'applicant_working_premises', 'sitting_location',
        'office_type', 'company_nature_of_business', 'staff_strength', 'staff_seen',
        'office_approx_area', 'company_nameplate_status', 'name_on_board',
        'establishment_period',
        'tpc_met_person1', 'tpc_name1', 'tpc_confirmation1',
        'tpc_met_person2', 'tpc_name2', 'tpc_confirmation2',
        'locality', 'address_structure', 'address_structure_color', 'door_color',
        'landmark1', 'landmark2',
        'political_connection', 'dominated_area', 'feedback_from_neighbour',
        'other_observation', 'final_status',
      ]),
  },
  {
    name: 'Office SHIFTED Door Open',
    table: 'office_verification_reports',
    formType: 'SHIFTED',
    outcome: 'Shifted & Door Open',
    verificationType: 'OFFICE',
    baseline: {
      ...COMMON_BASE,
      form_type: 'SHIFTED',
      verification_outcome: 'Shifted & Door Open',
      customer_name: 'SENTINEL-CUST-V1',
      address_locatable: 'Easy to Locate',
      address_rating: 'Good',
      office_status: 'Open',
      met_person_name: 'SENTINEL-MET-V1',
      designation: 'Receptionist',
      current_company_name: 'SENTINEL-CO-V1',
      current_company_period: '2 Year',
      old_office_shifted_period: '8 Month',
      company_nameplate_status: 'SIGHTED AS',
      name_on_board: 'V1 BOARD',
      tpc_met_person1: 'Neighbour', tpc_name1: 'Mr. Shah', tpc_confirmation1: 'Confirmed',
      tpc_met_person2: 'Security', tpc_name2: 'Rajesh', tpc_confirmation2: 'Confirmed',
      locality: 'Commercial',
      address_structure: '8',
      address_structure_color: 'White',
      door_color: 'Grey',
      landmark1: 'Metro', landmark2: 'Mall',
      political_connection: 'Not Having Political Connection',
      dominated_area: 'Not A Community Dominated',
      feedback_from_neighbour: 'No Adverse',
      other_observation: 'SENTINEL-OBS-V1',
      final_status: 'Refer',
    },
    mutations: {
      text: ['current_company_name', 'SENTINEL-CO-V1', 'MUTATED-NEWCO-V2'],
      dropdown: ['designation', 'Receptionist', 'Manager'],
    },
    remap: (row) =>
      r2c(row, [
        'customer_name', 'address_locatable', 'address_rating', 'office_status',
        'met_person_name', 'designation', 'current_company_name',
        'current_company_period', 'old_office_shifted_period',
        'company_nameplate_status', 'name_on_board',
        'tpc_met_person1', 'tpc_name1', 'tpc_confirmation1',
        'tpc_met_person2', 'tpc_name2', 'tpc_confirmation2',
        'locality', 'address_structure', 'address_structure_color', 'door_color',
        'landmark1', 'landmark2',
        'political_connection', 'dominated_area', 'feedback_from_neighbour',
        'other_observation', 'final_status',
      ]),
  },
  {
    name: 'Office NSP Door Open',
    table: 'office_verification_reports',
    formType: 'NSP',
    outcome: 'NSP & Door Open',
    verificationType: 'OFFICE',
    baseline: {
      ...COMMON_BASE,
      form_type: 'NSP',
      verification_outcome: 'NSP & Door Open',
      customer_name: 'SENTINEL-CUST-V1',
      address_locatable: 'Easy to Locate',
      address_rating: 'Good',
      office_status: 'Open',
      office_existence: 'Office Exist At',
      current_company_name: 'SENTINEL-CO-V1',
      met_person_name: 'SENTINEL-MET-V1',
      designation: 'HR Manager',
      company_nameplate_status: 'SIGHTED AS',
      name_on_board: 'V1 BOARD',
      tpc_met_person1: 'Neighbour', tpc_name1: 'Mr. Shah', tpc_confirmation1: 'Confirmed',
      tpc_met_person2: 'Security', tpc_name2: 'Rajesh', tpc_confirmation2: 'Confirmed',
      locality: 'Commercial',
      address_structure: '8',
      address_structure_color: 'White',
      door_color: 'Grey',
      landmark1: 'Metro', landmark2: 'Mall',
      dominated_area: 'Not A Community Dominated',
      other_observation: 'SENTINEL-OBS-V1',
      final_status: 'Negative',
    },
    mutations: {
      text: ['current_company_name', 'SENTINEL-CO-V1', 'MUTATED-NEWCO-V2'],
      dropdown: ['designation', 'HR Manager', 'Director'],
    },
    remap: (row) =>
      r2c(row, [
        'customer_name', 'address_locatable', 'address_rating', 'office_status',
        'office_existence', 'current_company_name',
        'met_person_name', 'designation',
        'company_nameplate_status', 'name_on_board',
        'tpc_met_person1', 'tpc_name1', 'tpc_confirmation1',
        'tpc_met_person2', 'tpc_name2', 'tpc_confirmation2',
        'locality', 'address_structure', 'address_structure_color', 'door_color',
        'landmark1', 'landmark2', 'dominated_area',
        'other_observation', 'final_status',
      ]),
  },
  {
    name: 'Office ERT',
    table: 'office_verification_reports',
    formType: 'ENTRY_RESTRICTED',
    outcome: 'Entry Restricted',
    verificationType: 'OFFICE',
    baseline: {
      ...COMMON_BASE,
      form_type: 'ENTRY_RESTRICTED',
      verification_outcome: 'Entry Restricted',
      customer_name: 'SENTINEL-CUST-V1',
      address_locatable: 'Easy to Locate',
      address_rating: 'Good',
      met_person_type: 'Security',
      name_of_met_person: 'SENTINEL-MET-V1',
      met_person_confirmation: 'Confirmed',
      applicant_working_status: 'Applicant is Working At',
      office_status: 'Office Exist At',
      locality: 'Commercial',
      address_structure: '8',
      address_floor: '2',
      address_structure_color: 'White',
      landmark1: 'Metro', landmark2: 'Mall',
      political_connection: 'Not Having Political Connection',
      dominated_area: 'Not A Community Dominated',
      feedback_from_neighbour: 'Positive',
      other_observation: 'SENTINEL-OBS-V1',
      final_status: 'Refer',
    },
    mutations: {
      text: ['name_of_met_person', 'SENTINEL-MET-V1', 'MUTATED-MET-V2'],
      // Switched from applicant_working_status (helper-transformed raw→"the applicant
      // is working at..."). Then switched from met_person_type ("Security" V1 collides
      // with template line 292 hardcoded "security protocols"). Using address_rating.
      dropdown: ['address_rating', 'Good', 'Average'],
    },
    remap: (row) =>
      r2c(row, [
        'customer_name', 'address_locatable', 'address_rating',
        'met_person_type', 'name_of_met_person', 'met_person_confirmation',
        'applicant_working_status', 'office_status',
        'locality', 'address_structure', 'address_floor', 'address_structure_color',
        'landmark1', 'landmark2',
        'political_connection', 'dominated_area', 'feedback_from_neighbour',
        'other_observation', 'final_status',
      ]),
  },
  {
    name: 'Office UNTRACEABLE',
    table: 'office_verification_reports',
    formType: 'UNTRACEABLE',
    outcome: 'Untraceable',
    verificationType: 'OFFICE',
    baseline: {
      ...COMMON_BASE,
      form_type: 'UNTRACEABLE',
      verification_outcome: 'Untraceable',
      customer_name: 'SENTINEL-CUST-V1',
      contact_person: 'SENTINEL-CONTACT-V1',
      call_remark: 'Did Not Pick Up Call',
      locality: 'Commercial',
      landmark1: 'Metro', landmark2: 'Mall',
      landmark3: 'Park', landmark4: 'Bank',
      dominated_area: 'Not A Community Dominated',
      other_observation: 'SENTINEL-OBS-V1',
      final_status: 'Refer',
    },
    mutations: {
      text: ['contact_person', 'SENTINEL-CONTACT-V1', 'MUTATED-CONTACT-V2'],
      // Switched from call_remark (helper transforms). Using locality (pass-through).
      dropdown: ['locality', 'Commercial', 'Industrial'],
    },
    remap: (row) =>
      r2c(row, [
        'customer_name', 'contact_person', 'call_remark', 'locality',
        'landmark1', 'landmark2', 'landmark3', 'landmark4',
        'dominated_area', 'other_observation', 'final_status',
      ]),
  },
];

async function cleanRow(table: string): Promise<void> {
  await pool.query(`DELETE FROM ${table} WHERE verification_task_id=$1`, [TASK_ID]);
}

async function insertRow(table: string, row: Record<string, unknown>): Promise<void> {
  const cols = Object.keys(row);
  const vals = Object.values(row);
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
  await pool.query(
    `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`,
    vals,
  );
}

async function updateRow(
  table: string,
  textCol: string,
  textV2: string,
  dropCol: string,
  dropV2: string,
): Promise<void> {
  await pool.query(
    `UPDATE ${table} SET ${textCol}=$1, ${dropCol}=$2 WHERE verification_task_id=$3`,
    [textV2, dropV2, TASK_ID],
  );
}

async function readRow(table: string): Promise<Record<string, unknown>> {
  const { rows } = await pool.query(
    `SELECT * FROM ${table} WHERE verification_task_id=$1 LIMIT 1`,
    [TASK_ID],
  );
  return rows[0];
}

async function runImageMutation(caseName: string): Promise<{ ok: boolean; note: string }> {
  const baselineFn = `mutation-${Date.now()}-V1.jpg`;
  const mutatedFn = `mutation-${Date.now()}-V2.jpg`;
  const subId = `mutation-trace-${Date.now()}`;
  const filePath = `uploads/mutation-trace/${baselineFn}`;

  await pool.query(
    `INSERT INTO verification_attachments
     (case_id, verification_task_id, verification_type, filename, original_name,
      mime_type, file_size, file_path, uploaded_by, photo_type, submission_id)
     VALUES ($1,$2,'mutation-trace',$3,$4,'image/jpeg',1024,
             $5, $6, 'building', $7)`,
    [COMMON_BASE.case_id, TASK_ID, baselineFn, baselineFn, filePath, USER_ID, subId],
  );

  const r1 = await pool.query(
    `SELECT filename FROM verification_attachments WHERE submission_id=$1`,
    [subId],
  );
  const v1Stored = r1.rows[0]?.filename;

  await pool.query(
    `UPDATE verification_attachments SET filename=$1 WHERE submission_id=$2`,
    [mutatedFn, subId],
  );

  const r2 = await pool.query(
    `SELECT filename FROM verification_attachments WHERE submission_id=$1`,
    [subId],
  );
  const v2Stored = r2.rows[0]?.filename;

  // Clean up
  await pool.query(`DELETE FROM verification_attachments WHERE submission_id=$1`, [subId]);

  const ok = v1Stored === baselineFn && v2Stored === mutatedFn;
  return {
    ok,
    note: `V1→"${v1Stored}" V2→"${v2Stored}"${ok ? '' : ' MISMATCH'}`,
  };
}

type CaseResult = {
  name: string;
  textOk: boolean;
  textNote: string;
  dropOk: boolean;
  dropNote: string;
  imgOk: boolean;
  imgNote: string;
};

async function runCase(c: Case): Promise<CaseResult> {
  await cleanRow(c.table);

  // ---- V1 insert + render ----
  await insertRow(c.table, c.baseline);
  const row1 = await readRow(c.table);
  const fd1 = c.remap(row1);
  const r1 = templateReportService.generateTemplateReport({
    verificationType: c.verificationType,
    outcome: c.outcome,
    formData: fd1,
    caseDetails: {
      caseId: 'MUTATION-TEST',
      customerName: String(row1.customer_name || 'Customer'),
      applicantType: 'APPLICANT',
      address: 'Test Address',
    },
  });
  const report1 = r1.success ? (r1.report ?? '') : '';

  // ---- Mutation ----
  const [textCol, textV1, textV2] = c.mutations.text;
  const [dropCol, dropV1, dropV2] = c.mutations.dropdown;
  await updateRow(c.table, textCol, textV2, dropCol, dropV2);

  // ---- V2 re-read + re-render ----
  const row2 = await readRow(c.table);
  const fd2 = c.remap(row2);
  const r2 = templateReportService.generateTemplateReport({
    verificationType: c.verificationType,
    outcome: c.outcome,
    formData: fd2,
    caseDetails: {
      caseId: 'MUTATION-TEST',
      customerName: String(row2.customer_name || 'Customer'),
      applicantType: 'APPLICANT',
      address: 'Test Address',
    },
  });
  const report2 = r2.success ? (r2.report ?? '') : '';

  // ---- Assertions ----
  // V1: text sentinel should appear, V2 text should NOT appear
  // V2: text V2 should appear, V1 text should NOT appear (no stale data)
  const v1HasTextV1 = report1.includes(textV1);
  const v1HasTextV2 = report1.includes(textV2);
  const v2HasTextV1 = report2.includes(textV1);
  const v2HasTextV2 = report2.includes(textV2);

  const textOk = v1HasTextV1 && !v1HasTextV2 && !v2HasTextV1 && v2HasTextV2;
  const textNote = textOk
    ? `✓ text "${textCol}": V1→"${textV1}" rendered, V2→"${textV2}" rendered after UPDATE`
    : `✗ text "${textCol}": V1_has_V1=${v1HasTextV1}, V1_has_V2=${v1HasTextV2}, V2_has_V1=${v2HasTextV1}, V2_has_V2=${v2HasTextV2}`;

  // Dropdown: same logic. Note: dropdown values may be lowercased by helpers (lc wrap),
  // so we check case-insensitively AND also check exact.
  const inRep = (rep: string, v: string): boolean =>
    rep.includes(v) || rep.toLowerCase().includes(v.toLowerCase());
  const v1HasDropV1 = inRep(report1, dropV1);
  const v1HasDropV2 = inRep(report1, dropV2);
  const v2HasDropV1 = inRep(report2, dropV1);
  const v2HasDropV2 = inRep(report2, dropV2);

  const dropOk = v1HasDropV1 && !v1HasDropV2 && !v2HasDropV1 && v2HasDropV2;
  const dropNote = dropOk
    ? `✓ dropdown "${dropCol}": V1→"${dropV1}" rendered (case-insens.), V2→"${dropV2}" rendered after UPDATE`
    : `✗ dropdown "${dropCol}": V1_has_V1=${v1HasDropV1}, V1_has_V2=${v1HasDropV2}, V2_has_V1=${v2HasDropV1}, V2_has_V2=${v2HasDropV2}`;

  // Image mutation — isolated so failures don't mask text/dropdown results
  let imgOk = false;
  let imgNote = '';
  try {
    const img = await runImageMutation(c.name);
    imgOk = img.ok;
    imgNote = `image: ${img.note}`;
  } catch (e: unknown) {
    imgOk = false;
    imgNote = `image: threw ${String((e as Error)?.message || e)}`;
  }

  // Clean up row
  await cleanRow(c.table);

  return { name: c.name, textOk, textNote, dropOk, dropNote, imgOk, imgNote };
}

async function main() {
  console.log('=== MUTATION TRACE (Residence + Office, all 10 outcomes) ===\n');
  const results: CaseResult[] = [];
  for (const c of cases) {
    try {
      const res = await runCase(c);
      results.push(res);
      const overall = res.textOk && res.dropOk && res.imgOk ? '✅' : '❌';
      console.log(`${overall} ${res.name}`);
      console.log(`    ${res.textNote}`);
      console.log(`    ${res.dropNote}`);
      console.log(`    ${res.imgNote}`);
      console.log();
    } catch (err) {
      console.log(`❌ ${c.name} — threw error:`, err);
      results.push({
        name: c.name,
        textOk: false,
        textNote: `error: ${String(err)}`,
        dropOk: false,
        dropNote: '',
        imgOk: false,
        imgNote: '',
      });
    }
  }

  const passCount = results.filter((r) => r.textOk && r.dropOk && r.imgOk).length;
  const total = results.length;
  console.log('=== FINAL MATRIX ===');
  console.log(`${passCount}/${total} cases fully consistent across Mobile-shape → DB → Render pipeline.`);
  console.log();

  console.table(
    results.map((r) => ({
      case: r.name,
      text: r.textOk ? '✅' : '❌',
      dropdown: r.dropOk ? '✅' : '❌',
      image: r.imgOk ? '✅' : '❌',
    })),
  );

  await pool.end();

  if (passCount !== total) process.exit(1);
}

main().catch((err) => {
  console.error('Mutation trace failed:', err);
  process.exit(1);
});
