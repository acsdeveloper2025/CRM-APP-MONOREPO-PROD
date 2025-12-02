/**
 * SQLite with platform detection
 * Uses React Native SQLite for native apps, IndexedDB for web
 */

import { Capacitor } from '@capacitor/core';

// Platform detection
const isNative = Capacitor.isNativePlatform();

// Lazy load React Native SQLite only for native platforms
let RNSQLite: any = null;
if (isNative) {
  try {
    RNSQLite = require('react-native-sqlite-storage').default;
    RNSQLite.DEBUG(process.env.NODE_ENV === 'development');
    RNSQLite.enablePromise(true);
    console.log('📱 Native SQLite loaded for native platform');
  } catch (error) {
    console.warn('React Native SQLite not available, falling back to IndexedDB');
  }
}

// Web IndexedDB implementation
class WebSQLiteDatabase {
  private dbName: string;
  private db: IDBDatabase | null = null;

  constructor(dbName: string) {
    this.dbName = dbName;
  }

  async open(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        // Create object stores as needed
        if (!db.objectStoreNames.contains('data')) {
          db.createObjectStore('data', { keyPath: 'id', autoIncrement: true });
        }
      };
    });
  }

  async executeSql(sql: string, params: any[] = []): Promise<any> {
    // This is a simplified implementation
    // In a real app, you'd want to use a proper SQL-to-IndexedDB library
    console.log('🌐 Web SQLite simulation:', sql, params);
    return {
      rows: {
        length: 0,
        item: () => null,
        raw: () => []
      },
      insertId: Date.now(),
      rowsAffected: 0
    };
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

const SQLite = {
  DEBUG: (enabled: boolean) => {
    if (isNative && RNSQLite) {
      RNSQLite.DEBUG(enabled);
    } else {
      console.log(`🌐 Web SQLite debug: ${enabled}`);
    }
  },

  enablePromise: (enabled: boolean) => {
    if (isNative && RNSQLite) {
      RNSQLite.enablePromise(enabled);
    } else {
      console.log(`🌐 Web SQLite promises: ${enabled}`);
    }
  },

  openDatabase: async (config: any) => {
    if (isNative && RNSQLite) {
      return RNSQLite.openDatabase(config);
    } else {
      // Return web implementation
      const webDb = new WebSQLiteDatabase(config.name || 'default.db');
      await webDb.open(); // CRITICAL: Open the database before returning
      return {
        ...webDb,
        transaction: (callback: any) => {
          // Simplified transaction implementation
          callback({
            executeSql: webDb.executeSql.bind(webDb)
          });
        }
      };
    }
  },

  deleteDatabase: (config: any) => {
    if (isNative && RNSQLite) {
      return RNSQLite.deleteDatabase(config);
    } else {
      // Web implementation
      return new Promise((resolve) => {
        const deleteReq = indexedDB.deleteDatabase(config.name || 'default.db');
        deleteReq.onsuccess = () => resolve(true);
        deleteReq.onerror = () => resolve(false);
      });
    }
  }
};

export default SQLite;
