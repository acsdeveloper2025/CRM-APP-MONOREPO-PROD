import React, { useState, useEffect } from 'react';
import { dataCleanupService, CleanupResult } from '../services/dataCleanupService';
import { useCases } from '../context/CaseContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface CleanupStats {
  lastCleanup: string;
  totalCleanupsRun: number;
  totalCasesDeleted: number;
  totalFilesDeleted: number;
  totalSpaceFreed: number;
}

const DataCleanupManager: React.FC = () => {
  const [stats, setStats] = useState<CleanupStats | null>(null);
  const [isCleanupEnabled, setIsCleanupEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [lastCleanupResult, setLastCleanupResult] = useState<CleanupResult | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [cleanupLogs, setCleanupLogs] = useState<CleanupResult[]>([]);
  const [isCacheClearing, setIsCacheClearing] = useState(false);

  const { syncCases } = useCases();

  useEffect(() => {
    loadCleanupData();
  }, []);

  const loadCleanupData = async () => {
    try {
      const [cleanupStats, enabled, logs] = await Promise.all([
        dataCleanupService.getCleanupStats(),
        dataCleanupService.isCleanupEnabled(),
        dataCleanupService.getCleanupLogs()
      ]);
      
      setStats(cleanupStats);
      setIsCleanupEnabled(enabled);
      setCleanupLogs(logs);
      
      if (logs.length > 0) {
        setLastCleanupResult(logs[logs.length - 1]);
      }
    } catch (error) {
      console.error('Failed to load cleanup data:', error);
    }
  };

  const handleManualCleanup = async () => {
    setIsLoading(true);
    try {
      const result = await dataCleanupService.manualCleanup();
      setLastCleanupResult(result);
      await loadCleanupData(); // Refresh stats
      
      if (result.success) {
        alert(`Cleanup completed!\n\nDeleted:\n- ${result.deletedCases} old cases\n- ${result.deletedFiles} files\n- ${formatBytes(result.deletedSize)} freed`);
      } else {
        alert(`Cleanup completed with errors:\n${result.errors.join('\n')}`);
      }
    } catch (error) {
      console.error('Manual cleanup failed:', error);
      alert('Cleanup failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleCleanup = async (enabled: boolean) => {
    try {
      await dataCleanupService.setCleanupEnabled(enabled);
      setIsCleanupEnabled(enabled);

      if (enabled) {
        alert('Automatic cleanup enabled. Old case data will be cleaned up daily.');
      } else {
        alert('Automatic cleanup disabled. You can still run manual cleanup.');
      }
    } catch (error) {
      console.error('Failed to toggle cleanup:', error);
      alert('Failed to update cleanup settings.');
    }
  };

  const handleClearCacheAndSync = async () => {
    setIsCacheClearing(true);
    try {
      console.log('🧹 Starting cache clear and sync...');

      // Clear case cache directly using AsyncStorage
      const keys = await AsyncStorage.getAllKeys();
      const caseKeys = keys.filter((key: string) =>
        key.startsWith('case_') ||
        key.startsWith('caseList_') ||
        key.startsWith('caseDetails_') ||
        key.startsWith('cases') ||
        key === 'LOCAL_STORAGE_KEY' // The key used by caseService
      );

      if (caseKeys.length > 0) {
        await AsyncStorage.multiRemove(caseKeys);
        console.log(`✅ ${caseKeys.length} cached cases cleared`);
      }

      console.log('✅ Cache cleared successfully');

      // Trigger fresh sync from server
      console.log('🔄 Syncing fresh data from server...');
      await syncCases();

      alert('✅ Cache cleared and fresh data synced!\n\nThe app now shows the latest data from the server.');
    } catch (error) {
      console.error('❌ Cache clear and sync failed:', error);
      alert('❌ Failed to clear cache and sync. Please try again.');
    } finally {
      setIsCacheClearing(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    if (dateString === 'Never') return 'Never';
    return new Date(dateString).toLocaleString();
  };

  const getStatusColor = (result: CleanupResult): string => {
    if (!result.success) return 'text-red-400';
    if (result.errors.length > 0) return 'text-yellow-400';
    return 'text-green-400';
  };

  const getStatusIcon = (result: CleanupResult): string => {
    if (!result.success) return '❌';
    if (result.errors.length > 0) return '⚠️';
    return '✅';
  };

  return (
    <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold text-brand-primary">🧹 Data Cleanup Manager</h3>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-400">Auto Cleanup</span>
          <button
            onClick={() => handleToggleCleanup(!isCleanupEnabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              isCleanupEnabled ? 'bg-brand-primary' : 'bg-gray-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                isCleanupEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Cleanup Statistics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gray-800/50 rounded-lg p-4">
            <div className="text-sm text-gray-400">Last Cleanup</div>
            <div className="text-lg font-semibold text-white">
              {formatDate(stats.lastCleanup)}
            </div>
          </div>
          
          <div className="bg-gray-800/50 rounded-lg p-4">
            <div className="text-sm text-gray-400">Total Cleanups</div>
            <div className="text-lg font-semibold text-white">
              {stats.totalCleanupsRun}
            </div>
          </div>
          
          <div className="bg-gray-800/50 rounded-lg p-4">
            <div className="text-sm text-gray-400">Cases Deleted</div>
            <div className="text-lg font-semibold text-white">
              {stats.totalCasesDeleted}
            </div>
          </div>
          
          <div className="bg-gray-800/50 rounded-lg p-4">
            <div className="text-sm text-gray-400">Space Freed</div>
            <div className="text-lg font-semibold text-white">
              {formatBytes(stats.totalSpaceFreed)}
            </div>
          </div>
        </div>
      )}

      {/* Cleanup Controls */}
      <div className="flex flex-col gap-4">
        {/* Primary Actions Row */}
        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={handleManualCleanup}
            disabled={isLoading || isCacheClearing}
            className="flex-1 px-4 py-2 bg-brand-primary hover:bg-brand-secondary text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? '🧹 Cleaning...' : '🧹 Run Manual Cleanup'}
          </button>

          <button
            onClick={handleClearCacheAndSync}
            disabled={isLoading || isCacheClearing}
            className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCacheClearing ? '🔄 Syncing...' : '🔄 Clear Cache & Sync'}
          </button>
        </div>

        {/* Secondary Actions Row */}
        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={() => setShowLogs(!showLogs)}
            className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-semibold transition-colors"
          >
            {showLogs ? '📋 Hide Logs' : '📋 View Cleanup Logs'}
          </button>
        </div>
      </div>

      {/* Last Cleanup Result */}
      {lastCleanupResult && (
        <div className="bg-gray-800/50 rounded-lg p-4">
          <h4 className="text-lg font-semibold text-white mb-3">Last Cleanup Result</h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Status:</span>
              <span className={`font-semibold ${getStatusColor(lastCleanupResult)}`}>
                {getStatusIcon(lastCleanupResult)} {lastCleanupResult.success ? 'Success' : 'Failed'}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Timestamp:</span>
              <span className="text-white">{formatDate(lastCleanupResult.timestamp)}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Cases Deleted:</span>
              <span className="text-white">{lastCleanupResult.deletedCases}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Files Deleted:</span>
              <span className="text-white">{lastCleanupResult.deletedFiles}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Space Freed:</span>
              <span className="text-white">{formatBytes(lastCleanupResult.deletedSize)}</span>
            </div>
            
            {lastCleanupResult.errors.length > 0 && (
              <div className="mt-3">
                <div className="text-red-400 font-semibold mb-2">Errors:</div>
                <div className="bg-red-900/20 border border-red-500/30 rounded p-2">
                  {lastCleanupResult.errors.map((error, index) => (
                    <div key={index} className="text-red-300 text-sm">{error}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cleanup Logs */}
      {showLogs && (
        <div className="bg-gray-800/50 rounded-lg p-4">
          <h4 className="text-lg font-semibold text-white mb-3">Cleanup History</h4>
          {cleanupLogs.length === 0 ? (
            <div className="text-gray-400 text-center py-4">No cleanup history available</div>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {cleanupLogs.slice().reverse().map((log, index) => (
                <div key={index} className="bg-gray-700/50 rounded p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`font-semibold ${getStatusColor(log)}`}>
                      {getStatusIcon(log)} {formatDate(log.timestamp)}
                    </span>
                    <span className="text-sm text-gray-400">
                      {log.deletedCases} cases, {log.deletedFiles} files
                    </span>
                  </div>
                  
                  {log.errors.length > 0 && (
                    <div className="text-red-300 text-xs">
                      {log.errors.length} error(s) occurred
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Information Panel */}
      <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
        <h4 className="text-blue-400 font-semibold mb-2">ℹ️ How Data Cleanup Works</h4>
        <div className="text-blue-300 text-sm space-y-1">
          <p>• <strong>Manual Cleanup:</strong> Deletes case data older than 45 days</p>
          <p>• <strong>Auto Cleanup:</strong> Runs daily at 2:00 AM to check for old data</p>
          <p>• <strong>Clear Cache & Sync:</strong> Clears all cached data and fetches fresh data from server</p>
          <p>• Cleans up: case forms, auto-saves, cached files, and temporary data</p>
          <p>• Protects currently active cases from deletion</p>
          <p>• Use "Clear Cache & Sync" if you see outdated case information</p>
        </div>
      </div>
    </div>
  );
};

export default DataCleanupManager;
