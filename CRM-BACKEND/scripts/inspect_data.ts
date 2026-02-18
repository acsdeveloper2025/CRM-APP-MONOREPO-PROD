
import { pool } from '../src/config/database';

async function inspectData() {
  console.log('--- DATA INSPECTION REPORT ---');

  try {
    // 1. Verification Tasks Schema
    console.log('\n1. verification_tasks Schema:');
    const vtSchema = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'verification_tasks'
      ORDER BY ordinal_position;
    `);
    vtSchema.rows.forEach(row => console.log(`   - ${row.column_name}: ${row.data_type}`));

    // 2. Task Assignment History Schema
    console.log('\n2. task_assignment_history Schema:');
    const tahSchema = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'task_assignment_history'
      ORDER BY ordinal_position;
    `);
    if (tahSchema.rows.length === 0) {
      console.log('   [WARNING] Table task_assignment_history NOT FOUND');
    } else {
      tahSchema.rows.forEach(row => console.log(`   - ${row.column_name}: ${row.data_type}`));
    }

    // 3. Real Completed Task Data
    console.log('\n3. Real Completed Task Sample:');
    const taskRes = await pool.query(`
      SELECT * FROM verification_tasks 
      WHERE status = 'COMPLETED' 
      ORDER BY completed_at DESC 
      LIMIT 1
    `);

    if (taskRes.rows.length > 0) {
      const task = taskRes.rows[0];
      console.log(`   Task ID: ${task.id}`);
      console.log(`   Status: ${task.status}`);
      console.log(`   Created At: ${task.created_at}`);
      console.log(`   Assigned At: ${task.assigned_at}`);
      console.log(`   Started At: ${task.started_at}`);
      console.log(`   Completed At: ${task.completed_at}`);
      console.log(`   Revoked At: ${task.revoked_at}`); // Checking if this column exists in data
      
      // Check related data for this task
      console.log('\n4. Location Capture (for this case):');
      const locRes = await pool.query(`
        SELECT * FROM locations 
        WHERE case_id = $1 
        ORDER BY "recordedAt" DESC 
        LIMIT 1
      `, [task.case_id]);
      
      if (locRes.rows.length > 0) {
        const loc = locRes.rows[0];
        console.log(`   Found Location Record: ID ${loc.id}`);
        console.log(`   Recorded At: ${loc.recordedAt}`);
        console.log(`   Captured By: ${loc.recordedBy}`); // Assuming this column based on earlier check context
      } else {
        console.log('   No location found for this case.');
      }

      console.log('\n5. Form Submission (for this task):');
      const formRes = await pool.query(`
        SELECT * FROM task_form_submissions 
        WHERE verification_task_id = $1 
        LIMIT 1
      `, [task.id]);

      if (formRes.rows.length > 0) {
        const form = formRes.rows[0];
        console.log(`   Found Form Submission: ID ${form.id}`);
        console.log(`   Submitted At: ${form.submitted_at}`);
      } else {
        console.log('   No form submission found for this task.');
      }

    } else {
      console.log('   No COMPLETED tasks found in database.');
    }
    
    // Check Locations Schema specifically
    console.log('\n6. Locations Table Schema:');
    const locSchema = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'locations'
      ORDER BY ordinal_position;
    `);
    locSchema.rows.forEach(row => console.log(`   - ${row.column_name}: ${row.data_type}`));

    // Check Form Submissions Schema specifically
    console.log('\n7. Task Form Submissions Schema:');
    const formSchema = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'task_form_submissions'
      ORDER BY ordinal_position;
    `);
    formSchema.rows.forEach(row => console.log(`   - ${row.column_name}: ${row.data_type}`));


  } catch (error) {
    console.error('Error interacting with database:', error);
  } finally {
    await pool.end();
  }
}

inspectData();
