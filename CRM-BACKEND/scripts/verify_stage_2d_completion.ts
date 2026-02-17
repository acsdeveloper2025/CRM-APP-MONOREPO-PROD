
import * as dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
dotenv.config();

// Load environment variables before other imports
import { pool, disconnectDatabase } from '../src/config/db';
import { VerificationTasksController } from '../src/controllers/verificationTasksController';
import { AuthenticatedRequest } from '../src/middleware/auth';
import { Response } from 'express';

const mockResponse = () => {
    const res: any = { statusCode: 200 };
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
    console.log('🚀 Starting Stage-2D Verification: Strict Task Completion Rules');

    try {
        // --- SETUP DATA ---
        const timestamp = Date.now();
        const userEmail = `test_agent_${timestamp}@example.com`;
        
        // 1. Create User
        const userResult = await pool.query(
            `INSERT INTO users (email, "passwordHash", "password", name, role, username) 
             VALUES ($1, 'hash', 'pass', 'Test Agent', 'FIELD_AGENT', $2) RETURNING id`,
            [userEmail, userEmail]
        );
        const userId = userResult.rows[0].id;
        console.log(`✅ Created User: ${userId}`);

        // 2. Fetch existing IDs to satisfy FK constraints
        const clientQuery = await pool.query("SELECT id FROM clients ORDER BY \"createdAt\" DESC LIMIT 1");
        const productQuery = await pool.query("SELECT id FROM products ORDER BY \"createdAt\" DESC LIMIT 1");
        const vtQuery = await pool.query("SELECT id FROM \"verificationTypes\" LIMIT 1");

        if (clientQuery.rows.length === 0 || productQuery.rows.length === 0 || vtQuery.rows.length === 0) {
            throw new Error('Database must have at least one client, product, and verificationType to run this test.');
        }

        const clientId = clientQuery.rows[0].id;
        const productId = productQuery.rows[0].id;
        const verificationTypeId = vtQuery.rows[0].id;

        // 3. Create Case
        const caseResult = await pool.query(
            `INSERT INTO cases (
                "clientId", "productId", "verificationTypeId", "caseId", 
                "customerName", "applicantType", "backendContactNumber", "trigger",
                status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'IN_PROGRESS') RETURNING id`,
            [
                clientId, productId, verificationTypeId, timestamp % 1000000,
                'John Doe', 'APPLICANT', '1234567890', 'MANUAL'
            ]
        );
        const caseId = caseResult.rows[0].id;
        console.log(`✅ Created Case: ${caseId}`);

        // 4. Create Task (PENDING by default)
        const taskResult = await pool.query(
            `INSERT INTO verification_tasks (case_id, verification_type_id, task_title, status, assigned_to, task_number) 
             VALUES ($1, $2, 'Residence Verification', 'PENDING', $3, $4) RETURNING id`,
            [caseId, verificationTypeId, userId, `T-${timestamp}`]
        );
        const taskId = taskResult.rows[0].id;
        console.log(`✅ Created Task: ${taskId}`);

        // --- TEST SCENARIOS ---

        const runComplete = async (reqUserId: string, tId: string) => {
            const req = {
                params: { taskId: tId },
                body: { verificationOutcome: 'POSITIVE' },
                user: { id: reqUserId, role: 'FIELD_AGENT' },
            } as unknown as AuthenticatedRequest;
            const res = mockResponse();
            await VerificationTasksController.completeTask(req, res as Response);
            return res;
        };

        // 1. Test Assignment (Wrong User)
        console.log('\nTest 1: Wrong User Assignment...');
        const res1 = await runComplete(uuidv4(), taskId);
        if (res1.statusCode === 403 && res1.body.error.code === 'ONLY_ASSIGNED_AGENT_CAN_COMPLETE_TASK') {
            console.log('✅ Passed: Rejection for wrong user');
        } else {
            console.error('❌ Failed: Wrong user test', res1.statusCode, res1.body);
        }

        // 2. Test State (Task is PENDING)
        console.log('\nTest 2: Task State (PENDING)...');
        const res2 = await runComplete(userId, taskId);
        if (res2.statusCode === 409 && res2.body.error.code === 'TASK_NOT_IN_PROGRESS') {
            console.log('✅ Passed: Rejection for PENDING status');
        } else {
            console.error('❌ Failed: Task state test', res2.statusCode, res2.body);
        }

        // 3. Set Task to IN_PROGRESS
        await pool.query("UPDATE verification_tasks SET status = 'IN_PROGRESS' WHERE id = $1", [taskId]);
        console.log('Task state updated to IN_PROGRESS');

        // 4. Test Evidence: Location Missing
        console.log('\nTest 3: Evidence (Location Missing)...');
        const res3 = await runComplete(userId, taskId);
        if (res3.statusCode === 412 && res3.body.error.code === 'VISIT_LOCATION_MISSING') {
            console.log('✅ Passed: Rejection for missing location');
        } else {
            console.error('❌ Failed: Location missing test', res3.statusCode, res3.body);
        }

        // 5. Insert Location
        await pool.query(
            `INSERT INTO locations (verification_task_id, case_id, "caseId", latitude, longitude, "recordedAt", "recordedBy") 
             VALUES ($1, $2, $3, 0, 0, NOW(), $4)`,
            [taskId, caseId, timestamp % 1000000, userId]
        );
        console.log('Location inserted');

        // 6. Test Evidence: Photos Missing (< 5)
        console.log('\nTest 4: Evidence (Photos < 5)...');
        const res4 = await runComplete(userId, taskId);
        if (res4.statusCode === 412 && res4.body.error.code === 'INSUFFICIENT_PHOTO_EVIDENCE') {
            console.log('✅ Passed: Rejection for insufficient photos');
        } else {
            console.error('❌ Failed: Photos missing test', res4.statusCode, res4.body);
        }

        // 7. Insert 5 Photos
        for (let i = 0; i < 5; i++) {
            await pool.query(
                `INSERT INTO verification_attachments (
                    case_id, "caseId", verification_task_id, 
                    "filePath", "mimeType", "uploadedBy", "fileSize",
                    verification_type, filename, "originalName"
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                [
                    caseId, timestamp % 1000000, taskId,
                    `path/to/img_${i}.jpg`, 'image/jpeg', userId, 1024,
                    'RESIDENCE', `img_${i}.jpg`, `img_${i}.jpg`
                ]
            );
        }
        console.log('5 photos inserted');

        // 8. Test Evidence: Form Missing
        console.log('\nTest 5: Evidence (Form Missing)...');
        const res5 = await runComplete(userId, taskId);
        if (res5.statusCode === 412 && res5.body.error.code === 'VERIFICATION_FORM_MISSING') {
            console.log('✅ Passed: Rejection for missing form');
        } else {
            console.error('❌ Failed: Form missing test', res5.statusCode, res5.body);
        }

        // 9. Insert Form Submission
        await pool.query(
            `INSERT INTO task_form_submissions (id, verification_task_id, case_id, form_submission_id, form_type, submitted_by, submitted_at) 
             VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
            [uuidv4(), taskId, caseId, uuidv4(), 'RESIDENCE', userId]
        );
        console.log('Form submission inserted');

        // 10. Valid Completion
        console.log('\nTest 6: Valid Completion...');
        const res6 = await runComplete(userId, taskId);
        if (res6.statusCode === 200 && res6.body.success === true) {
            console.log('✅ Passed: Task completed successfully');
            
            // Verify DB status
            const finalTask = await pool.query("SELECT status, completed_at FROM verification_tasks WHERE id = $1", [taskId]);
            if (finalTask.rows[0].status === 'COMPLETED' && finalTask.rows[0].completed_at !== null) {
                console.log('✅ DB Verification: Status is COMPLETED');
            } else {
                console.error('❌ DB Verification Failed', finalTask.rows[0]);
            }
        } else {
            console.error('❌ Failed: Valid completion test', res6.statusCode, res6.body);
        }

        // 11. Test Time Sequence (Form BEFORE Location)
        console.log('\nTest 7: Time Sequence (Form < Location)...');
        // Create new task for this
        const task2Result = await pool.query(
            `INSERT INTO verification_tasks (case_id, verification_type_id, task_title, status, assigned_to, task_number) 
             VALUES ($1, $2, 'Business Verification', 'IN_PROGRESS', $3, $4) RETURNING id`,
            [caseId, verificationTypeId, userId, `T2-${timestamp}`]
        );
        const taskId2 = task2Result.rows[0].id;

        // Insert Location with FUTURE timestamp
        await pool.query(
            `INSERT INTO locations (verification_task_id, case_id, "caseId", latitude, longitude, "recordedAt", "recordedBy") 
             VALUES ($1, $2, $3, 0, 0, NOW() + interval '1 hour', $4)`,
            [taskId2, caseId, timestamp % 1000000, userId]
        );
        
        // Insert 5 photos
        for (let i = 0; i < 5; i++) {
            await pool.query(
                `INSERT INTO verification_attachments (
                    case_id, "caseId", verification_task_id, 
                    "filePath", "mimeType", "uploadedBy", "fileSize",
                    verification_type, filename, "originalName"
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                [
                    caseId, timestamp % 1000000, taskId2,
                    `path/to/img2_${i}.jpg`, 'image/jpeg', userId, 1024,
                    'BUSINESS', `img2_${i}.jpg`, `img2_${i}.jpg`
                ]
            );
        }

        // Insert Form with CURRENT timestamp (which is BEFORE the location above)
        await pool.query(
            `INSERT INTO task_form_submissions (id, verification_task_id, case_id, form_submission_id, form_type, submitted_by, submitted_at) 
             VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
            [uuidv4(), taskId2, caseId, uuidv4(), 'BUSINESS', userId]
        );

        const res7 = await runComplete(userId, taskId2);
        if (res7.statusCode === 412 && res7.body.error.code === 'INVALID_EVIDENCE_SEQUENCE') {
            console.log('✅ Passed: Rejection for invalid time sequence');
        } else {
            console.error('❌ Failed: Time sequence test', res7.statusCode, res7.body);
        }

    } catch (err) {
        console.error('Verification failed with error:', err);
    } finally {
        await disconnectDatabase().catch(() => {});
    }
}

runVerification();
