
import { pool } from '../../src/config/database';
import { randomUUID } from 'crypto';

async function simulateFieldOperations() {
  console.log('--- SIMULATING FIELD OPERATIONS ---');
  
  const client = await pool.connect();


  try {
    await client.query('BEGIN');

    // Fetch all verification tasks
    // We select created_at, status, assigned_to
    // We check timestamps: first_assigned_at, assigned_at, started_at
    const res = await client.query(`
      SELECT vt.id, vt.case_id, vt.status, vt.created_at, vt.assigned_to, 
             vt.first_assigned_at, vt.assigned_at
      FROM verification_tasks vt
    `);
    const tasks = res.rows;
    console.log(`Found ${tasks.length} tasks to process.`);

    let completedCount = 0;
    let inProgressCount = 0;
    let assignedCount = 0;

    for (const task of tasks) {
      const taskId = task.id;
      const caseId = task.case_id;
      const status = task.status;
      const createdAt = new Date(task.created_at);
      const assignedTo = task.assigned_to; 
      
      // Time helpers
      const addMinutes = (date: Date, min: number) => new Date(date.getTime() + min * 60000);
      const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1) + min);

      // Guard: If assigned_to is null but we need to assign, skip if no agent
      if (status !== 'PENDING' && !assignedTo) {
          console.log(`Skipping task ${taskId} (${status}) - No Agent assigned`);
          continue;
      }

      // 1. Ensure first_assigned_at exists
      let firstAssignedAtVal = task.first_assigned_at ? new Date(task.first_assigned_at) : null;
      if (!firstAssignedAtVal && status !== 'PENDING') {
          // If NULL: first_assigned_at = created_at + random 10–60 minutes
          const newFirst = addMinutes(createdAt, randomInt(10, 60));
          await client.query(`UPDATE verification_tasks SET first_assigned_at = $1 WHERE id = $2`, [newFirst, taskId]);
          firstAssignedAtVal = newFirst;

          // Also ensure assigned_at is set if null (current assignment)
          if (!task.assigned_at) {
              await client.query(`UPDATE verification_tasks SET assigned_at = $1 WHERE id = $2`, [newFirst, taskId]);
          }
      }

      // If still no assignment time (PENDING), skip mostly
      if (!firstAssignedAtVal && status === 'PENDING') continue;
      
      const refTime = firstAssignedAtVal!; // We know it exists for non-PENDING now

      // CASE 1: COMPLETED
      if (status === 'COMPLETED') {
        completedCount++;
        
        // 2. Ensure started_at exists
        // started_at = first_assigned_at + random 15–90 minutes
        // We check if it exists in DB? The prompt says "Ensure started_at exists".
        // We'll update it if NULL or just overwrite to be safe/consistent with simulation?
        // Let's check from DB or just update. "Update timestamps".
        // We'll update to verify chain consistency.
        const startedAt = addMinutes(refTime, randomInt(15, 90));
        await client.query(`UPDATE verification_tasks SET started_at = $1 WHERE id = $2`, [startedAt, taskId]);

        // 3. Location (GPS)
        const recordedAt = addMinutes(startedAt, randomInt(5, 20));
        const latitude = 19 + Math.random(); 
        const longitude = 72 + Math.random(); 
        
        // Removed serviceZoneId as it does not exist
        await client.query(`
            INSERT INTO locations (case_id, latitude, longitude, "recordedAt", "recordedBy")
            VALUES ($1, $2, $3, $4, $5)
        `, [caseId, latitude, longitude, recordedAt, assignedTo]);

        // 4. Form Submission
        // Added form_submission_id as it is required
        const submittedAt = addMinutes(recordedAt, randomInt(10, 30));
        await client.query(`
            INSERT INTO task_form_submissions (verification_task_id, case_id, submitted_at, form_type, submitted_by, form_submission_id)
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [taskId, caseId, submittedAt, 'residence_verification', assignedTo, randomUUID()]); 

        // 5. Ensure completed_at
        // completed_at = submitted_at + random 5–40 minutes
        const completedAt = addMinutes(submittedAt, randomInt(5, 40));
        await client.query(`
            UPDATE verification_tasks 
            SET completed_at = $1, updated_at = $1 
            WHERE id = $2
        `, [completedAt, taskId]);
        
        // 6. Insert assignment history
        // created_at = first_assigned_at
        const histCheck = await client.query('SELECT 1 FROM task_assignment_history WHERE verification_task_id = $1', [taskId]);
        if (histCheck.rowCount === 0) {
            await client.query(`
                INSERT INTO task_assignment_history (verification_task_id, case_id, assigned_to, assigned_by, assignment_reason, task_status_before, task_status_after, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [taskId, caseId, assignedTo, assignedTo, 'System Simulation', 'PENDING', 'ASSIGNED', refTime]); 
        }

      } 
      
      // CASE 2: IN_PROGRESS
      else if (status === 'IN_PROGRESS') {
        inProgressCount++;
        
        // Populate first_assigned_at (done above) and started_at only.
        const startedAt = addMinutes(refTime, randomInt(15, 90));
        await client.query(`UPDATE verification_tasks SET started_at = $1 WHERE id = $2`, [startedAt, taskId]);

        // History
        const histCheck = await client.query('SELECT 1 FROM task_assignment_history WHERE verification_task_id = $1', [taskId]);
        if (histCheck.rowCount === 0) {
           await client.query(`
                INSERT INTO task_assignment_history (verification_task_id, case_id, assigned_to, assigned_by, assignment_reason, task_status_before, task_status_after, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [taskId, caseId, assignedTo, assignedTo, 'System Simulation', 'PENDING', 'ASSIGNED', refTime]);
        }
      }

      // CASE 3: ASSIGNED
      else if (status === 'ASSIGNED') {
        assignedCount++;
         // Populate first_assigned_at only (done above).
         
         // History
         const histCheck = await client.query('SELECT 1 FROM task_assignment_history WHERE verification_task_id = $1', [taskId]);
         if (histCheck.rowCount === 0) {
            await client.query(`
                 INSERT INTO task_assignment_history (verification_task_id, case_id, assigned_to, assigned_by, assignment_reason, task_status_before, task_status_after, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             `, [taskId, caseId, assignedTo, assignedTo, 'System Simulation', 'PENDING', 'ASSIGNED', refTime]);
         }
      }
    }

    await client.query('COMMIT');
    console.log('\nOperational simulation complete');
    console.log(`Processed: COMPLETED (${completedCount}), IN_PROGRESS (${inProgressCount}), ASSIGNED (${assignedCount})`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Simulation Failed:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

simulateFieldOperations();
