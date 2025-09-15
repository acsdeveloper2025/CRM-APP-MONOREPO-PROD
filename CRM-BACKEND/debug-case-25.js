const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function debugCase25() {
  try {
    console.log('🔍 CASE #25 ATTACHMENT ANALYSIS');
    console.log('===============================');
    
    // 1. Get case #25 details
    console.log('\n1. CASE #25 DETAILS:');
    const caseDetails = await pool.query(`
      SELECT id, "caseId", "customerName", status, "createdAt", "updatedAt"
      FROM cases 
      WHERE "caseId" = 25
    `);
    
    if (caseDetails.rows.length === 0) {
      console.log('❌ Case #25 not found');
      return;
    }
    
    const case25 = caseDetails.rows[0];
    console.table([case25]);
    
    // 2. Get all attachments for case #25
    console.log('\n2. ALL ATTACHMENTS FOR CASE #25:');
    const attachments = await pool.query(`
      SELECT 
        id, filename, "originalName", "mimeType", "fileSize", "filePath", 
        "caseId", case_id, "uploadedBy", "createdAt"
      FROM attachments 
      WHERE "caseId" = 25 OR case_id = $1
      ORDER BY "createdAt" DESC
    `, [case25.id]);
    
    console.log(`Found ${attachments.rows.length} attachments:`);
    if (attachments.rows.length > 0) {
      console.table(attachments.rows);
    } else {
      console.log('❌ No attachments found for case #25');
    }
    
    // 3. Check verification_attachments table
    console.log('\n3. VERIFICATION ATTACHMENTS FOR CASE #25:');
    const verificationAttachments = await pool.query(`
      SELECT 
        id, filename, "originalName", "mimeType", "fileSize", "filePath", 
        "caseId", case_id, verification_type, "createdAt"
      FROM verification_attachments 
      WHERE "caseId" = 25 OR case_id = $1
      ORDER BY "createdAt" DESC
    `, [case25.id]);
    
    console.log(`Found ${verificationAttachments.rows.length} verification attachments:`);
    if (verificationAttachments.rows.length > 0) {
      console.table(verificationAttachments.rows);
    } else {
      console.log('❌ No verification attachments found for case #25');
    }
    
    // 4. Test mobile API for case #25
    console.log('\n4. MOBILE API TEST FOR CASE #25:');
    const mobileApiTest = await pool.query(`
      SELECT 
        a.id, a.filename, a."originalName", a."mimeType", a."fileSize", a."filePath", a."createdAt",
        c."caseId", c.id as case_uuid
      FROM attachments a
      JOIN cases c ON c.id = a.case_id
      WHERE c."caseId" = 25
      ORDER BY a."createdAt" DESC
    `);
    
    console.log(`Mobile API compatible attachments: ${mobileApiTest.rows.length}`);
    if (mobileApiTest.rows.length > 0) {
      console.table(mobileApiTest.rows);
    }
    
    // 5. Check file system for case #25 attachments
    console.log('\n5. FILE SYSTEM CHECK:');
    const fs = require('fs');
    const path = require('path');
    
    const case25Dir = path.join(process.cwd(), 'uploads', 'attachments', 'case_25');
    console.log(`Checking directory: ${case25Dir}`);
    
    if (fs.existsSync(case25Dir)) {
      const files = fs.readdirSync(case25Dir);
      console.log(`Files in case_25 directory: ${files.length}`);
      files.forEach((file, index) => {
        const filePath = path.join(case25Dir, file);
        const stats = fs.statSync(filePath);
        console.log(`${index + 1}. ${file} (${stats.size} bytes, modified: ${stats.mtime})`);
      });
    } else {
      console.log('❌ Case #25 attachment directory does not exist');
    }
    
    // 6. Check mobile uploads directory
    const mobileDir = path.join(process.cwd(), 'uploads', 'mobile');
    console.log(`\nChecking mobile directory: ${mobileDir}`);
    
    if (fs.existsSync(mobileDir)) {
      const mobileFiles = fs.readdirSync(mobileDir);
      console.log(`Files in mobile directory: ${mobileFiles.length}`);
      
      // Look for files that might be related to case 25
      const case25Files = mobileFiles.filter(file => 
        file.includes('25') || file.includes(case25.id.substring(0, 8))
      );
      
      if (case25Files.length > 0) {
        console.log('Potential case #25 files in mobile directory:');
        case25Files.forEach(file => {
          const filePath = path.join(mobileDir, file);
          const stats = fs.statSync(filePath);
          console.log(`- ${file} (${stats.size} bytes, modified: ${stats.mtime})`);
        });
      }
    } else {
      console.log('❌ Mobile uploads directory does not exist');
    }
    
    console.log('\n🎯 ANALYSIS COMPLETE');
    
  } catch (error) {
    console.error('❌ Analysis failed:', error);
  } finally {
    await pool.end();
  }
}

debugCase25();
