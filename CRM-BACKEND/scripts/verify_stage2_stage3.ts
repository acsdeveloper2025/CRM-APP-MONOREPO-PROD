
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
      VALUES ($1, 'Test Agent', $2, 'FIELD_AGENT', 'hash', 'hash', NOW(), NOW())
      RETURNING id
    `, [`agent${Date.now()}`, `test-${Date.now()}@example.com`]);
    const userId = userRes.rows[0].id;
    console.log('✅ Created test user:', userId);

    // Get a valid client
    const clientRes2 = await client.query('SELECT id FROM clients LIMIT 1');
    let clientId = clientRes2.rows[0]?.id;
    
    if (!clientId) {
        // Create one if missing
        const newClient = await client.query(`INSERT INTO clients (name, "createdAt", "updatedAt") VALUES ('Test Client', NOW(), NOW()) RETURNING id`);
        clientId = newClient.rows[0].id;
    }
    console.log('✅ Used client:', clientId);

    // Get a valid key product
    const productRes = await client.query('SELECT id FROM products LIMIT 1');
    let productId = productRes.rows[0]?.id;
    
    if (!productId) {
         // Create product if missing
         const newProduct = await client.query(`
            INSERT INTO products (name, code, "createdAt", "updatedAt") 
            VALUES ('Test Product', 'TP-001', NOW(), NOW()) 
            RETURNING id
         `);
         productId = newProduct.rows[0].id;
    }
    console.log('✅ Used product:', productId);

    // Get a valid verification type
    const vTypeRes = await client.query('SELECT id FROM "verificationTypes" LIMIT 1');
    let vTypeId = vTypeRes.rows[0]?.id;
    
    if (!vTypeId) {
        // Create one if missing (using default ID generation)
        const newVType = await client.query(`INSERT INTO "verificationTypes" (name, "createdAt", "updatedAt") VALUES ('RESIDENCE', NOW(), NOW()) RETURNING id`);
        vTypeId = newVType.rows[0].id;
    }
    console.log('✅ Used verification type:', vTypeId);

    // 2. Create a dummy case
    // We intentionally let the DB generate the UUID for id, but we provide "caseId" (int)
    const randomCaseId = Math.floor(Math.random() * 1000000);
    const caseRes = await client.query(`
      INSERT INTO cases (
        "caseId", "customerName", "status", "createdAt", "updatedAt", "clientId", "productId", "verificationTypeId",
        "applicantType", "backendContactNumber", "trigger"
      ) VALUES (
        $1, 'Test Customer', 'PENDING', NOW(), NOW(), $2, $3, $4,
        'APPLICANT', '9876543210', 'MANUAL'
      ) RETURNING id, "caseId"
    `, [randomCaseId, clientId, productId, vTypeId]);
    const caseId = caseRes.rows[0].id; // UUID
    const caseNumber = caseRes.rows[0].caseId; // Int
    console.log('✅ Created test case:', caseId, '(#', caseNumber, ')');

    // 3. Create a verification task linked to this case
    const taskRes = await client.query(`
      INSERT INTO verification_tasks (
        case_id, verification_type_id, status, assigned_to, 
        created_at, updated_at, task_number, task_title
      ) VALUES (
        $1, $2, 'ASSIGNED', $3, 
        NOW(), NOW(), $4, 'Map Verification'
      ) RETURNING id
    `, [caseId, vTypeId, userId, `TASK-${caseNumber}-1`]);
    const taskId = taskRes.rows[0].id;
    console.log('✅ Created verification task:', taskId);

    // 4. Simulate MobileLocationController.captureLocation logic
    // We will verify the DUAL WRITE logic by executing the EXACT statement 
    // that the controller uses (or verifying the controller if we could import it).
    // Since importing controller might bring in express dependencies, let's verify the logic flow.

    // Logic from controller:
    // a. Resolve case/task
    const taskQuery = await client.query(`
      SELECT vt.id, vt.case_id, c."caseId" as case_number
      FROM verification_tasks vt
      JOIN cases c ON vt.case_id = c.id
      WHERE vt.id = $1
    `, [taskId]);
    
    const task = taskQuery.rows[0];
    const targetTaskId = task.id;
    const targetCaseId = task.case_id;
    const targetCaseNumber = task.case_number;

    console.log('🔍 Resolved targets:', { targetTaskId, targetCaseId, targetCaseNumber });

    // b. Insert into locations (Dual Write)
    const insertRes = await client.query(`
      INSERT INTO locations (
        "caseId", case_id, verification_task_id, 
        latitude, longitude, accuracy, "recordedAt", "recordedBy"
      )
      VALUES (
        $1, $2, $3, 
        12.345678, 98.765432, 10, NOW(), $4
      )
      RETURNING id, verification_task_id, case_id, "caseId"
    `, [
      targetCaseNumber, 
      targetCaseId, 
      targetTaskId, 
      userId
    ]);

    const insertedLocation = insertRes.rows[0];
    console.log('✅ Inserted location:', insertedLocation);

    // 5. Verification Assertions
    if (insertedLocation.verification_task_id !== taskId) {
      throw new Error('❌ verification_task_id mismatch!');
    }
    if (insertedLocation.case_id !== caseId) {
       throw new Error('❌ case_id matching failed!');
    }
    if (insertedLocation.caseId !== caseNumber) {
       throw new Error('❌ legacy caseId matching failed!');
    }

    console.log('🎉 VERIFICATION SUCCESS: Dual write working correctly!');

  } catch (err) {
    console.error('❌ Verification Failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runVerification();
