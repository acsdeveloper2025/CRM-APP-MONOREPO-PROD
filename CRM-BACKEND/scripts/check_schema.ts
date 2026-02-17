
import * as dotenv from 'dotenv';
dotenv.config();
import { pool, disconnectDatabase } from '../src/config/db';

async function check() {
  try {
    const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'task_form_submissions'
    `);
    console.log('Schema:', res.rows);
    
    const count = await pool.query('SELECT COUNT(*) FROM task_form_submissions');
    console.log('Count:', count.rows[0]);
  } catch (e) {
    console.error(e);
  } finally {
    await disconnectDatabase().catch(() => {});
  }
}
check();
