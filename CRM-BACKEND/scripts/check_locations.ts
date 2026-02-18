
import { pool } from '../../src/config/database';

async function checkLocationsColumns() {
  try {
    const res = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'locations'
    `);
    console.log('Columns in locations:');
    console.log(res.rows.map(r => r.column_name).sort().join(', '));
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
checkLocationsColumns();
