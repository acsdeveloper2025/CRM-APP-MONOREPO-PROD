const { Pool } = require('pg');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function debugCase24() {
  try {
    console.log('🔍 CASE #24 ATTACHMENT ANALYSIS');
    console.log('===============================');
    
    // 1. Get case #24 details
    console.log('\n1. CASE #24 DETAILS:');
    const caseDetails = await pool.query(`
      SELECT id, "caseId", "customerName", status, "createdAt", "updatedAt"
      FROM cases 
      WHERE "caseId" = 24
    `);
    
    if (caseDetails.rows.length === 0) {
      console.log('❌ Case #24 not found');
      return;
    }
    
    const case24 = caseDetails.rows[0];
    console.table([case24]);
    
    // 2. Get all attachments for case #24
    console.log('\n2. ALL ATTACHMENTS FOR CASE #24:');
    const attachments = await pool.query(`
      SELECT 
        id, filename, "originalName", "mimeType", "fileSize", "filePath", 
        "caseId", case_id, "uploadedBy", "createdAt"
      FROM attachments 
      WHERE "caseId" = 24 OR case_id = $1
      ORDER BY "createdAt" DESC
    `, [case24.id]);
    
    console.log(`Found ${attachments.rows.length} attachments:`);
    if (attachments.rows.length > 0) {
      console.table(attachments.rows);
    } else {
      console.log('❌ No attachments found for case #24');
    }
    
    // 3. Check attachment file paths and existence
    console.log('\n3. ATTACHMENT FILE EXISTENCE CHECK:');
    const fs = require('fs');
    const path = require('path');
    
    for (const attachment of attachments.rows) {
      const fullPath = path.join(process.cwd(), attachment.filePath);
      const exists = fs.existsSync(fullPath);
      console.log(`${exists ? '✅' : '❌'} ${attachment.originalName}: ${fullPath}`);
      
      if (exists) {
        const stats = fs.statSync(fullPath);
        console.log(`   Size: ${stats.size} bytes (DB: ${attachment.fileSize})`);
        console.log(`   Modified: ${stats.mtime}`);
      }
    }
    
    // 4. Test mobile API for case #24
    console.log('\n4. MOBILE API TEST FOR CASE #24:');
    const mobileApiTest = await pool.query(`
      SELECT 
        a.id, a.filename, a."originalName", a."mimeType", a."fileSize", a."filePath", a."createdAt",
        c."caseId", c.id as case_uuid
      FROM attachments a
      JOIN cases c ON c.id = a.case_id
      WHERE c."caseId" = 24
      ORDER BY a."createdAt" DESC
    `);
    
    console.log(`Mobile API compatible attachments: ${mobileApiTest.rows.length}`);
    if (mobileApiTest.rows.length > 0) {
      console.table(mobileApiTest.rows);
    }
    
    // 5. Check file system for case #24 attachments
    console.log('\n5. FILE SYSTEM CHECK:');
    const case24Dir = path.join(process.cwd(), 'uploads', 'attachments', 'case_24');
    console.log(`Checking directory: ${case24Dir}`);
    
    if (fs.existsSync(case24Dir)) {
      const files = fs.readdirSync(case24Dir);
      console.log(`Files in case_24 directory: ${files.length}`);
      files.forEach((file, index) => {
        const filePath = path.join(case24Dir, file);
        const stats = fs.statSync(filePath);
        console.log(`${index + 1}. ${file} (${stats.size} bytes, modified: ${stats.mtime})`);
      });
    } else {
      console.log('❌ Case #24 attachment directory does not exist');
    }
    
    // 6. Check mobile uploads directory
    console.log('\n6. MOBILE UPLOADS DIRECTORY CHECK:');
    const mobileDir = path.join(process.cwd(), 'uploads', 'mobile');
    console.log(`Checking mobile directory: ${mobileDir}`);
    
    if (fs.existsSync(mobileDir)) {
      const mobileFiles = fs.readdirSync(mobileDir);
      console.log(`Files in mobile directory: ${mobileFiles.length}`);
      
      // Look for files that might be related to case 24
      const case24Files = mobileFiles.filter(file => 
        file.includes('24') || file.includes(case24.id.substring(0, 8))
      );
      
      if (case24Files.length > 0) {
        console.log('Potential case #24 files in mobile directory:');
        case24Files.forEach(file => {
          const filePath = path.join(mobileDir, file);
          const stats = fs.statSync(filePath);
          console.log(`- ${file} (${stats.size} bytes, modified: ${stats.mtime})`);
        });
      }
    } else {
      console.log('❌ Mobile uploads directory does not exist');
    }
    
    // 7. Test attachment download URLs
    console.log('\n7. ATTACHMENT DOWNLOAD URL TEST:');
    for (const attachment of attachments.rows) {
      const downloadUrl = `${process.env.API_BASE_URL || 'http://localhost:3000'}/api/attachments/${attachment.id}/download`;
      console.log(`📎 ${attachment.originalName}: ${downloadUrl}`);
    }
    
    // 8. Check for any error logs related to case 24
    console.log('\n8. RECENT ERROR LOGS CHECK:');
    const errorLogs = await pool.query(`
      SELECT * FROM error_logs 
      WHERE message ILIKE '%case%24%' OR message ILIKE '%attachment%' 
      ORDER BY created_at DESC 
      LIMIT 10
    `).catch(() => ({ rows: [] }));
    
    if (errorLogs.rows.length > 0) {
      console.log('Recent error logs:');
      console.table(errorLogs.rows);
    } else {
      console.log('No recent error logs found for case 24');
    }
    
    console.log('\n🎯 ANALYSIS COMPLETE');
    
  } catch (error) {
    console.error('❌ Debug script error:', error);
  } finally {
    await pool.end();
  }
}

debugCase24();
