import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';

// Define the custom element for web
if (!Capacitor.isNativePlatform()) {
  // Dynamically import and define jeep-sqlite for web
  import('jeep-sqlite/loader').then(module => {
    module.defineCustomElements(window);
  });
}

export class SQLiteService {
  private static instance: SQLiteService;
  private sqlite: SQLiteConnection;
  private db: SQLiteDBConnection | null = null;
  private isInitialized = false;

  private constructor() {
    this.sqlite = new SQLiteConnection(CapacitorSQLite);
  }

  static getInstance(): SQLiteService {
    if (!SQLiteService.instance) {
      SQLiteService.instance = new SQLiteService();
    }
    return SQLiteService.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Initialize web store if not native
      if (!Capacitor.isNativePlatform()) {
        const jeepSqlite = document.createElement('jeep-sqlite');
        document.body.appendChild(jeepSqlite);
        await customElements.whenDefined('jeep-sqlite');
        await this.sqlite.initWebStore();
      }

      this.isInitialized = true;
      console.log('✅ SQLiteService initialized');
    } catch (error) {
      console.error('❌ Failed to initialize SQLiteService:', error);
      throw error;
    }
  }

  async openDatabase(dbName: string, encrypted: boolean = false, mode: string = 'no-encryption', version: number = 1): Promise<void> {
    try {
      // Check if connection exists
      const isConn = (await this.sqlite.isConnection(dbName, false)).result;
      
      if (isConn) {
        this.db = await this.sqlite.retrieveConnection(dbName, false);
      } else {
        this.db = await this.sqlite.createConnection(dbName, encrypted, mode, version, false);
      }

      await this.db.open();
      console.log(`✅ Database ${dbName} opened`);
    } catch (error) {
      console.error(`❌ Failed to open database ${dbName}:`, error);
      throw error;
    }
  }

  async execute(sql: string): Promise<void> {
    if (!this.db) throw new Error('Database not open');
    await this.db.execute(sql);
  }

  async run(sql: string, values: any[] = []): Promise<any> {
    if (!this.db) throw new Error('Database not open');
    return await this.db.run(sql, values);
  }

  async query(sql: string, values: any[] = []): Promise<any[]> {
    if (!this.db) throw new Error('Database not open');
    const result = await this.db.query(sql, values);
    return result.values || [];
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
    }
  }

  async saveToStore(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      await this.sqlite.saveToStore(this.db?.getConnectionDBName() || 'default');
    }
  }
}
