
import { pool } from '../src/config/database';

async function checkSchema() {
  try {
    const locRes = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'locations'
    `);
    console.log('Columns in locations:');
    console.log(locRes.rows.map(r => r.column_name).sort().join(', '));

    const formRes = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'task_form_submissions'
    `);
    console.log('\nColumns in task_form_submissions:');
    console.log(formRes.rows.map(r => r.column_name).sort().join(', '));
    
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
checkSchema();
