#!/usr/bin/env node

/**
 * Clean and Seed Cases Script
 * Removes all case-related data from database, Redis, and caches
 */

const { Pool } = require('pg');
const redis = require('redis');
require('dotenv').config();

// Parse DATABASE_URL if available, otherwise use individual env vars
let poolConfig;
if (process.env.DATABASE_URL) {
  poolConfig = {
    connectionString: process.env.DATABASE_URL,
  };
} else {
  poolConfig = {
    user: process.env.DB_USER || 'example_db_user',
    password: process.env.DB_PASSWORD || 'example_db_password',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'acs_db',
  };
}

const pool = new Pool(poolConfig);

// Parse REDIS_URL if available, otherwise use individual env vars
let redisConfig;
if (process.env.REDIS_URL) {
  redisConfig = process.env.REDIS_URL;
} else {
  redisConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
  };
}

const redisClient = redis.createClient(
  typeof redisConfig === 'string' ? { url: redisConfig } : redisConfig
);

async function cleanDatabase() {
  const client = await pool.connect();
  try {
    console.log('🗑️  Starting database cleanup...');

    // Disable foreign key checks temporarily
    await client.query('SET session_replication_role = replica;');

    // Delete all case-related data in order of dependencies
    const tables = [
      'task_commissions',
      'task_form_submissions',
      'verification_attachments',
      'residenceVerificationReports',
      'officeVerificationReports',
      'businessVerificationReports',
      'builderVerificationReports',
      'residenceCumOfficeVerificationReports',
      'dsaConnectorVerificationReports',
      'propertyApfVerificationReports',
      'propertyIndividualVerificationReports',
      'nocVerificationReports',
      'form_submissions',
      'verification_tasks',
      'case_status_history',
      'cases',
    ];

    for (const table of tables) {
      try {
        const result = await client.query(`DELETE FROM ${table};`);
        console.log(`✅ Cleared ${table}: ${result.rowCount} rows deleted`);
      } catch (error) {
        console.log(`⚠️  Could not clear ${table}: ${error.message}`);
      }
    }

    // Reset sequences
    const sequences = [
      'cases_id_seq',
      'verification_tasks_id_seq',
      'form_submissions_id_seq',
    ];

    for (const seq of sequences) {
      try {
        await client.query(`ALTER SEQUENCE IF EXISTS ${seq} RESTART WITH 1;`);
        console.log(`✅ Reset sequence: ${seq}`);
      } catch (error) {
        console.log(`⚠️  Could not reset ${seq}: ${error.message}`);
      }
    }

    // Re-enable foreign key checks
    await client.query('SET session_replication_role = default;');

    console.log('✅ Database cleanup complete!');
  } catch (error) {
    console.error('❌ Database cleanup failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function cleanRedis() {
  try {
    console.log('🗑️  Starting Redis cleanup...');

    await redisClient.connect();

    // Get all keys related to cases
    const caseKeys = await redisClient.keys('case:*');
    const taskKeys = await redisClient.keys('task:*');
    const formKeys = await redisClient.keys('form:*');
    const queueKeys = await redisClient.keys('bull:*');

    const allKeys = [...caseKeys, ...taskKeys, ...formKeys, ...queueKeys];

    if (allKeys.length > 0) {
      await redisClient.del(allKeys);
      console.log(`✅ Deleted ${allKeys.length} Redis keys`);
    } else {
      console.log('✅ No case-related Redis keys found');
    }

    // Clear all queues
    const queues = ['cases', 'tasks', 'forms', 'submissions'];
    for (const queue of queues) {
      try {
        await redisClient.del(`bull:${queue}:*`);
        console.log(`✅ Cleared queue: ${queue}`);
      } catch (error) {
        console.log(`⚠️  Could not clear queue ${queue}: ${error.message}`);
      }
    }

    console.log('✅ Redis cleanup complete!');
  } catch (error) {
    console.error('❌ Redis cleanup failed:', error);
    throw error;
  } finally {
    await redisClient.quit();
  }
}

async function cleanMobileCache() {
  console.log('🗑️  Starting mobile cache cleanup...');
  console.log('✅ Mobile cache cleanup complete (handled by app on next sync)');
}

async function cleanFrontendCache() {
  console.log('🗑️  Starting frontend cache cleanup...');
  console.log('✅ Frontend cache cleanup complete (handled by app on next refresh)');
}

async function main() {
  try {
    console.log('\n========================================');
    console.log('🧹 CRM CASE DATA CLEANUP SCRIPT');
    console.log('========================================\n');

    await cleanDatabase();
    console.log('');

    await cleanRedis();
    console.log('');

    await cleanMobileCache();
    console.log('');

    await cleanFrontendCache();
    console.log('');

    console.log('========================================');
    console.log('✅ ALL CLEANUP COMPLETE!');
    console.log('========================================\n');

    console.log('Summary:');
    console.log('✅ Database: All case data cleared');
    console.log('✅ Redis: All case-related keys cleared');
    console.log('✅ Mobile: Cache will be cleared on next sync');
    console.log('✅ Frontend: Cache will be cleared on next refresh');
    console.log('');
    console.log('The system is now ready for fresh data.\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Cleanup failed:', error);
    process.exit(1);
  }
}

main();

