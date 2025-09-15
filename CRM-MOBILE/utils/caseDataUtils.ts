/**
 * Case Data Utilities for CaseFlow Mobile
 * Handles identification and management of case-related data
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { CaseStatus } from '../types';

// Utility function to safely get product name
export const getProductName = (product: string | { id: number; name: string; code: string } | undefined): string => {
  if (!product) return 'N/A';
  if (typeof product === 'string') return product;
  return product.name || 'N/A';
};

export interface CaseDataInfo {
  key: string;
  caseId: string;
  type: 'case' | 'draft' | 'autosave' | 'verification' | 'temp';
  timestamp: string;
  status?: CaseStatus;
  size: number;
  isActive: boolean;
}

/**
 * Get all case-related storage keys
 */
export async function getAllCaseKeys(): Promise<string[]> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    return allKeys.filter(key => 
      key.startsWith('case_') || 
      key.startsWith('draft_') ||
      key.startsWith('autosave_') ||
      key.startsWith('verification_') ||
      key.includes('_case_') ||
      key.includes('_draft_') ||
      key.includes('_temp_')
    );
  } catch (error) {
    console.error('Failed to get case keys:', error);
    return [];
  }
}

/**
 * Analyze case data from storage key
 */
export async function analyzeCaseData(key: string): Promise<CaseDataInfo | null> {
  try {
    const data = await AsyncStorage.getItem(key);
    if (!data) return null;

    const parsedData = JSON.parse(data);
    const dataSize = new Blob([data]).size;

    // Determine data type
    let type: CaseDataInfo['type'] = 'case';
    if (key.startsWith('draft_')) type = 'draft';
    else if (key.startsWith('autosave_')) type = 'autosave';
    else if (key.startsWith('verification_')) type = 'verification';
    else if (key.includes('_temp_')) type = 'temp';

    // Extract case ID
    let caseId = '';
    if (parsedData.caseId) {
      caseId = parsedData.caseId;
    } else if (parsedData.id) {
      caseId = parsedData.id;
    } else {
      // Try to extract from key
      const matches = key.match(/case_(.+?)_/);
      caseId = matches ? matches[1] : key;
    }

    // Get timestamp
    const timestamp = parsedData.timestamp || 
                     parsedData.lastModified || 
                     parsedData.createdAt || 
                     parsedData.lastSaved ||
                     new Date().toISOString();

    // Check if case is currently active (in progress)
    const isActive = parsedData.status === CaseStatus.InProgress ||
                    parsedData.isActive === true ||
                    (type === 'autosave' && isRecentData(timestamp));

    return {
      key,
      caseId,
      type,
      timestamp,
      status: parsedData.status,
      size: dataSize,
      isActive
    };
  } catch (error) {
    console.error(`Failed to analyze case data for key ${key}:`, error);
    return null;
  }
}

/**
 * Check if data is recent (within last 24 hours)
 */
function isRecentData(timestamp: string): boolean {
  try {
    const dataDate = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - dataDate.getTime()) / (1000 * 60 * 60);
    return diffInHours < 24;
  } catch {
    return false;
  }
}

/**
 * Get all case data information
 */
export async function getAllCaseDataInfo(): Promise<CaseDataInfo[]> {
  const keys = await getAllCaseKeys();
  const caseDataInfos: CaseDataInfo[] = [];

  for (const key of keys) {
    const info = await analyzeCaseData(key);
    if (info) {
      caseDataInfos.push(info);
    }
  }

  return caseDataInfos;
}

/**
 * Get expired case data (older than specified days)
 */
export async function getExpiredCaseData(retentionDays: number): Promise<CaseDataInfo[]> {
  const allCaseData = await getAllCaseDataInfo();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  return allCaseData.filter(caseData => {
    try {
      const dataDate = new Date(caseData.timestamp);
      return dataDate < cutoffDate && !caseData.isActive;
    } catch {
      return false;
    }
  });
}

/**
 * Get case data by status
 */
export async function getCaseDataByStatus(status: CaseStatus): Promise<CaseDataInfo[]> {
  const allCaseData = await getAllCaseDataInfo();
  return allCaseData.filter(caseData => caseData.status === status);
}

/**
 * Get case data by type
 */
export async function getCaseDataByType(type: CaseDataInfo['type']): Promise<CaseDataInfo[]> {
  const allCaseData = await getAllCaseDataInfo();
  return allCaseData.filter(caseData => caseData.type === type);
}

/**
 * Get active cases (currently being worked on)
 */
export async function getActiveCases(): Promise<CaseDataInfo[]> {
  const allCaseData = await getAllCaseDataInfo();
  return allCaseData.filter(caseData => caseData.isActive);
}

/**
 * Calculate total storage usage by case data
 */
