import SQLite from 'react-native-sqlite-storage';
import { Case, FormSubmission, Attachment, SyncAction } from '../types';

// Enable debugging in development
SQLite.DEBUG(process.env.NODE_ENV === 'development');
SQLite.enablePromise(true);

interface DatabaseConfig {
  name: string;
  version: string;
  displayName: string;
  size: number;
}

interface QueryResult {
  rows: {
    length: number;
    item: (index: number) => any;
    raw: () => any[];
  };
  insertId?: number;
  rowsAffected: number;
}

export class EnterpriseOfflineDatabase {
  private static instance: EnterpriseOfflineDatabase;
  private db: SQLite.SQLiteDatabase | null = null;
  private isInitialized = false;

  private config: DatabaseConfig = {
    name: 'CRMEnterpriseDB.db',
    version: '2.0.0',
    displayName: 'CRM Enterprise Database',
    size: 50 * 1024 * 1024, // 50MB
  };

  private constructor() {}

  static getInstance(): EnterpriseOfflineDatabase {
    if (!EnterpriseOfflineDatabase.instance) {
      EnterpriseOfflineDatabase.instance = new EnterpriseOfflineDatabase();
    }
    return EnterpriseOfflineDatabase.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.db = await SQLite.openDatabase(this.config);
      await this.createTables();
      await this.performMigrations();
      this.isInitialized = true;
      console.log('Enterprise database initialized successfully');
    } catch (error) {
      console.error('Database initialization failed:', error);
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const tables = [
      // Cases table with enterprise features
      `CREATE TABLE IF NOT EXISTS cases (
        id TEXT PRIMARY KEY,
        customer_name TEXT NOT NULL,
        customer_phone TEXT,
        customer_email TEXT,
        address TEXT,
        verification_type TEXT,
        applicant_type TEXT,
        product TEXT,
        client TEXT,
        priority TEXT DEFAULT 'MEDIUM',
        status TEXT DEFAULT 'PENDING',
        assigned_to TEXT,
        assigned_by TEXT,
        created_by TEXT,
        backend_contact_number TEXT,
        trigger_info TEXT,
        customer_calling_code TEXT,
        notes TEXT,
        created_at INTEGER,
        updated_at INTEGER,
        sync_status TEXT DEFAULT 'pending',
        last_modified INTEGER,
        version INTEGER DEFAULT 1,
        conflict_data TEXT,
        offline_changes TEXT
      )`,

      // Form submissions with enhanced metadata
      `CREATE TABLE IF NOT EXISTS form_submissions (
        id TEXT PRIMARY KEY,
        case_id TEXT NOT NULL,
        form_type TEXT NOT NULL,
        form_data TEXT NOT NULL,
        submission_time INTEGER,
        location_latitude REAL,
        location_longitude REAL,
        location_accuracy REAL,
        location_address TEXT,
        device_info TEXT,
        app_version TEXT,
        sync_status TEXT DEFAULT 'pending',
        created_at INTEGER,
        updated_at INTEGER,
        FOREIGN KEY (case_id) REFERENCES cases (id)
      )`,

      // Attachments with compression and metadata
      `CREATE TABLE IF NOT EXISTS attachments (
        id TEXT PRIMARY KEY,
        case_id TEXT,
        form_submission_id TEXT,
        file_name TEXT NOT NULL,
        file_type TEXT NOT NULL,
        file_size INTEGER,
        file_path TEXT NOT NULL,
        thumbnail_path TEXT,
        compressed_path TEXT,
        upload_status TEXT DEFAULT 'pending',
        upload_progress REAL DEFAULT 0,
        metadata TEXT,
        created_at INTEGER,
        updated_at INTEGER,
        FOREIGN KEY (case_id) REFERENCES cases (id),
        FOREIGN KEY (form_submission_id) REFERENCES form_submissions (id)
      )`,

      // Sync actions queue
      `CREATE TABLE IF NOT EXISTS sync_actions (
        id TEXT PRIMARY KEY,
        action_type TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        action_data TEXT NOT NULL,
        priority INTEGER DEFAULT 1,
        retry_count INTEGER DEFAULT 0,
        max_retries INTEGER DEFAULT 3,
        created_at INTEGER,
        scheduled_at INTEGER,
        status TEXT DEFAULT 'pending'
      )`,

      // Offline cache for API responses
      `CREATE TABLE IF NOT EXISTS cache (
        key TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        expires_at INTEGER,
        created_at INTEGER
      )`,

      // User sessions and authentication
      `CREATE TABLE IF NOT EXISTS user_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token TEXT NOT NULL,
        refresh_token TEXT,
        expires_at INTEGER,
        created_at INTEGER,
        last_activity INTEGER
      )`,

      // Conflict resolution
      `CREATE TABLE IF NOT EXISTS conflicts (
        id TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        local_data TEXT NOT NULL,
        server_data TEXT NOT NULL,
        conflict_type TEXT NOT NULL,
        resolution_strategy TEXT,
        created_at INTEGER,
        resolved_at INTEGER,
        status TEXT DEFAULT 'pending'
      )`,

      // Performance metrics
      `CREATE TABLE IF NOT EXISTS performance_metrics (
        id TEXT PRIMARY KEY,
        metric_type TEXT NOT NULL,
        metric_value REAL NOT NULL,
        metadata TEXT,
        timestamp INTEGER
      )`,

      // Notification queue
      `CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT DEFAULT 'info',
        data TEXT,
        read_status INTEGER DEFAULT 0,
        created_at INTEGER,
        expires_at INTEGER
      )`
    ];

    for (const tableSQL of tables) {
      await this.db.executeSql(tableSQL);
    }

    // Create indexes for performance
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_cases_status ON cases (status)',
      'CREATE INDEX IF NOT EXISTS idx_cases_assigned_to ON cases (assigned_to)',
      'CREATE INDEX IF NOT EXISTS idx_cases_sync_status ON cases (sync_status)',
      'CREATE INDEX IF NOT EXISTS idx_cases_updated_at ON cases (updated_at)',
      'CREATE INDEX IF NOT EXISTS idx_form_submissions_case_id ON form_submissions (case_id)',
      'CREATE INDEX IF NOT EXISTS idx_attachments_case_id ON attachments (case_id)',
      'CREATE INDEX IF NOT EXISTS idx_sync_actions_status ON sync_actions (status)',
      'CREATE INDEX IF NOT EXISTS idx_cache_expires_at ON cache (expires_at)',
    ];

