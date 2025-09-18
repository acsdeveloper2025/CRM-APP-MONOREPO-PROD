const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkVerificationTypes() {
  try {
    // Check RESIDENCE_CUM_OFFICE verification cases
    console.log('\n=== RESIDENCE_CUM_OFFICE VERIFICATION AUDIT ===');

    const residenceCumOfficeCasesQuery = `
      SELECT
        "caseId",
        "customerName",
        "verificationOutcome",
        "verificationData"->>'formType' as form_type,
        "status"
      FROM cases
      WHERE "verificationType" IN ('RESIDENCE_CUM_OFFICE', 'Residence-cum-office')
      AND "verificationData" IS NOT NULL
      AND "verificationData"::text != '{}'
      ORDER BY "caseId"
    `;

    const residenceCumOfficeCases = await pool.query(residenceCumOfficeCasesQuery);
    console.log('RESIDENCE_CUM_OFFICE Cases with Form Submissions:');
    residenceCumOfficeCases.rows.forEach(row => {
      console.log(`Case ${row.caseId}: ${row.customerName}`);
      console.log(`  - Outcome: ${row.verificationOutcome}`);
      console.log(`  - Form Type: ${row.form_type}`);
      console.log(`  - Status: ${row.status}`);
      console.log('');
    });

    // Check what data is in residenceCumOfficeVerificationReports table
    console.log('\n=== CHECKING ALL RESIDENCE_CUM_OFFICE REPORTS ===');
    const allResidenceCumOfficeReportsQuery = `
      SELECT case_id, "caseId", customer_name, verification_outcome
      FROM "residenceCumOfficeVerificationReports"
      LIMIT 10
    `;

    const allResidenceCumOfficeReports = await pool.query(allResidenceCumOfficeReportsQuery);
    console.log(`Found ${allResidenceCumOfficeReports.rows.length} RESIDENCE_CUM_OFFICE reports in database:`);
    allResidenceCumOfficeReports.rows.forEach(row => {
      console.log(`  Case ${row.caseId}: ${row.customer_name} - ${row.verification_outcome}`);
    });

    if (residenceCumOfficeCases.rows.length > 0) {
      const firstResidenceCumOfficeCase = residenceCumOfficeCases.rows[0];
      console.log(`\n=== DETAILED AUDIT FOR RESIDENCE_CUM_OFFICE CASE ${firstResidenceCumOfficeCase.caseId} ===`);

      const residenceCumOfficeReportQuery = `
        SELECT
          r.*
        FROM "residenceCumOfficeVerificationReports" r
        JOIN cases c ON r.case_id = c.id
        WHERE c."caseId" = '${firstResidenceCumOfficeCase.caseId}'
        LIMIT 1
      `;

      const residenceCumOfficeReport = await pool.query(residenceCumOfficeReportQuery);
      if (residenceCumOfficeReport.rows.length > 0) {
        const row = residenceCumOfficeReport.rows[0];
        console.log(`RESIDENCE_CUM_OFFICE Case ${firstResidenceCumOfficeCase.caseId} - ALL DATABASE FIELDS:`);
        Object.keys(row).forEach(key => {
          console.log(`  ${key}: ${row[key]}`);
        });
      } else {
        console.log(`No data found in residenceCumOfficeVerificationReports for case ${firstResidenceCumOfficeCase.caseId}`);
      }
    }

    // Check database schema for RESIDENCE_CUM_OFFICE reports
    console.log('\n=== RESIDENCE_CUM_OFFICE DATABASE SCHEMA CHECK ===');

    const residenceCumOfficeSchemaQuery = `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'residenceCumOfficeVerificationReports'
      ORDER BY column_name
    `;

    const residenceCumOfficeSchemaResult = await pool.query(residenceCumOfficeSchemaQuery);
    console.log('All columns in residenceCumOfficeVerificationReports:');
    residenceCumOfficeSchemaResult.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkVerificationTypes();
