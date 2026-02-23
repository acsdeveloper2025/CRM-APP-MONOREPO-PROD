import { pool } from '../src/config/database';
import { logger } from '../src/utils/logger';

const verificationTypes = [
  { name: 'Residence Verification', code: 'RESIDENCE' },
  { name: 'Residence cum office Verification', code: 'RESIDENCE_CUM_OFFICE' },
  { name: 'Office Verification', code: 'OFFICE' },
  { name: 'Business Verification', code: 'BUSINESS' },
  { name: 'Builder Verification', code: 'BUILDER' },
  { name: 'Noc Verification', code: 'NOC' },
  { name: 'DSA DST & connector Verification', code: 'DSA_CONNECTOR' },
  { name: 'Property APF Verification', code: 'PROPERTY_APF' },
  { name: 'Property individual Verification', code: 'PROPERTY_INDIVIDUAL' }
];

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    for (const vt of verificationTypes) {
      const query = `
        INSERT INTO "verificationTypes" (name, code, "isActive", "createdAt", "updatedAt")
        VALUES ($1, $2, true, NOW(), NOW())
        ON CONFLICT (code) DO UPDATE 
        SET name = EXCLUDED.name, "updatedAt" = NOW()
      `;
      await client.query(query, [vt.name, vt.code]);
      console.log(`Seeded/Updated: ${vt.name} (${vt.code})`);
    }
    
    await client.query('COMMIT');
    console.log('Seeding completed successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Seeding failed:', error);
  } finally {
    client.release();
    process.exit(0);
  }
}

seed();
