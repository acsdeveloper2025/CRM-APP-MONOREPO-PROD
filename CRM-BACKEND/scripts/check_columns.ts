
import { pool } from '../src/config/database';

async function checkColumns() {
  try {
    const res = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'verification_tasks'
    `);
    console.log('Columns in verification_tasks:');
    console.log(res.rows.map(r => r.column_name).sort().join(', '));
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
checkColumns();