export async function calculateCaseDataUsage(): Promise<{
  totalSize: number;
  caseCount: number;
  byType: Record<CaseDataInfo['type'], { count: number; size: number }>;
  byStatus: Record<string, { count: number; size: number }>;
}> {
  const allCaseData = await getAllCaseDataInfo();
  
  const result = {
    totalSize: 0,
    caseCount: allCaseData.length,
    byType: {} as Record<CaseDataInfo['type'], { count: number; size: number }>,
    byStatus: {} as Record<string, { count: number; size: number }>
  };

  // Initialize type counters
  const types: CaseDataInfo['type'][] = ['case', 'draft', 'autosave', 'verification', 'temp'];
  types.forEach(type => {
    result.byType[type] = { count: 0, size: 0 };
  });

  // Process each case data
  allCaseData.forEach(caseData => {
    result.totalSize += caseData.size;
    
    // Count by type
    result.byType[caseData.type].count++;
    result.byType[caseData.type].size += caseData.size;
    
    // Count by status
    const status = caseData.status || 'unknown';
    if (!result.byStatus[status]) {
      result.byStatus[status] = { count: 0, size: 0 };
    }
    result.byStatus[status].count++;
    result.byStatus[status].size += caseData.size;
  });

  return result;
}

/**
 * Safe delete case data (with validation)
 */
export async function safeDeleteCaseData(caseDataInfo: CaseDataInfo): Promise<boolean> {
  try {
    // Double-check that the case is not active
    if (caseDataInfo.isActive) {
      console.warn(`Attempted to delete active case data: ${caseDataInfo.key}`);
      return false;
    }

    // Additional safety check for recent data
    if (isRecentData(caseDataInfo.timestamp)) {
      console.warn(`Attempted to delete recent case data: ${caseDataInfo.key}`);
      return false;
    }

    await AsyncStorage.removeItem(caseDataInfo.key);
    console.log(`✅ Safely deleted case data: ${caseDataInfo.key}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to delete case data ${caseDataInfo.key}:`, error);
    return false;
  }
}

/**
 * Bulk delete case data
 */
export async function bulkDeleteCaseData(caseDataInfos: CaseDataInfo[]): Promise<{
  deleted: number;
  failed: number;
  errors: string[];
}> {
  const result = {
    deleted: 0,
    failed: 0,
    errors: [] as string[]
  };

  for (const caseData of caseDataInfos) {
    const success = await safeDeleteCaseData(caseData);
    if (success) {
      result.deleted++;
    } else {
      result.failed++;
      result.errors.push(`Failed to delete: ${caseData.key}`);
    }
  }

  return result;
}

/**
 * Get case data summary for cleanup reporting
 */
export async function getCaseDataSummary(): Promise<{
  total: number;
  active: number;
  expired: number;
  byTab: {
    assigned: number;
    inProgress: number;
    completed: number;
    saved: number;
  };
  totalSize: number;
  expiredSize: number;
}> {
  const allCaseData = await getAllCaseDataInfo();
  const expiredData = await getExpiredCaseData(45); // 45 days retention
  const activeCases = await getActiveCases();
  
  const byTab = {
    assigned: 0,
    inProgress: 0,
    completed: 0,
    saved: 0
  };

  // Count by status/tab
  allCaseData.forEach(caseData => {
    switch (caseData.status) {
      case CaseStatus.Assigned:
        byTab.assigned++;
        break;
      case CaseStatus.InProgress:
        byTab.inProgress++;
        break;
      case CaseStatus.Completed:
        byTab.completed++;
        break;
      case CaseStatus.Saved:
        byTab.saved++;
        break;
    }
  });

  return {
    total: allCaseData.length,
    active: activeCases.length,
    expired: expiredData.length,
    byTab,
    totalSize: allCaseData.reduce((sum, data) => sum + data.size, 0),
    expiredSize: expiredData.reduce((sum, data) => sum + data.size, 0)
  };
}

/**
 * Validate case data integrity
 */
export async function validateCaseDataIntegrity(): Promise<{
  valid: number;
  corrupted: number;
  missing: number;
  corruptedKeys: string[];
}> {
  const keys = await getAllCaseKeys();
  const result = {
    valid: 0,
    corrupted: 0,
    missing: 0,
    corruptedKeys: [] as string[]
  };

  for (const key of keys) {
    try {
      const data = await AsyncStorage.getItem(key);
      if (!data) {
        result.missing++;
        continue;
      }

      JSON.parse(data); // Test if data is valid JSON
      result.valid++;
    } catch (error) {
      result.corrupted++;
      result.corruptedKeys.push(key);
    }
  }

  return result;
}

/**
 * Clean up corrupted case data
 */
export async function cleanupCorruptedData(): Promise<number> {
  const integrity = await validateCaseDataIntegrity();
  let cleaned = 0;

  for (const key of integrity.corruptedKeys) {
    try {
      await AsyncStorage.removeItem(key);
      cleaned++;
      console.log(`🗑️ Cleaned up corrupted data: ${key}`);
    } catch (error) {
      console.error(`Failed to clean up corrupted data ${key}:`, error);
    }
  }

  return cleaned;
}