    for (const indexSQL of indexes) {
      await this.db.executeSql(indexSQL);
    }
  }

  private async performMigrations(): Promise<void> {
    // Check current database version and perform migrations if needed
    const versionResult = await this.query('PRAGMA user_version');
    const currentVersion = versionResult.rows.item(0).user_version;

    if (currentVersion < 2) {
      await this.migrateToVersion2();
      await this.db!.executeSql('PRAGMA user_version = 2');
    }
  }

  private async migrateToVersion2(): Promise<void> {
    // Add new columns for enterprise features
    const migrations = [
      'ALTER TABLE cases ADD COLUMN version INTEGER DEFAULT 1',
      'ALTER TABLE cases ADD COLUMN conflict_data TEXT',
      'ALTER TABLE cases ADD COLUMN offline_changes TEXT',
      'ALTER TABLE attachments ADD COLUMN compressed_path TEXT',
      'ALTER TABLE attachments ADD COLUMN upload_progress REAL DEFAULT 0',
    ];

    for (const migration of migrations) {
      try {
        await this.db!.executeSql(migration);
      } catch (error) {
        // Column might already exist, ignore error
        console.log('Migration step skipped:', migration);
      }
    }
  }

  async query(sql: string, params: any[] = []): Promise<QueryResult> {
    if (!this.db) throw new Error('Database not initialized');
    
    const [result] = await this.db.executeSql(sql, params);
    return result;
  }

  async transaction(operations: (tx: SQLite.Transaction) => Promise<void>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    return new Promise((resolve, reject) => {
      this.db!.transaction(
        async (tx) => {
          try {
            await operations(tx);
          } catch (error) {
            reject(error);
          }
        },
        reject,
        resolve
      );
    });
  }

  // Case operations
  async saveCase(caseData: Case): Promise<void> {
    const sql = `
      INSERT OR REPLACE INTO cases (
        id, customer_name, customer_phone, customer_email, address,
        verification_type, applicant_type, product, client, priority,
        status, assigned_to, assigned_by, created_by, backend_contact_number,
        trigger_info, customer_calling_code, notes, created_at, updated_at,
        sync_status, last_modified, version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      caseData.id,
      caseData.customerName,
      caseData.customerPhone,
      caseData.customerEmail,
      caseData.address,
      caseData.verificationType,
      caseData.applicantType,
      caseData.product,
      caseData.client,
      caseData.priority,
      caseData.status,
      caseData.assignedTo,
      caseData.assignedBy,
      caseData.createdBy,
      caseData.backendContactNumber,
      caseData.trigger,
      caseData.customerCallingCode,
      caseData.notes,
      new Date(caseData.createdAt).getTime(),
      new Date(caseData.updatedAt).getTime(),
      'pending',
      Date.now(),
      1
    ];

    await this.query(sql, params);
  }

  async getCases(filters: {
    status?: string;
    assignedTo?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<Case[]> {
    let sql = 'SELECT * FROM cases WHERE 1=1';
    const params: any[] = [];

    if (filters.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }

    if (filters.assignedTo) {
      sql += ' AND assigned_to = ?';
      params.push(filters.assignedTo);
    }

    sql += ' ORDER BY updated_at DESC';

    if (filters.limit) {
      sql += ' LIMIT ?';
      params.push(filters.limit);
      
      if (filters.offset) {
        sql += ' OFFSET ?';
        params.push(filters.offset);
      }
    }

    const result = await this.query(sql, params);
    return result.rows.raw().map(this.mapRowToCase);
  }

  async getCaseById(id: string): Promise<Case | null> {
    const result = await this.query('SELECT * FROM cases WHERE id = ?', [id]);
    if (result.rows.length === 0) return null;
    return this.mapRowToCase(result.rows.item(0));
  }

  async updateCaseStatus(id: string, status: string): Promise<void> {
    await this.query(
      'UPDATE cases SET status = ?, updated_at = ?, sync_status = ? WHERE id = ?',
      [status, Date.now(), 'pending', id]
    );

    // Add to sync queue
    await this.addSyncAction({
      actionType: 'update',
      entityType: 'case',
      entityId: id,
      actionData: JSON.stringify({ status }),
    });
  }

  // Form submission operations
  async saveFormSubmission(submission: FormSubmission): Promise<void> {
    const sql = `
      INSERT OR REPLACE INTO form_submissions (
        id, case_id, form_type, form_data, submission_time,
        location_latitude, location_longitude, location_accuracy,
        location_address, device_info, app_version, sync_status,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      submission.id,
      submission.caseId,
      submission.formType,
      JSON.stringify(submission.formData),
      submission.submissionTime,
      submission.location?.latitude,
      submission.location?.longitude,
      submission.location?.accuracy,
      submission.location?.address,
      JSON.stringify(submission.deviceInfo),
      submission.appVersion,
      'pending',
      Date.now(),
      Date.now()
    ];

    await this.query(sql, params);
  }

  async getFormSubmissions(caseId: string): Promise<FormSubmission[]> {
    const result = await this.query(
      'SELECT * FROM form_submissions WHERE case_id = ? ORDER BY submission_time DESC',
      [caseId]
    );
    
    return result.rows.raw().map(row => ({
      id: row.id,
      caseId: row.case_id,
      formType: row.form_type,
      formData: JSON.parse(row.form_data),
      submissionTime: row.submission_time,
      location: row.location_latitude ? {
        latitude: row.location_latitude,
        longitude: row.location_longitude,
        accuracy: row.location_accuracy,
        address: row.location_address,
      } : undefined,
      deviceInfo: JSON.parse(row.device_info || '{}'),
      appVersion: row.app_version,
      syncStatus: row.sync_status,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));
  }

  // Attachment operations
  async saveAttachment(attachment: Attachment): Promise<void> {
    const sql = `
      INSERT OR REPLACE INTO attachments (
        id, case_id, form_submission_id, file_name, file_type,
        file_size, file_path, thumbnail_path, compressed_path,
        upload_status, upload_progress, metadata, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      attachment.id,
      attachment.caseId,
      attachment.formSubmissionId,
      attachment.fileName,
      attachment.fileType,
      attachment.fileSize,
      attachment.filePath,
      attachment.thumbnailPath,
      attachment.compressedPath,
      attachment.uploadStatus || 'pending',
      attachment.uploadProgress || 0,
      JSON.stringify(attachment.metadata || {}),
      Date.now(),
      Date.now()
    ];

    await this.query(sql, params);
  }

  async getAttachments(caseId: string): Promise<Attachment[]> {
    const result = await this.query(
      'SELECT * FROM attachments WHERE case_id = ? ORDER BY created_at DESC',
      [caseId]
    );
    
    return result.rows.raw().map(row => ({
      id: row.id,
      caseId: row.case_id,
      formSubmissionId: row.form_submission_id,
      fileName: row.file_name,
      fileType: row.file_type,
      fileSize: row.file_size,
      filePath: row.file_path,
      thumbnailPath: row.thumbnail_path,
      compressedPath: row.compressed_path,
      uploadStatus: row.upload_status,
      uploadProgress: row.upload_progress,
      metadata: JSON.parse(row.metadata || '{}'),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));
  }

  // Sync operations
  async addSyncAction(action: Omit<SyncAction, 'id' | 'createdAt'>): Promise<void> {
    const id = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await this.query(`
      INSERT INTO sync_actions (
        id, action_type, entity_type, entity_id, action_data,
        priority, retry_count, max_retries, created_at, scheduled_at, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      action.actionType,
      action.entityType,
      action.entityId,
      action.actionData,
      action.priority || 1,
      0,
      action.maxRetries || 3,
      Date.now(),
      Date.now(),
      'pending'
    ]);
  }

  async getPendingSyncActions(limit = 50): Promise<SyncAction[]> {
    const result = await this.query(
      'SELECT * FROM sync_actions WHERE status = ? ORDER BY priority DESC, created_at ASC LIMIT ?',
      ['pending', limit]
    );
    
    return result.rows.raw().map(row => ({
      id: row.id,
      actionType: row.action_type,
      entityType: row.entity_type,
      entityId: row.entity_id,
      actionData: row.action_data,
      priority: row.priority,
      retryCount: row.retry_count,
      maxRetries: row.max_retries,
      createdAt: new Date(row.created_at),
      scheduledAt: new Date(row.scheduled_at),
      status: row.status,
    }));
  }

  async markSyncActionCompleted(id: string): Promise<void> {
    await this.query('UPDATE sync_actions SET status = ? WHERE id = ?', ['completed', id]);
  }

  async markSyncActionFailed(id: string): Promise<void> {
    await this.query(
      'UPDATE sync_actions SET status = ?, retry_count = retry_count + 1 WHERE id = ?',
      ['failed', id]
    );
  }

  // Cache operations
  async setCache(key: string, data: any, ttl = 3600000): Promise<void> {
    const expiresAt = Date.now() + ttl;
    await this.query(
      'INSERT OR REPLACE INTO cache (key, data, expires_at, created_at) VALUES (?, ?, ?, ?)',
      [key, JSON.stringify(data), expiresAt, Date.now()]
    );
  }

  async getCache<T>(key: string): Promise<T | null> {
    const result = await this.query(
      'SELECT data FROM cache WHERE key = ? AND expires_at > ?',
      [key, Date.now()]
    );
    
    if (result.rows.length === 0) return null;
    return JSON.parse(result.rows.item(0).data);
  }

  async clearExpiredCache(): Promise<void> {
    await this.query('DELETE FROM cache WHERE expires_at <= ?', [Date.now()]);
  }

  // Utility methods
  private mapRowToCase(row: any): Case {
    return {
      id: row.id,
      customerName: row.customer_name,
      customerPhone: row.customer_phone,
      customerEmail: row.customer_email,
      address: row.address,
      verificationType: row.verification_type,
      applicantType: row.applicant_type,
      product: row.product,
      client: row.client,
      priority: row.priority,
      status: row.status,
      assignedTo: row.assigned_to,
      assignedBy: row.assigned_by,
      createdBy: row.created_by,
      backendContactNumber: row.backend_contact_number,
      trigger: row.trigger_info,
      customerCallingCode: row.customer_calling_code,
      notes: row.notes,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
      this.isInitialized = false;
    }
  }

  async getDatabaseSize(): Promise<number> {
    const result = await this.query('PRAGMA page_count');
    const pageCount = result.rows.item(0).page_count;
    const pageSize = await this.query('PRAGMA page_size');
    return pageCount * pageSize.rows.item(0).page_size;
  }

  async vacuum(): Promise<void> {
    await this.query('VACUUM');
  }
}

export default EnterpriseOfflineDatabase.getInstance();
