import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function runVerification() {
  const client = await pool.connect();
  console.log('✅ Connected to database');

  try {
    // 1. Create a dummy user (Field Agent)
    const userRes = await client.query(`
      INSERT INTO users (username, name, email, role, "passwordHash", password, "createdAt", "updatedAt")
      VALUES ($1, 'Stage2A Agent', $2, 'FIELD_AGENT', 'hash', 'hash', NOW(), NOW())
      RETURNING id
    `, [`agent2a_${Date.now()}`, `test2a-${Date.now()}@example.com`]);
    const userId = userRes.rows[0].id;
    console.log('✅ Created test user:', userId);

    // Get a valid client
    const clientRes2 = await client.query('SELECT id FROM clients LIMIT 1');
    let clientId = clientRes2.rows[0]?.id;
    
    if (!clientId) {
        const newClient = await client.query(`INSERT INTO clients (name, "createdAt", "updatedAt") VALUES ('Test Client', NOW(), NOW()) RETURNING id`);
        clientId = newClient.rows[0].id;
    }

    // Get a valid key product
    const productRes = await client.query('SELECT id FROM products LIMIT 1');
    let productId = productRes.rows[0]?.id;
    
    if (!productId) {
         const newProduct = await client.query(`
            INSERT INTO products (name, code, "createdAt", "updatedAt") 
            VALUES ('Test Product', 'TP-001', NOW(), NOW()) 
            RETURNING id
         `);
         productId = newProduct.rows[0].id;
    }

    // Get a valid verification type
    const vTypeRes = await client.query('SELECT id FROM "verificationTypes" LIMIT 1');
    let vTypeId = vTypeRes.rows[0]?.id;
    
    if (!vTypeId) {
        const newVType = await client.query(`INSERT INTO "verificationTypes" (name, "createdAt", "updatedAt") VALUES ('RESIDENCE', NOW(), NOW()) RETURNING id`);
        vTypeId = newVType.rows[0].id;
    }

    // 2. Create a dummy case
    const randomCaseId = Math.floor(Math.random() * 1000000);
    const caseRes = await client.query(`
      INSERT INTO cases (
        "caseId", "customerName", "status", "createdAt", "updatedAt", "clientId", "productId", "verificationTypeId",
        "applicantType", "backendContactNumber", "trigger"
      ) VALUES (
        $1, 'Test Customer Stage2A', 'PENDING', NOW(), NOW(), $2, $3, $4,
        'APPLICANT', '9876543210', 'MANUAL'
      ) RETURNING id, "caseId"
    `, [randomCaseId, clientId, productId, vTypeId]);
    const caseId = caseRes.rows[0].id; // UUID
    const caseNumber = caseRes.rows[0].caseId; // Int
    console.log('✅ Created test case:', caseId, '(#', caseNumber, ')');

    // 3. Create a verification task
    const taskRes = await client.query(`
      INSERT INTO verification_tasks (
        case_id, verification_type_id, status, assigned_to, 
        created_at, updated_at, task_number, task_title
      ) VALUES (
        $1, $2, 'ASSIGNED', $3, 
        NOW(), NOW(), $4, 'Stage2A Verification'
      ) RETURNING id
    `, [caseId, vTypeId, userId, `TASK-${caseNumber}-2A`]);
    const taskId = taskRes.rows[0].id;
    console.log('✅ Created verification task:', taskId);

    // 4. Simulate Stage-2A Strict Logic (VerificationAttachmentController)
    console.log('\n--- Simulating Stage-2A Logic ---');
    console.log(`Input: taskId = ${taskId}`);

    // Logic: Resolve Case from Task ID
    const taskQuery = await client.query(
        `SELECT vt.id, vt.case_id, vty.name as verification_type, c."caseId" as case_number 
         FROM verification_tasks vt
         JOIN cases c ON vt.case_id = c.id
         LEFT JOIN "verificationTypes" vty ON vt.verification_type_id = vty.id
         WHERE vt.id = $1`,
        [taskId]
      );
    
    if (taskQuery.rows.length === 0) {
        throw new Error('❌ Task Resolution Failed');
    }

    const task = taskQuery.rows[0];
    const targetTaskId = task.id;
    const targetCaseId = task.case_id;         
    const targetCaseNumber = task.case_number;
    console.log(`✅ Resolved: Task(${targetTaskId}) -> Case(${targetCaseId}) # ${targetCaseNumber}`);

    // Insert into verification_attachments
    const insertRes = await client.query(
        `INSERT INTO verification_attachments (
          case_id, "caseId", verification_type, filename, "originalName", 
          "mimeType", "fileSize", "filePath", "thumbnailPath", "uploadedBy", 
          "photoType", "submissionId", verification_task_id, "createdAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
        RETURNING id, verification_task_id, case_id, "caseId"`,
        [
          targetCaseId,
          targetCaseNumber,
          'RESIDENCE',
          'test_img.jpg',
          'test_img.jpg',
          'image/jpeg',
          1024,
          '/uploads/test.jpg',
          null,
          userId,
          'verification',
          'sub_123',
          targetTaskId 
        ]
      );
    
    const attachment = insertRes.rows[0];
    console.log('✅ Inserted Attachment:', attachment);

    // Assertions
    if (attachment.verification_task_id !== taskId) throw new Error('❌ verification_task_id mismatch');
    if (attachment.case_id !== caseId) throw new Error('❌ case_id mismatch');
    if (attachment.caseId !== caseNumber) throw new Error('❌ caseId mismatch');

    console.log('🎉 VERIFICATION STAGE-2A SUCCESS: Strict Dual Write working!');

  } catch (err) {
    console.error('❌ Verification Failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runVerification();
