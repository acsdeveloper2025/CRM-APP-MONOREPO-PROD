
import { pool } from '../src/config/database';

async function generateInventoryReport() {
  console.log('--- DATABASE INVENTORY REPORT ---');

  try {
    // Helper to log section
    const logSection = async (title: string, query: string, params: any[] = []) => {
      console.log(`\n=== ${title} ===`);
      try {
        const countRes = await pool.query(`SELECT COUNT(*) FROM (${query}) as sub`);
        console.log(`Total Count: ${countRes.rows[0].count}`);

        const sampleRes = await pool.query(`${query} LIMIT 5`, params);
        if (sampleRes.rows.length > 0) {
          console.table(sampleRes.rows);
        } else {
          console.log('(No data found)');
        }
      } catch (err: any) {
        console.log(`Error querying ${title}: ${err.message}`);
      }
    };

    // 1. Clients
    await logSection('1. Clients', 'SELECT id, name, "isActive" FROM clients');

    // 2. Products
    await logSection('2. Products', 'SELECT id, name, "isActive" FROM products');

    // 3. Verification Types
    // Note: Table name often quoted if mixed case
    await logSection('3. Verification Types', 'SELECT id, name, code, "verificationMode" FROM "verificationTypes"');

    // 4. Rate/Config Mapping (Client-Product-Type)
    // Check for a likely table: rate_cards, rates, client_configurations? 
    // Trying 'rateTypes' or 'rates' based on common patterns, or looking for join table
    // verify_stage_2c showed 'rate_type_id' in verification_tasks. 
    await logSection('4. Rate Types (Configuration)', 'SELECT id, name, amount, "clientId", "verificationTypeId" FROM "rateTypes"');

    // 5. Users (Field Agents)
    await logSection('5. Field Agents', "SELECT id, name, email, role, \"isActive\" FROM users WHERE role = 'FIELD_AGENT'");

    // 6. Service / Location Data
    // Using * to avoid column guessing errors and see structure
    await logSection('6a. Service Zones', 'SELECT * FROM service_zones');
    await logSection('6b. Pincodes', 'SELECT * FROM pincodes');
    await logSection('6c. Areas', 'SELECT * FROM areas');

    // 7. Task Status Distribution
    console.log('\n=== 7. Verification Task Status Distribution ===');
    const statusRes = await pool.query(`
      SELECT status, COUNT(*) as count 
      FROM verification_tasks 
      GROUP BY status 
      ORDER BY count DESC
    `);
    console.table(statusRes.rows);

  } catch (error) {
    console.error('Inventory Report Failed:', error);
  } finally {
    await pool.end();
  }
}

generateInventoryReport();
