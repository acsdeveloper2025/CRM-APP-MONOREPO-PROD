import { Pool } from 'pg';
import { templateReportService } from '../src/services/TemplateReportService';
import * as fs from 'fs';

const pool = new Pool({user:'acs_user',host:'localhost',database:'acs_db',password:'acs_password',port:5432});
const TYPE_MAP: Record<string,string> = {RV:'RESIDENCE',OV:'OFFICE',EV:'BUSINESS',BV:'BUILDER',NV:'NOC',DV:'DSA_CONNECTOR',RC:'RESIDENCE_CUM_OFFICE',PAV:'PROPERTY_APF',PIV:'PROPERTY_INDIVIDUAL'};
const O: Record<string,string> = {Positive_Open:'Positive & Door Open',Positive_Closed:'Positive & Door Locked',Shifted_Open:'Shifted & Door Open',Shifted_Closed:'Shifted & Door Locked',Nsp_Open:'NSP & Door Open',Nsp_Closed:'NSP & Door Locked',EntryRestricted:'Entry Restricted',Untraceable:'Untraceable',Positive_Seen:'Positive (Construction Seen)',Positive_Stop:'Negative (Construction Stop)',Positive_Vacant:'Negative (Plot Vacant)'};

(async () => {
  const lines = fs.readFileSync('/tmp/matrix_results.jsonl','utf8').trim().split('\n');
  // Pick 4 representatives: RV/Positive_Open, BV/Positive_Open, PAV/Positive_Stop, NV/Untraceable
  const wanted = new Set(['RV/Positive_Open','BV/Positive_Open','PAV/Positive_Stop','NV/Untraceable']);
  for (const ln of lines) {
    const r = JSON.parse(ln);
    const k = r.code+'/'+r.key;
    if (!wanted.has(k)) continue;
    const fs_row = await pool.query(`SELECT submission_data FROM form_submissions WHERE verification_task_id=$1 LIMIT 1`,[r.task_id]);
    const result = templateReportService.generateTemplateReport({
      verificationType: TYPE_MAP[r.code], outcome: O[r.key], formData: fs_row.rows[0].submission_data,
      caseDetails: {caseId:'G',address:'A-301 Sunshine Apartments, MG Road, Mumbai 400058',customerName:'GRAMMAR TEST',applicantType:'APPLICANT'} as any,
    });
    console.log('\n==========', k, '==========\n');
    console.log(result.report);
  }
  await pool.end();
})();
