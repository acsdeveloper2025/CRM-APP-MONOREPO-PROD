# Secure Attachment Storage System

## Overview

The CRM Mobile application implements a comprehensive secure attachment storage system that ensures:

1. **Secure Storage**: Attachments are stored in encrypted, app-specific storage (NOT in device gallery)
2. **Automatic Cleanup**: Attachments are automatically cleared from local storage after case submission
3. **Privacy Protection**: No traces of sensitive documents remain on the device after case completion

## Key Features

### 🔒 Secure Storage (Not in Gallery)

- **Encrypted Storage**: All attachments are encrypted using AES-256 encryption
- **App-Specific Location**: Files stored in app's private storage, not accessible by other apps
- **No Gallery Access**: Attachments never appear in device photo gallery or file manager
- **Integrity Checking**: SHA-256 checksums ensure data integrity

### 🗑️ Automatic Cleanup After Case Submission

- **Triggered on Submission**: Attachments automatically cleared when case is successfully submitted
- **Complete Removal**: Both encrypted data and metadata are removed
- **Cache Clearing**: In-memory cache is also cleared
- **Storage Statistics Update**: Storage usage statistics are updated after cleanup

### 🔐 Security Implementation

```typescript
// Secure storage with encryption
await secureStorageService.storeAttachment(
  attachmentId,
  encryptedContent,
  {
    originalName: 'document.pdf',
    mimeType: 'application/pdf',
    size: 1024000,
    caseId: 'case-123'
  }
);

// Automatic cleanup after case submission
await secureStorageService.clearCaseAttachments(caseId);
```

## Architecture

### Services Involved

1. **AttachmentService** (`services/attachmentService.ts`)
   - Handles attachment viewing and downloading
   - Generates secure content for in-app viewing
   - Manages offline storage requests

2. **SecureStorageService** (`services/secureStorageService.ts`)
   - Encrypts and stores attachment data
   - Manages case-specific attachment collections
   - Handles cleanup and storage statistics

3. **VerificationFormService** (`services/verificationFormService.ts`)
   - Triggers attachment cleanup after successful case submission
   - Integrates with form submission workflow

### Storage Structure

```
App Private Storage:
├── caseflow_attachment_{id}     # Encrypted attachment data
├── caseflow_metadata_{id}       # Encrypted metadata
└── caseflow_storage_stats       # Storage statistics
```

### Encryption Details

- **Algorithm**: AES-256-GCM
- **Key Derivation**: PBKDF2 with random salt
- **Integrity**: SHA-256 checksums
- **Metadata**: Encrypted separately from content

## Usage Examples

### Storing Attachments Securely

```typescript
import { attachmentService } from '../services/attachmentService';

// Download and store attachment securely
const success = await attachmentService.downloadAttachmentForOffline(
  attachment,
  caseId
);

// Check if attachments are stored securely
const isSecure = await attachmentService.areAttachmentsStoredSecurely(caseId);
const count = await attachmentService.getSecureAttachmentCount(caseId);
```

### Automatic Cleanup on Case Submission

```typescript
// This happens automatically in VerificationFormService
// when a case is successfully submitted:

if (result.success) {
  // Clear secure attachments after successful case submission
  await secureStorageService.clearCaseAttachments(caseId);
  console.log(`✅ Secure attachments cleared for case: ${caseId}`);
}
```

### Manual Cleanup (if needed)

```typescript
import { secureStorageService } from '../services/secureStorageService';

// Get attachments for a case
const attachments = await secureStorageService.getCaseAttachments(caseId);

// Clear all attachments for a case
await secureStorageService.clearCaseAttachments(caseId);

// Get storage statistics
const stats = await secureStorageService.getStorageStats();
```

## Security Benefits

### 1. Privacy Protection
- Sensitive documents never stored in accessible locations
- No traces in device gallery or file manager
- Encrypted storage prevents unauthorized access

### 2. Compliance
- Meets data protection requirements
- Automatic cleanup ensures data minimization
- Audit trail for storage operations

### 3. Performance
- Efficient encryption/decryption
- Memory-conscious caching
- Automatic cleanup prevents storage bloat

## Testing

Use the test utility to verify secure attachment functionality:

```typescript
import { runAllSecureAttachmentTests } from '../utils/testSecureAttachments';

// Run comprehensive tests
await runAllSecureAttachmentTests();
```

## Configuration

### Environment Variables

```env
# Storage limits
VITE_MAX_ATTACHMENT_SIZE=10485760  # 10MB
VITE_MAX_ATTACHMENTS_PER_CASE=15

# Security settings
VITE_ENCRYPTION_ENABLED=true
VITE_AUTO_CLEANUP_ENABLED=true
```

### Storage Limits

- **Max File Size**: 10MB per attachment
- **Max Attachments**: 15 per case
- **Cache Duration**: 30 minutes
- **Total Cache Limit**: 50MB

## Monitoring

### Storage Statistics

The system tracks:
- Total number of stored attachments
- Total storage size used
- Encrypted storage overhead
- Last cleanup timestamp

### Logging

All operations are logged with appropriate levels:
- **INFO**: Normal operations (store, retrieve, cleanup)
- **WARN**: Non-critical failures (cleanup failures)
- **ERROR**: Critical failures (encryption errors)

## Best Practices

1. **Always Use Secure Storage**: Never store sensitive attachments in regular file system
2. **Verify Cleanup**: Check that attachments are cleared after case submission
3. **Monitor Storage**: Regularly check storage statistics to prevent bloat
4. **Test Regularly**: Use provided test utilities to verify functionality
5. **Handle Errors Gracefully**: Cleanup failures shouldn't prevent case submission

## Troubleshooting

### Common Issues

1. **Attachments Not Clearing**: Check if case submission was successful
2. **Storage Full**: Monitor storage statistics and perform manual cleanup if needed
3. **Encryption Errors**: Verify Web Crypto API availability
4. **Performance Issues**: Check cache size and cleanup frequency

### Debug Commands

```typescript
// Check storage status
const stats = await secureStorageService.getStorageStats();

// Manual cleanup
await secureStorageService.performCleanup();

// Test functionality
await runAllSecureAttachmentTests();
```
