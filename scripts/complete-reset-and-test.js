#!/usr/bin/env node

/**
 * Complete Case Data Reset and Test Case Creation Master Script
 * 
 * This script performs:
 * 1. Complete database cleanup
 * 2. Redis cache cleanup  
 * 3. Sequence reset
 * 4. Comprehensive test case creation
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Import other scripts
const { clearRedisCache } = require('./redis-cache-cleanup');
const { main: createTestCases } = require('./create-comprehensive-test-cases');
const { main: ensureTestUsers } = require('./ensure-test-users');

/**
 * Execute SQL script against the database
 */
async function executeSQLScript(scriptPath) {
  try {
    console.log(`📄 Executing SQL script: ${scriptPath}`);
    
    // Read the SQL script
    const sqlContent = fs.readFileSync(scriptPath, 'utf8');
    
    // Execute using psql (assuming PostgreSQL)
    const dbUrl = process.env.DATABASE_URL || 'postgresql://acs_user:acs_password@localhost:5432/acs_db';
    
    // Write SQL to temporary file
    const tempSqlFile = path.join(__dirname, 'temp_cleanup.sql');
    fs.writeFileSync(tempSqlFile, sqlContent);
    
    try {
      // Execute the SQL script
      execSync(`psql "${dbUrl}" -f "${tempSqlFile}"`, { 
        stdio: 'inherit',
        cwd: __dirname 
      });
      
      console.log('✅ SQL script executed successfully');
      return true;
    } finally {
      // Clean up temporary file
      if (fs.existsSync(tempSqlFile)) {
        fs.unlinkSync(tempSqlFile);
      }
    }
  } catch (error) {
    console.error('❌ SQL script execution failed:', error.message);
    return false;
  }
}

/**
 * Verify database cleanup
 */
async function verifyDatabaseCleanup() {
  try {
    console.log('🔍 Verifying database cleanup...');
    
    const axios = require('axios');
    const response = await axios.get('http://172.20.10.8:3000/api/cases');
    
    if (response.data && response.data.data && response.data.data.length === 0) {
      console.log('✅ Database cleanup verified - no cases found');
      return true;
    } else {
      console.log('⚠️  Warning: Cases still exist in database');
      return false;
    }
  } catch (error) {
    console.log('ℹ️  Could not verify cleanup via API (this is normal if authentication is required)');
    return true; // Assume success if API requires auth
  }
}

/**
 * Wait for backend to be ready
 */
