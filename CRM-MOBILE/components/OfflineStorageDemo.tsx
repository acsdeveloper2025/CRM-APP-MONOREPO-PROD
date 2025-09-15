import React, { useState, useEffect } from 'react';
import { attachmentService } from '../services/attachmentService';
import { offlineAttachmentService } from '../services/offlineAttachmentService';
import { secureStorageService } from '../services/secureStorageService';
import { Attachment } from '../types';

/**
 * Offline Storage Demo Component
 * Demonstrates secure offline attachment storage capabilities
 */
export const OfflineStorageDemo: React.FC = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [storageStats, setStorageStats] = useState<any>(null);
  const [offlineAttachments, setOfflineAttachments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    initializeServices();
  }, []);

  /**
   * Initialize all services
   */
  const initializeServices = async () => {
    try {
      setIsLoading(true);
      setMessage('Initializing secure storage services...');
      
      // Initialize attachment service with offline capabilities
      await attachmentService.initialize();
      
      setIsInitialized(true);
      setMessage('✅ Secure storage services initialized');
      
      // Load initial data
      await loadStorageStats();
      await loadOfflineAttachments();
      
    } catch (error) {
      console.error('❌ Failed to initialize services:', error);
      setMessage(`❌ Initialization failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Load storage statistics
   */
  const loadStorageStats = async () => {
    try {
      const stats = await attachmentService.getStorageStats();
      setStorageStats(stats);
    } catch (error) {
      console.error('❌ Failed to load storage stats:', error);
    }
  };

  /**
   * Load offline attachments
   */
  const loadOfflineAttachments = async () => {
    try {
      const attachments = await attachmentService.getOfflineAttachments();
      setOfflineAttachments(attachments);
    } catch (error) {
      console.error('❌ Failed to load offline attachments:', error);
    }
  };

  /**
   * Test encryption functionality
   */
  const testEncryption = async () => {
    try {
      setIsLoading(true);
      setMessage('🧪 Testing encryption functionality...');
      
      // Create a test attachment
      const testAttachment: Attachment = {
        id: 'test-encryption-' + Date.now(),
        name: 'Test_Encryption_Document.pdf',
        type: 'pdf',
        mimeType: 'application/pdf',
        size: 1024000,
        url: '/test-document.pdf',
        uploadedAt: new Date().toISOString(),
        uploadedBy: 'Test User'
      };

      // Download for offline access
      const success = await attachmentService.downloadAttachmentForOffline(
        testAttachment,
        'test-case-123'
      );

      if (success) {
        setMessage('✅ Encryption test successful - attachment stored securely');
        await loadStorageStats();
        await loadOfflineAttachments();
      } else {
        setMessage('❌ Encryption test failed');
      }
    } catch (error) {
      console.error('❌ Encryption test failed:', error);
      setMessage(`❌ Encryption test failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Test offline retrieval
   */
  const testOfflineRetrieval = async (attachmentId: string) => {
    try {
      setIsLoading(true);
      setMessage(`🔍 Testing offline retrieval for ${attachmentId}...`);
      
      // Set offline mode
      attachmentService.setOfflineMode(true);
      
      // Try to retrieve the attachment
      const content = await offlineAttachmentService.getOfflineAttachment(attachmentId);
      
      if (content) {
        setMessage('✅ Offline retrieval successful - content decrypted');
      } else {
        setMessage('❌ Offline retrieval failed - content not found');
      }
      
      // Reset offline mode
      attachmentService.setOfflineMode(false);
    } catch (error) {
      console.error('❌ Offline retrieval test failed:', error);
      setMessage(`❌ Offline retrieval failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Clear all offline data
   */
  const clearOfflineData = async () => {
    try {
      setIsLoading(true);
      setMessage('🧹 Clearing all offline data...');
      
      const success = await offlineAttachmentService.clearAllOfflineAttachments();
      
      if (success) {
        setMessage('✅ All offline data cleared successfully');
        await loadStorageStats();
        await loadOfflineAttachments();
      } else {
        setMessage('❌ Failed to clear offline data');
      }
    } catch (error) {
      console.error('❌ Failed to clear offline data:', error);
      setMessage(`❌ Clear failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Format file size
   */
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (!isInitialized) {
    return (
      <div className="p-6 bg-gray-900 rounded-lg">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
          <span className="text-gray-300">Initializing secure storage...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-900 rounded-lg space-y-6">
      <div className="border-b border-gray-700 pb-4">
        <h2 className="text-xl font-bold text-white mb-2">🔐 Secure Offline Storage Demo</h2>
        <p className="text-gray-400 text-sm">
          Demonstrates AES-256 encrypted attachment storage with offline capabilities
        </p>
      </div>

      {/* Status Message */}
      {message && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <p className="text-gray-300 text-sm">{message}</p>
        </div>
      )}

      {/* Storage Statistics */}
      {storageStats && (
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-white mb-3">📊 Storage Statistics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400">{storageStats.totalAttachments}</div>
              <div className="text-xs text-gray-400">Total Attachments</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">{formatFileSize(storageStats.totalSize)}</div>
              <div className="text-xs text-gray-400">Original Size</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-400">{formatFileSize(storageStats.encryptedSize)}</div>
              <div className="text-xs text-gray-400">Encrypted Size</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-400">
                {storageStats.totalSize > 0 ? Math.round((storageStats.encryptedSize / storageStats.totalSize) * 100) : 0}%
              </div>
              <div className="text-xs text-gray-400">Size Overhead</div>
            </div>
          </div>
        </div>
      )}

      {/* Test Controls */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-white mb-3">🧪 Test Controls</h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={testEncryption}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
          >
            Test Encryption
          </button>
          <button
            onClick={clearOfflineData}
            disabled={isLoading}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
          >
            Clear All Data
          </button>
          <button
            onClick={() => {
              loadStorageStats();
              loadOfflineAttachments();
            }}
            disabled={isLoading}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Offline Attachments List */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-white mb-3">📱 Offline Attachments</h3>
        {offlineAttachments.length === 0 ? (
          <p className="text-gray-400 text-center py-4">No offline attachments stored</p>
        ) : (
          <div className="space-y-2">
            {offlineAttachments.map((attachment) => (
              <div
                key={attachment.id}
                className="flex items-center justify-between bg-gray-700 rounded-lg p-3"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">
                    {attachment.type === 'pdf' ? '📄' : '🖼️'}
                  </span>
                  <div>
                    <div className="text-white font-medium">{attachment.name}</div>
                    <div className="text-gray-400 text-sm">
                      {formatFileSize(attachment.size)} • {attachment.type.toUpperCase()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-400 text-sm">🔒 Encrypted</span>
                  <button
                    onClick={() => testOfflineRetrieval(attachment.id)}
                    disabled={isLoading}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white text-sm rounded transition-colors"
                  >
                    Test Retrieval
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Security Features */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-white mb-3">🛡️ Security Features</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-green-400">✅</span>
            <span className="text-gray-300">AES-256 Encryption</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-green-400">✅</span>
            <span className="text-gray-300">Secure Key Derivation</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-green-400">✅</span>
            <span className="text-gray-300">Local Database Storage</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-green-400">✅</span>
            <span className="text-gray-300">Data Integrity Checks</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-green-400">✅</span>
            <span className="text-gray-300">Screenshot Prevention</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-green-400">✅</span>
            <span className="text-gray-300">Secure Memory Cleanup</span>
          </div>
        </div>
      </div>
    </div>
  );
};
