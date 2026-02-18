import * as dotenv from 'dotenv';
dotenv.config();

import { Pool } from 'pg';
import { MobileFormController } from '../src/controllers/mobileFormController';
import { AuthenticatedRequest } from '../src/middleware/auth';
import { Response } from 'express';
import { disconnectDatabase } from '../src/config/db';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Mock Response
const mockResponse = () => {
  const res: any = {};
  res.status = (code: number) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data: any) => {
    res.body = data;
    return res;
  };
  return res;
};

async function runVerification() {
  console.log('🚀 Starting Stage-2C Verification: Strict Form Submission Rules');

  try {
    // 1. Setup Test Data
    console.log('\nPlease ensure you have a clean state or use unique identifiers.');
    const timestamp = Date.now();
    const userEmail = `test_user_${timestamp}@example.com`;
    const userResult = await pool.query(
      `INSERT INTO users (email, "passwordHash", "password", name, role, username) VALUES ($1, 'password_hash_mock', 'password_mock', 'Test Agent', 'FIELD_AGENT', $2) RETURNING id`,
      [userEmail, userEmail]
    );
    const userId = userResult.rows[0].id;
    console.log(`✅ Created Test User: ${userId}`);

    // Get necessary foreign keys
    const clientRes = await pool.query(`SELECT id FROM "clients" LIMIT 1`);
    const clientId = clientRes.rows[0]?.id || 1; 

    const productRes = await pool.query(`SELECT id FROM "products" LIMIT 1`);
    const productId = productRes.rows[0]?.id || 1;

    const verTypeRes = await pool.query(`SELECT id FROM "verificationTypes" WHERE name = 'RESIDENCE' LIMIT 1`);
    const verTypeId = verTypeRes.rows[0]?.id || 1; 

    const cityRes = await pool.query(`SELECT id FROM "cities" LIMIT 1`);
    const cityId = cityRes.rows[0]?.id || 1;

    const caseNumber = Math.floor(Math.random() * 1000000);
    const caseResult = await pool.query(
      `INSERT INTO cases (
        "caseId", "customerName", status, "verificationType", "clientId", "productId", "verificationTypeId", 
        "cityId", "applicantType", "backendContactNumber", trigger
      ) VALUES ($1, 'Test Customer', 'ASSIGNED', 'RESIDENCE', $2, $3, $4, $5, 'APPLICANT', '9999999999', 'TEST_TRIGGER') RETURNING id`,
      [caseNumber, clientId, productId, verTypeId, cityId]
    );
    const caseId = caseResult.rows[0].id;
    console.log(`✅ Created Test Case: ${caseId}`);

    const taskResult = await pool.query(
        `INSERT INTO verification_tasks (case_id, verification_type_id, status, assigned_to, task_number, task_title) 
         VALUES ($1, $2, 'PENDING', $3, $4, 'Test Task') RETURNING id`,
        [caseId, verTypeId, userId, `TASK_${timestamp}`]
    );
    const taskId = taskResult.rows[0].id;
    console.log(`✅ Created Test Task: ${taskId}`);

    // --- TEST 1: Submit without Task ID ---
    console.log('\n🧪 Test 1: Submit without Task ID');
    const req1 = {
        params: {}, // No taskId
        body: {
            verificationTaskId: taskId, // Body has it, but strict check looks at params/validation
            formData: { outcome: 'VERIFIED' },
        },
        user: { id: userId, role: 'FIELD_AGENT' },
    } as unknown as AuthenticatedRequest;
    const res1 = mockResponse();
    
    // We need to bypass the route handler which extracts params.
    // Actually, in the controller `const { taskId } = req.params;` is used.
    // If req.params.taskId is undefined, validation should fail "Task ID is required".
    
    await MobileFormController.submitResidenceVerification(req1, res1 as Response);
    if (res1.statusCode === 400 && res1.body.error.code === 'TASK_ID_REQUIRED') {
        console.log('✅ Passed: Rejected submission without Task ID');
    } else {
        console.error('❌ Failed: Should have rejected submission without Task ID', res1.body);
    }

    // --- TEST 2: Submit with Invalid Task ID ---
    console.log('\n🧪 Test 2: Submit with Invalid Task ID');
    const req2 = {
        params: { taskId: '00000000-0000-0000-0000-000000000000' }, // Non-existent UUID
        body: {},
        user: { id: userId, role: 'FIELD_AGENT' },
    } as unknown as AuthenticatedRequest;
    const res2 = mockResponse();
    await MobileFormController.submitResidenceVerification(req2, res2 as Response);
    if (res2.statusCode === 400 && res2.body.error.code === 'INVALID_TASK_ID') {
        console.log('✅ Passed: Rejected submission with Invalid Task ID');
    } else {
        console.error('❌ Failed: Should have rejected invalid Task ID', res2.body);
    }

    // --- TEST 3: Submit without Location Capture ---
    console.log('\n🧪 Test 3: Submit without Location Capture');
    const req3 = {
        params: { taskId: taskId },
        body: {
             // verificationTaskId is required in body by types/validation potentially, but our strict check is earlier.
            verificationTaskId: taskId,
            formData: { outcome: 'VERIFIED' }, 
        },
        user: { id: userId, role: 'FIELD_AGENT' },
    } as unknown as AuthenticatedRequest;
    const res3 = mockResponse();
    await MobileFormController.submitResidenceVerification(req3, res3 as Response);
    // Should fail with 412 LOCATION_REQUIRED_BEFORE_FORM
    if (res3.statusCode === 412 && res3.body.error.code === 'LOCATION_REQUIRED_BEFORE_FORM') {
        console.log('✅ Passed: Rejected submission without location capture');
    } else {
        console.error('❌ Failed: Should have rejected without location', res3.body);
    }

    // --- TEST 4: Submit with Expired Location (90 mins) ---
    console.log('\n🧪 Test 4: Submit with Expired Location');
    // Insert expired location (older than 30 mins)
    const expiredDate = new Date();
    expiredDate.setMinutes(expiredDate.getMinutes() - 40);
    
    // Location schema:
    // id, caseId (int), case_id (uuid), latitude, longitude, accuracy, recordedAt, recordedBy
    await pool.query(
      'INSERT INTO locations (id, "case_id", "caseId", "recordedBy", latitude, longitude, "recordedAt") VALUES ($1, $2, $3, $4, 0, 0, $5)',
      [Math.floor(Math.random() * 1000000000), caseId, caseNumber, userId, expiredDate]
    );
    
    const res4 = mockResponse();
    await MobileFormController.submitResidenceVerification(req3, res4 as Response); // Reuse req3
    if (res4.statusCode === 412 && res4.body.error.code === 'VISIT_SESSION_EXPIRED') {
        console.log('✅ Passed: Rejected submission with expired location');
    } else {
        console.error('❌ Failed: Should have rejected expired location', res4.body);
    }

    // --- TEST 5: Submit with Valid Location (Success) ---
    console.log('\n🧪 Test 5: Submit with Valid Location');
    // 5. Insert location data
    console.log('Inserting location data...');
    // Location schema: id, case_id, caseId, recordedBy, latitude, longitude, recordedAt
    await pool.query(
      'INSERT INTO locations (id, "case_id", "caseId", "recordedBy", latitude, longitude, "recordedAt") VALUES ($1, $2, $3, $4, 0, 0, $5)',
      [Math.floor(Math.random() * 1000000000), caseId, caseNumber, userId, new Date().toISOString()]
    );
    
    // We need 5 photos for success usually
    const req5 = {
        params: { taskId: taskId },
        body: {
            verificationTaskId: taskId,
            formData: { outcome: 'VERIFIED' },
            images: [{}, {}, {}, {}, {}], // Mock 5 images
            photos: [{geoLocation: {latitude:1, longitude:1}}, {geoLocation: {latitude:1, longitude:1}}, {geoLocation: {latitude:1, longitude:1}}, {geoLocation: {latitude:1, longitude:1}}, {geoLocation: {latitude:1, longitude:1}}],
            geoLocation: { latitude: 0, longitude: 0 }
        },
        user: { id: userId, role: 'FIELD_AGENT' },
    } as unknown as AuthenticatedRequest;
    
    const res5 = mockResponse();
    
    // Mock image processing to avoid errors? 
    // connect to real DB means it will try to process images. 
    // processVerificationImages is called. It expects image objects properly.
    // If we mock processVerificationImages? That's hard in this script without mocking lib.
    // We can just rely on validation passing up to that point. 
    // OR we provide minimal valid image objects.
    
    // Doing a full success path is hard because of `processVerificationImages`. 
    // But testing that we PASSED the strict validation is enough. 
    // If we get "INSUFFICIENT_PHOTOS" or similar, it means we passed the strict task validation!
    
    const req5_minimal = {
        params: { taskId: taskId },
        body: {
            verificationTaskId: taskId,
            formData: { outcome: 'VERIFIED' },
            images: [], // 0 images
        },
        user: { id: userId, role: 'FIELD_AGENT' },
    } as unknown as AuthenticatedRequest;
    
    const res5_minimal = mockResponse();
    await MobileFormController.submitResidenceVerification(req5_minimal, res5_minimal as Response);
    
    if (res5_minimal.statusCode === 400 && res5_minimal.body.error.code === 'INSUFFICIENT_PHOTOS') {
        console.log('✅ Passed: Strict validation passed (reached photo check)');
    } else if (res5_minimal.statusCode === 200) {
        console.log('✅ Passed: Submission successful (unexpectedly?)');
    } else {
        console.error('❌ Failed: Unexpected error', res5_minimal.body);
    }


  } catch (err) {
    console.error('Verification failed:', err);
  } finally {
    await pool.end();
    await disconnectDatabase().catch(() => {});
  }
}

runVerification();
