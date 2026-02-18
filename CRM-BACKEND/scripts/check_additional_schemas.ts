
import { pool } from '../src/config/database';

async function checkAdditionalSchemas() {
  try {
    const attachRes = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'verification_attachments'
    `);
    console.log('Columns in verification_attachments:');
    console.log(attachRes.rows.map(r => r.column_name).sort().join(', '));

    const histRes = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'task_assignment_history'
    `);
    console.log('\nColumns in task_assignment_history:');
    console.log(histRes.rows.map(r => r.column_name).sort().join(', '));
    
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
checkAdditionalSchemas();
