const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function debugAttachments() {
  try {
    console.log('🔍 ATTACHMENT SYSTEM DEBUG AUDIT');
    console.log('================================');
    
    // 1. Check attachments table structure
    console.log('\n1. ATTACHMENTS TABLE STRUCTURE:');
    const tableStructure = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'attachments' 
      ORDER BY ordinal_position;
    `);
    console.table(tableStructure.rows);
    
    // 2. Check if attachments table exists and has data
    console.log('\n2. ATTACHMENTS TABLE DATA:');
    const attachmentCount = await pool.query('SELECT COUNT(*) as count FROM attachments');
    console.log(`Total attachments: ${attachmentCount.rows[0].count}`);
    
    if (attachmentCount.rows[0].count > 0) {
      const sampleAttachments = await pool.query(`
        SELECT id, filename, "originalName", "mimeType", "fileSize", "filePath", "caseId", case_id, "createdAt"
        FROM attachments 
        ORDER BY "createdAt" DESC 
        LIMIT 5
      `);
      console.log('Sample attachments:');
      console.table(sampleAttachments.rows);
    }
    
    // 3. Check verification_attachments table
    console.log('\n3. VERIFICATION_ATTACHMENTS TABLE:');
    const verificationCount = await pool.query('SELECT COUNT(*) as count FROM verification_attachments');
    console.log(`Total verification attachments: ${verificationCount.rows[0].count}`);
    
    if (verificationCount.rows[0].count > 0) {
      const sampleVerification = await pool.query(`
        SELECT id, filename, "originalName", "mimeType", "fileSize", "filePath", "caseId", case_id, verification_type, "createdAt"
        FROM verification_attachments 
        ORDER BY "createdAt" DESC 
        LIMIT 5
      `);
      console.log('Sample verification attachments:');
      console.table(sampleVerification.rows);
    }
    
    // 4. Check cases table for recent cases
    console.log('\n4. RECENT CASES:');
    const recentCases = await pool.query(`
      SELECT id, "caseId", "customerName", status, "createdAt"
      FROM cases 
      ORDER BY "createdAt" DESC 
      LIMIT 5
    `);
    console.table(recentCases.rows);
    
    // 5. Check for orphaned attachments
    console.log('\n5. ATTACHMENT-CASE RELATIONSHIP CHECK:');
    const orphanedAttachments = await pool.query(`
      SELECT a.id, a.filename, a."caseId", a.case_id
      FROM attachments a
      LEFT JOIN cases c ON c.id = a.case_id
      WHERE c.id IS NULL
      LIMIT 5
    `);
    
    if (orphanedAttachments.rows.length > 0) {
      console.log('⚠️  Found orphaned attachments:');
      console.table(orphanedAttachments.rows);
    } else {
      console.log('✅ No orphaned attachments found');
    }
    
    // 6. Check mobile API endpoint compatibility
    console.log('\n6. MOBILE API COMPATIBILITY CHECK:');
    const mobileQuery = await pool.query(`
      SELECT 
        a.id, a.filename, a."originalName", a."mimeType", a."fileSize", a."filePath", a."createdAt",
        c."caseId", c.id as case_uuid
      FROM attachments a
      JOIN cases c ON c.id = a.case_id
      LIMIT 3
    `);
    
    if (mobileQuery.rows.length > 0) {
      console.log('Mobile API format sample:');
      console.table(mobileQuery.rows);
    } else {
      console.log('❌ No attachments with proper case relationships found');
    }
    
    // 7. Check applicant type constraint
    console.log('\n7. APPLICANT TYPE CONSTRAINT CHECK:');
    const constraintCheck = await pool.query(`
      SELECT constraint_name, check_clause
      FROM information_schema.check_constraints
      WHERE constraint_name = 'chk_cases_applicant_type'
    `);

    if (constraintCheck.rows.length > 0) {
      console.log('Applicant type constraint:');
      console.table(constraintCheck.rows);
    } else {
      console.log('No applicant type constraint found');
    }

    console.log('\n🎯 AUDIT COMPLETE');
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  } finally {
    await pool.end();
  }
}

debugAttachments();