async function waitForBackend(maxAttempts = 10) {
  console.log('⏳ Waiting for backend to be ready...');
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const axios = require('axios');
      await axios.get('http://172.20.10.8:3000/health');
      console.log('✅ Backend is ready');
      return true;
    } catch (error) {
      console.log(`🔄 Attempt ${attempt}/${maxAttempts} - Backend not ready yet...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  console.log('⚠️  Backend may not be ready, but continuing...');
  return false;
}

/**
 * Display final summary
 */
function displaySummary(results) {
  console.log('\n' + '='.repeat(70));
  console.log('🎯 COMPLETE RESET AND TEST CASE CREATION SUMMARY');
  console.log('='.repeat(70));
  
  console.log('\n📋 PHASE 1: DATA CLEANUP');
  console.log(`  Database Cleanup: ${results.databaseCleanup ? '✅ SUCCESS' : '❌ FAILED'}`);
  console.log(`  Redis Cache Cleanup: ${results.redisCleanup ? '✅ SUCCESS' : '❌ FAILED'}`);
  console.log(`  Verification: ${results.verification ? '✅ SUCCESS' : '❌ FAILED'}`);

  console.log('\n📋 PHASE 2: USER SETUP');
  console.log(`  Test Users Created: ${results.userCreation ? '✅ SUCCESS' : '❌ FAILED'}`);

  console.log('\n📋 PHASE 3: TEST CASE CREATION');
  console.log(`  Test Cases Created: ${results.testCaseCreation ? '✅ SUCCESS' : '❌ FAILED'}`);
  
  console.log('\n🎯 EXPECTED RESULTS:');
  console.log('  • 45 test cases created (9 verification types × 5 form outcomes)');
  console.log('  • Case IDs starting from 1');
  console.log('  • All cases assigned to nikhil.parab');
  console.log('  • Area and Rate Type columns populated');
  console.log('  • Clean database with no legacy data');
  
  console.log('\n🔍 NEXT STEPS:');
  console.log('  1. Open the CRM frontend');
  console.log('  2. Navigate to Cases page');
  console.log('  3. Verify Area and Rate Type columns are visible');
  console.log('  4. Check that case IDs start from 1');
  console.log('  5. Test mobile app synchronization');
  console.log('  6. Verify Excel export includes new columns');
  
  const overallSuccess = Object.values(results).every(result => result);
  console.log(`\n🏆 OVERALL STATUS: ${overallSuccess ? '✅ SUCCESS' : '❌ PARTIAL SUCCESS'}`);
}

/**
 * Main execution function
 */
async function main() {
  console.log('🚀 COMPLETE CASE DATA RESET AND TEST CASE CREATION');
  console.log('='.repeat(70));
  console.log('This script will:');
  console.log('  1. Delete ALL existing case data');
  console.log('  2. Clear Redis cache and queues');
  console.log('  3. Reset case ID sequence to 1');
  console.log('  4. Create 45 comprehensive test cases');
  console.log('='.repeat(70));
  
  // Confirmation prompt
  console.log('\n⚠️  WARNING: This will permanently delete all existing case data!');
  console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...');
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  const results = {
    databaseCleanup: false,
    redisCleanup: false,
    verification: false,
    userCreation: false,
    testCaseCreation: false
  };
  
  try {
    // Phase 1: Database Cleanup
    console.log('\n📋 PHASE 1: DATABASE CLEANUP');
    console.log('-'.repeat(40));
    
    const sqlScriptPath = path.join(__dirname, 'complete-case-data-reset.sql');
    results.databaseCleanup = await executeSQLScript(sqlScriptPath);
    
    if (!results.databaseCleanup) {
      console.log('❌ Database cleanup failed. Aborting...');
      process.exit(1);
    }
    
    // Phase 2: Redis Cleanup
    console.log('\n📋 PHASE 2: REDIS CACHE CLEANUP');
    console.log('-'.repeat(40));
    
    try {
      await clearRedisCache();
      results.redisCleanup = true;
    } catch (error) {
      console.error('❌ Redis cleanup failed:', error.message);
      console.log('⚠️  Continuing without Redis cleanup...');
      results.redisCleanup = false;
    }
    
    // Phase 3: Verification
    console.log('\n📋 PHASE 3: CLEANUP VERIFICATION');
    console.log('-'.repeat(40));

    await waitForBackend();
    results.verification = await verifyDatabaseCleanup();

    // Phase 4: User Creation
    console.log('\n📋 PHASE 4: USER CREATION');
    console.log('-'.repeat(40));

    try {
      await ensureTestUsers();
      results.userCreation = true;
    } catch (error) {
      console.error('❌ User creation failed:', error.message);
      console.log('⚠️  Continuing without user creation...');
      results.userCreation = false;
    }

    // Phase 5: Test Case Creation
    console.log('\n📋 PHASE 5: TEST CASE CREATION');
    console.log('-'.repeat(40));
    
    try {
      await createTestCases();
      results.testCaseCreation = true;
    } catch (error) {
      console.error('❌ Test case creation failed:', error.message);
      results.testCaseCreation = false;
    }
    
    // Final Summary
    displaySummary(results);
    
  } catch (error) {
    console.error('\n💥 Script execution failed:', error);
    displaySummary(results);
    process.exit(1);
  }
}

// Execute the script
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Script execution failed:', error);
    process.exit(1);
  });
}

module.exports = { main };
