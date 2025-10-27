#!/usr/bin/env node

/**
 * Verify Cleanup Script
 * Verifies that all case data has been successfully removed
 */

const { Pool } = require('pg');
const redis = require('redis');
require('dotenv').config();

// Parse DATABASE_URL if available
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

// Parse REDIS_URL if available
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

async function verifyDatabase() {
  const client = await pool.connect();
  try {
    console.log('\n📊 Verifying Database Cleanup...\n');

    const tables = [
      'cases',
      'verification_tasks',
      'form_submissions',
      'verification_attachments',
      'case_status_history',
      'task_form_submissions',
    ];

    let allClean = true;

    for (const table of tables) {
      try {
        const result = await client.query(`SELECT COUNT(*) as count FROM ${table};`);
        const count = result.rows[0].count;
        const status = count === 0 ? '✅' : '❌';
        console.log(`${status} ${table}: ${count} rows`);
        if (count > 0) allClean = false;
      } catch (error) {
        console.log(`⚠️  ${table}: Could not verify (table may not exist)`);
      }
    }

    return allClean;
  } catch (error) {
    console.error('❌ Database verification failed:', error.message);
    return false;
  } finally {
    client.release();
  }
}

async function verifyRedis() {
  try {
    console.log('\n📊 Verifying Redis Cleanup...\n');

    await redisClient.connect();

    // Check for case-related keys (actual data, not metadata)
    const caseKeys = await redisClient.keys('case:*');
    const taskKeys = await redisClient.keys('task:*');
    const formKeys = await redisClient.keys('form:*');

    // Check for case data in queues (not metadata)
    const caseQueueData = await redisClient.keys('bull:case-assignment:*');
    const caseQueueDataFiltered = caseQueueData.filter(k =>
      !k.includes('stalled-check') && !k.includes('meta')
    );

    const allDataKeys = [...caseKeys, ...taskKeys, ...formKeys, ...caseQueueDataFiltered];

    console.log(`✅ Case keys: ${caseKeys.length} (should be 0)`);
    console.log(`✅ Task keys: ${taskKeys.length} (should be 0)`);
    console.log(`✅ Form keys: ${formKeys.length} (should be 0)`);
    console.log(`✅ Queue data keys: ${caseQueueDataFiltered.length} (should be 0)`);

    const isClean = allDataKeys.length === 0;
    console.log(`\n${isClean ? '✅' : '❌'} Total case-related data keys: ${allDataKeys.length}`);

    return isClean;
  } catch (error) {
    console.error('❌ Redis verification failed:', error.message);
    return false;
  } finally {
    await redisClient.quit();
  }
}

async function main() {
  try {
    console.log('\n========================================');
    console.log('🔍 VERIFY CLEANUP SCRIPT');
    console.log('========================================');

    const dbClean = await verifyDatabase();
    const redisClean = await verifyRedis();

    console.log('\n========================================');
    console.log('📋 VERIFICATION RESULTS');
    console.log('========================================\n');

    console.log(`Database: ${dbClean ? '✅ CLEAN' : '❌ NOT CLEAN'}`);
    console.log(`Redis: ${redisClean ? '✅ CLEAN' : '❌ NOT CLEAN'}`);

    if (dbClean && redisClean) {
      console.log('\n✅ ALL SYSTEMS CLEAN - Ready for fresh data!\n');
      process.exit(0);
    } else {
      console.log('\n❌ Some systems still have data - Cleanup may be incomplete\n');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Verification failed:', error);
    process.exit(1);
  }
}

main();

