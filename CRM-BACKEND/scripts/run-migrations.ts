#!/usr/bin/env ts-node

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Simple logger for migration script
const logger = {
  info: (message: string, ...args: any[]) => console.log(`[INFO] ${message}`, ...args),
  error: (message: string, ...args: any[]) => console.error(`[ERROR] ${message}`, ...args),
  warn: (message: string, ...args: any[]) => console.warn(`[WARN] ${message}`, ...args)
};

// Database connection
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const pool = new Pool({ connectionString });

interface Migration {
  id: string;
  filename: string;
  sql: string;
}

interface MigrationRecord {
  id: string;
  filename: string;
  executed_at: Date;
  checksum: string;
  success: boolean;
}

/**
 * Multi-Verification Migration Runner
 * Safely executes database migrations for the multi-verification feature
 */
class MigrationRunner {
  private migrationsDir: string;
  
  constructor() {
    this.migrationsDir = path.join(__dirname, '..', 'migrations');
  }

  /**
   * Create migrations tracking table if it doesn't exist
   */
  private async createMigrationsTable(): Promise<void> {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id VARCHAR(255) PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        checksum VARCHAR(64) NOT NULL,
        execution_time_ms INTEGER,
        success BOOLEAN DEFAULT TRUE
      );
      
      CREATE INDEX IF NOT EXISTS idx_schema_migrations_executed_at 
      ON schema_migrations(executed_at);
    `;

    await pool.query(createTableSQL);
    logger.info('Migrations tracking table ready');
  }

  /**
   * Get list of migration files
   */
  private getMigrationFiles(): Migration[] {
    const files = fs.readdirSync(this.migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    return files.map(filename => {
      const id = filename.replace('.sql', '');
      const sql = fs.readFileSync(path.join(this.migrationsDir, filename), 'utf8');
      return { id, filename, sql };
    });
  }

  /**
   * Get executed migrations from database
   */
  private async getExecutedMigrations(): Promise<MigrationRecord[]> {
    const result = await pool.query(
      'SELECT * FROM schema_migrations ORDER BY executed_at'
    );
    return result.rows;
  }

  /**
   * Persist migration execution result, allowing retries to overwrite prior failed attempts.
   */
  private async recordMigrationResult(
    client: Awaited<ReturnType<typeof pool.connect>>,
    migration: Migration,
    checksum: string,
    executionTimeMs: number,
    success: boolean
  ): Promise<void> {
    await client.query(
      `INSERT INTO schema_migrations (id, filename, checksum, execution_time_ms, success)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET
         filename = EXCLUDED.filename,
         checksum = EXCLUDED.checksum,
         execution_time_ms = EXCLUDED.execution_time_ms,
         success = EXCLUDED.success,
         executed_at = CURRENT_TIMESTAMP`,
      [migration.id, migration.filename, checksum, executionTimeMs, success]
    );
  }

  /**
   * Calculate checksum for migration content
   */
  private calculateChecksum(content: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Execute a single migration
   */
  private async executeMigration(migration: Migration): Promise<void> {
    const startTime = Date.now();
    const checksum = this.calculateChecksum(migration.sql);
    
    logger.info(`Executing migration: ${migration.filename}`);
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Execute the migration SQL
      await client.query(migration.sql);
      
      // Record the migration
      await this.recordMigrationResult(client, migration, checksum, Date.now() - startTime, true);
      
      await client.query('COMMIT');
      
      logger.info(`✅ Migration ${migration.filename} completed successfully`);
      
    } catch (error) {
      await client.query('ROLLBACK');
      
      // Record failed migration
      try {
        const recordClient = await pool.connect();
        try {
          await this.recordMigrationResult(
            recordClient,
            migration,
            checksum,
            Date.now() - startTime,
            false
          );
        } finally {
          recordClient.release();
        }
      } catch (recordError) {
        logger.error('Failed to record migration failure:', recordError);
      }
      
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Run all pending migrations
   */
  async runMigrations(): Promise<void> {
    try {
      logger.info('🚀 Starting multi-verification migrations...');
      
      // Create migrations table
      await this.createMigrationsTable();
      
      // Get migration files and executed migrations
      const migrationFiles = this.getMigrationFiles();
      const executedMigrations = await this.getExecutedMigrations();
      const successfulMigrationIds = new Set(
        executedMigrations.filter(m => m.success).map(m => m.id)
      );
      
      // Find pending migrations
      const pendingMigrations = migrationFiles.filter(m => !successfulMigrationIds.has(m.id));
      
      if (pendingMigrations.length === 0) {
        logger.info('✅ No pending migrations found');
        return;
      }
      
      logger.info(`📋 Found ${pendingMigrations.length} pending migrations`);
      
      // Execute pending migrations
      for (const migration of pendingMigrations) {
        await this.executeMigration(migration);
      }
      
      logger.info('🎉 All migrations completed successfully!');
      
    } catch (error) {
      logger.error('❌ Migration failed:', error);
      throw error;
    }
  }

  /**
   * Run data migration specifically
   */
  async runDataMigration(): Promise<void> {
    try {
      logger.info('🔄 Starting data migration...');
      
      const result = await pool.query('SELECT migrate_existing_cases_to_multi_verification()');
      const migrationResult = result.rows[0].migrate_existing_cases_to_multi_verification;
      
      logger.info('📊 Migration Results:', {
        migratedCases: migrationResult.migrated_cases,
        migratedTasks: migrationResult.migrated_tasks,
        migratedCommissions: migrationResult.migrated_commissions,
        errors: migrationResult.errors
      });
      
      // Validate migration
      const validationResult = await pool.query('SELECT * FROM validate_migration_results()');
      logger.info('✅ Validation Results:');
      
      validationResult.rows.forEach(row => {
        const status = row.status === 'PASS' ? '✅' : '❌';
        logger.info(`${status} ${row.validation_check}: ${row.actual_count}/${row.expected_count}`);
      });
      
      // Get migration summary
      const summaryResult = await pool.query('SELECT * FROM get_migration_summary()');
      logger.info('📈 Migration Summary:');
      
      summaryResult.rows.forEach(row => {
        logger.info(`  ${row.metric}: ${row.value} (${row.description})`);
      });
      
    } catch (error) {
      logger.error('❌ Data migration failed:', error);
      throw error;
    }
  }

  /**
   * Get migration status
   */
  async getStatus(): Promise<void> {
    try {
      const migrationFiles = this.getMigrationFiles();
      const executedMigrations = await this.getExecutedMigrations();
      const migrationIdSet = new Set(migrationFiles.map(m => m.id));
      const successfulCurrentMigrationIds = new Set(
        executedMigrations
          .filter(m => m.success && migrationIdSet.has(m.id))
          .map(m => m.id)
      );
      const failedCurrentMigrations = executedMigrations.filter(
        m => !m.success && migrationIdSet.has(m.id)
      );
      const legacyTrackedMigrations = executedMigrations.filter(m => !migrationIdSet.has(m.id));
      
      logger.info('📋 Migration Status:');
      logger.info(`Total migrations: ${migrationFiles.length}`);
      logger.info(`Executed: ${successfulCurrentMigrationIds.size}`);
      logger.info(`Pending: ${migrationFiles.length - successfulCurrentMigrationIds.size}`);
      logger.info(`Failed: ${failedCurrentMigrations.length}`);
      logger.info(`Legacy tracked records: ${legacyTrackedMigrations.length}`);
      
      // Show detailed status
      migrationFiles.forEach(migration => {
        const failedRecord = failedCurrentMigrations.find(record => record.id === migration.id);
        const status = successfulCurrentMigrationIds.has(migration.id)
          ? '✅ Executed'
          : failedRecord
            ? '❌ Failed'
            : '⏳ Pending';
        logger.info(`  ${migration.filename}: ${status}`);
      });
      
      // Show summary if data migration has been run
      try {
        const summaryResult = await pool.query('SELECT * FROM get_migration_summary()');
        if (summaryResult.rows.length > 0) {
          logger.info('\n📈 System Summary:');
          summaryResult.rows.forEach(row => {
            logger.info(`  ${row.metric}: ${row.value}`);
          });
        }
      } catch (error) {
        // Migration functions not available yet
      }
      
    } catch (error) {
      logger.error('❌ Failed to get migration status:', error);
      throw error;
    }
  }

  /**
   * Rollback data migration (use with caution)
   */
  async rollbackDataMigration(): Promise<void> {
    try {
      logger.warn('⚠️  Starting migration rollback...');
      logger.warn('⚠️  This will delete all migrated multi-verification data!');
      
      const result = await pool.query('SELECT rollback_migration()');
      logger.info('✅ Rollback completed:', result.rows[0].rollback_migration);
      
    } catch (error) {
      logger.error('❌ Rollback failed:', error);
      throw error;
    }
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    await pool.end();
  }
}

// CLI interface
async function main() {
  const command = process.argv[2] || 'run';
  const runner = new MigrationRunner();
  
  try {
    switch (command) {
      case 'run':
        await runner.runMigrations();
        break;
        
      case 'data':
        await runner.runDataMigration();
        break;
        
      case 'status':
        await runner.getStatus();
        break;
        
      case 'rollback':
        await runner.rollbackDataMigration();
        break;
        
      default:
        logger.info('Usage: npm run migrate [run|data|status|rollback]');
        logger.info('  run     - Execute pending schema migrations');
        logger.info('  data    - Migrate existing data to multi-verification structure');
        logger.info('  status  - Show migration status');
        logger.info('  rollback - Rollback data migration (WARNING: destructive)');
        break;
    }
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await runner.close();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { MigrationRunner };
