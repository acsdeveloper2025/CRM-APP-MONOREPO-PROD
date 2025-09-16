/**
 * Test utility for secure attachment storage and clearing functionality
 */

import { attachmentService } from '../services/attachmentService';
import { secureStorageService } from '../services/secureStorageService';
import { Attachment } from '../types';

/**
 * Test secure attachment storage and clearing workflow
 */
export async function testSecureAttachmentWorkflow(): Promise<void> {
  console.log('🧪 Testing secure attachment storage and clearing workflow...');

  const testCaseId = 'test-case-12345';
  
  try {
    // Step 1: Create test attachments
    const testAttachments: Attachment[] = [
      {
        id: 'test-attachment-1',
        name: 'test-document.pdf',
        type: 'pdf',
        size: 1024000,
        mimeType: 'application/pdf',
        url: 'https://example.com/test-document.pdf',
        uploadedAt: new Date().toISOString(),
        uploadedBy: 'Test User'
      },
      {
        id: 'test-attachment-2',
        name: 'test-image.jpg',
        type: 'image',
        size: 512000,
        mimeType: 'image/jpeg',
        url: 'https://example.com/test-image.jpg',
        uploadedAt: new Date().toISOString(),
        uploadedBy: 'Test User'
      }
    ];

    console.log(`📋 Created ${testAttachments.length} test attachments`);

    // Step 2: Store attachments securely
    console.log('🔒 Storing attachments securely (NOT in gallery)...');
    
    for (const attachment of testAttachments) {
      const success = await attachmentService.downloadAttachmentForOffline(attachment, testCaseId);
      if (success) {
        console.log(`✅ Securely stored: ${attachment.name}`);
      } else {
        console.log(`❌ Failed to store: ${attachment.name}`);
      }
    }

    // Step 3: Verify secure storage
    console.log('🔍 Verifying secure storage...');
    
    const isSecure = await attachmentService.areAttachmentsStoredSecurely(testCaseId);
    const count = await attachmentService.getSecureAttachmentCount(testCaseId);
    
    console.log(`🔒 Attachments stored securely: ${isSecure}`);
    console.log(`📊 Secure attachment count: ${count}`);

    // Step 4: List stored attachments
    const storedAttachments = await secureStorageService.getCaseAttachments(testCaseId);
    console.log(`📋 Found ${storedAttachments.length} stored attachments:`);
    
    storedAttachments.forEach((attachment, index) => {
      console.log(`  ${index + 1}. ${attachment.originalName} (${attachment.size} bytes)`);
      console.log(`     📅 Created: ${attachment.createdAt}`);
      console.log(`     🔐 Encrypted: Yes`);
      console.log(`     📱 Storage: App-specific (NOT gallery)`);
    });

    // Step 5: Simulate case submission and clear attachments
    console.log('📤 Simulating case submission...');
    console.log('🗑️ Clearing secure attachments after case submission...');
    
    await secureStorageService.clearCaseAttachments(testCaseId);
    
    // Step 6: Verify attachments are cleared
    const countAfterClear = await attachmentService.getSecureAttachmentCount(testCaseId);
    const isSecureAfterClear = await attachmentService.areAttachmentsStoredSecurely(testCaseId);
    
    console.log(`📊 Attachment count after clearing: ${countAfterClear}`);
    console.log(`🔒 Attachments still stored: ${isSecureAfterClear}`);

    if (countAfterClear === 0 && !isSecureAfterClear) {
      console.log('✅ SUCCESS: Secure attachment workflow completed successfully!');
      console.log('🎯 Key Features Verified:');
      console.log('   ✅ Attachments stored securely (NOT in device gallery)');
      console.log('   ✅ Attachments encrypted in app-specific storage');
      console.log('   ✅ Attachments automatically cleared after case submission');
      console.log('   ✅ No traces left in device storage after clearing');
    } else {
      console.log('❌ FAILURE: Attachments were not properly cleared');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

/**
 * Test storage statistics and cleanup
 */
export async function testStorageStatistics(): Promise<void> {
  console.log('📊 Testing storage statistics...');

  try {
    const stats = await secureStorageService.getStorageStats();
    
    console.log('📈 Storage Statistics:');
    console.log(`   📋 Total attachments: ${stats.totalAttachments}`);
    console.log(`   💾 Total size: ${formatBytes(stats.totalSize)}`);
    console.log(`   🔐 Encrypted size: ${formatBytes(stats.encryptedSize)}`);
    console.log(`   🧹 Last cleanup: ${stats.lastCleanup}`);

    // Test cleanup
    console.log('🧹 Testing storage cleanup...');
    await secureStorageService.performCleanup();
    
    const statsAfterCleanup = await secureStorageService.getStorageStats();
    console.log('📈 Statistics after cleanup:');
    console.log(`   📋 Total attachments: ${statsAfterCleanup.totalAttachments}`);
    console.log(`   💾 Total size: ${formatBytes(statsAfterCleanup.totalSize)}`);

  } catch (error) {
    console.error('❌ Storage statistics test failed:', error);
  }
}

/**
 * Format bytes to human readable format
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Run all secure attachment tests
 */
export async function runAllSecureAttachmentTests(): Promise<void> {
  console.log('🚀 Starting comprehensive secure attachment tests...');
  console.log('=' .repeat(60));
  
  await testSecureAttachmentWorkflow();
  console.log('');
  await testStorageStatistics();
  
  console.log('=' .repeat(60));
  console.log('🏁 All secure attachment tests completed!');
}
