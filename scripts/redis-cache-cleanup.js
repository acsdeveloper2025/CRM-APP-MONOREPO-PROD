#!/usr/bin/env node

/**
 * Redis Cache Cleanup Script
 * Clears all case-related cache data and queues
 */

const Redis = require('ioredis');

// Redis configuration (should match backend configuration)
const REDIS_CONFIG = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: 0
};

/**
 * Clear Redis cache and queues
 */
async function clearRedisCache() {
  let redis = null;
  
  try {
    console.log('🔄 Connecting to Redis...');
    redis = new Redis(REDIS_CONFIG);
    
    console.log('🧹 Clearing case-related cache data...');
    
    // Case-related cache patterns to clear
    const cachePatterns = [
      'cases:*',
      'case:*',
      'user:*:cases',
      'case-assignment:*',
      'case-queue:*',
      'mobile:cases:*',
      'form-submissions:*',
      'attachments:*',
      'verification:*',
      'enterprise:*:cases',
      'sync:*:cases'
    ];
    
    let totalKeysDeleted = 0;
    
    for (const pattern of cachePatterns) {
      console.log(`🔍 Scanning for pattern: ${pattern}`);
      const keys = await redis.keys(pattern);
      
      if (keys.length > 0) {
        console.log(`🗑️  Deleting ${keys.length} keys matching ${pattern}`);
        await redis.del(...keys);
        totalKeysDeleted += keys.length;
      } else {
        console.log(`✅ No keys found for pattern: ${pattern}`);
      }
    }
    
    // Clear specific queues
    const queuesToClear = [
      'case-assignment',
      'case-notification',
      'case-sync',
      'mobile-sync',
      'enterprise-sync'
    ];
    
    for (const queueName of queuesToClear) {
      console.log(`🧹 Clearing queue: ${queueName}`);
      
      // Clear different queue data structures
      const queueKeys = [
        `bull:${queueName}:waiting`,
        `bull:${queueName}:active`,
        `bull:${queueName}:completed`,
        `bull:${queueName}:failed`,
        `bull:${queueName}:delayed`,
        `bull:${queueName}:paused`,
        `bull:${queueName}:id`,
        `bull:${queueName}:meta`
      ];
      
      for (const queueKey of queueKeys) {
        const exists = await redis.exists(queueKey);
        if (exists) {
          await redis.del(queueKey);
          console.log(`  ✅ Cleared: ${queueKey}`);
        }
      }
    }
    
    // Clear any remaining Bull queue job data
    console.log('🧹 Clearing Bull queue job data...');
    const bullKeys = await redis.keys('bull:*');
    if (bullKeys.length > 0) {
      await redis.del(...bullKeys);
      totalKeysDeleted += bullKeys.length;
      console.log(`✅ Cleared ${bullKeys.length} Bull queue keys`);
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 REDIS CLEANUP SUMMARY');
    console.log('='.repeat(50));
    console.log(`🗑️  Total keys deleted: ${totalKeysDeleted}`);
    console.log('✅ Redis cache cleanup completed successfully');
    
  } catch (error) {
    console.error('❌ Redis cleanup failed:', error.message);
    throw error;
  } finally {
    if (redis) {
      await redis.quit();
      console.log('🔌 Redis connection closed');
    }
  }
}

/**
 * Main execution function
 */
async function main() {
  console.log('🚀 Starting Redis Cache Cleanup');
  console.log('=' .repeat(50));
  
  try {
    await clearRedisCache();
    console.log('\n🎉 Redis cleanup completed successfully!');
  } catch (error) {
    console.error('\n💥 Redis cleanup failed:', error);
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

module.exports = { clearRedisCache };
