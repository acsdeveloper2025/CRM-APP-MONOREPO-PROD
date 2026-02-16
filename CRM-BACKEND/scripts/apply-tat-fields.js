const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    console.log('Applying direct schema update...');
    await pool.query(`
      ALTER TABLE verification_tasks 
      ADD COLUMN IF NOT EXISTS first_assigned_at timestamp with time zone,
      ADD COLUMN IF NOT EXISTS current_assigned_at timestamp with time zone;
      
      UPDATE verification_tasks 
      SET first_assigned_at = COALESCE(assigned_at, created_at, NOW()),
          current_assigned_at = COALESCE(assigned_at, created_at, NOW())
      WHERE first_assigned_at IS NULL;
    `);
    console.log('✅ Direct schema update successful!');
  } catch (err) {
    console.error('❌ Direct schema update failed:', err);
  } finally {
    await pool.end();
  }
}

run();
