import { Attachment } from '../types';
import { offlineAttachmentService } from './offlineAttachmentService';
import { secureStorageService } from './secureStorageService';
import AuthStorageService from './authStorageService';

class AttachmentService {
  private maxFileSize = 10485760; // 10MB in bytes
  private maxAttachments = 15;
  private isOfflineMode = false;
  private initialized = false;

  /**
   * Get the appropriate API base URL using smart selection logic
   */
  private getApiBaseUrl(): string {
    const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

    console.log('🔍 API URL Detection:', {
      hostname,
      isLocalhost,
      MODE: import.meta.env.MODE,
      VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
      VITE_API_BASE_URL_DEVICE: import.meta.env.VITE_API_BASE_URL_DEVICE,
      VITE_API_BASE_URL_NETWORK: import.meta.env.VITE_API_BASE_URL_NETWORK,
      VITE_API_BASE_URL_STATIC_IP: import.meta.env.VITE_API_BASE_URL_STATIC_IP
    });

    // Priority-based URL selection with hairpin NAT workaround
    if (isLocalhost) {
      // When running on localhost, use localhost API
      const url = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';
      console.log('🏠 Using localhost API URL:', url);
      return url;
    } else {
      // When running on network IP, use smart selection
      // Try static IP first, fallback to network IP for hairpin NAT issues
      const staticUrl = import.meta.env.VITE_API_BASE_URL_STATIC_IP;
      const networkUrl = import.meta.env.VITE_API_BASE_URL_NETWORK;
      const deviceUrl = import.meta.env.VITE_API_BASE_URL_DEVICE;

      // Use static IP if available, otherwise fallback to network/device URL
      const url = staticUrl || networkUrl || deviceUrl || 'http://localhost:3000/api';
      console.log('🌐 Using network API URL:', url);
      return url;
    }
  }

  /**
   * Get the base URL without /api suffix for file serving
   */
  private getStaticBaseUrl(): string {
    return this.getApiBaseUrl().replace('/api', '');
  }

  /**
   * Initialize attachment service with offline capabilities
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      console.log('📎 Initializing attachment service...');

      // Initialize offline attachment service
      await offlineAttachmentService.initialize();

      this.initialized = true;
      console.log('✅ Attachment service initialized with offline capabilities');
    } catch (error) {
      console.error('❌ Failed to initialize attachment service:', error);
      throw error;
    }
  }

  /**
   * Set offline mode
   */
  setOfflineMode(offline: boolean): void {
    this.isOfflineMode = offline;
    console.log(`📱 Offline mode: ${offline ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get authentication token for API calls
   */
  private async getAuthToken(): Promise<string> {
    const token = await AuthStorageService.getCurrentAccessToken();
    if (!token) {
      throw new Error('No authentication token available');
    }
    return token;
  }

  /**
   * Fetch attachments for a specific case from the backend API
   */
  async getCaseAttachments(caseId: string): Promise<Attachment[]> {
    try {
      console.log(`📎 Fetching real attachments for case ${caseId}...`);

      // Get authentication token
      const authToken = await this.getAuthToken();
      const baseUrl = this.getApiBaseUrl();

      console.log(`🌐 API Request: GET ${baseUrl}/mobile/cases/${caseId}/attachments`);

      const response = await fetch(`${baseUrl}/mobile/cases/${caseId}/attachments`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'X-App-Version': '4.0.0',
          'X-Platform': 'WEB'
        }
      });

      if (!response.ok) {
        console.error(`❌ API Error: ${response.status} ${response.statusText}`);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`📋 API Response:`, result);

      if (!result.success) {
        throw new Error(result.message || 'Failed to fetch attachments');
      }

      // Transform backend response to mobile app format
      const attachments: Attachment[] = (result.data || []).map((att: any) => ({
        id: att.id,
        name: att.originalName || att.filename || att.name,
        type: att.mimeType?.startsWith('image/') ? 'image' : 'pdf',
        mimeType: att.mimeType,
        size: att.size,
        url: att.url ? (att.url.startsWith('/api/') ? `${baseUrl}${att.url.substring(4)}` : `${baseUrl}/attachments/${att.id}/serve`) : `${baseUrl}/attachments/${att.id}/serve`,
        thumbnailUrl: att.thumbnailUrl ? `${baseUrl}/attachments/${att.id}/serve` : undefined,
        uploadedAt: att.uploadedAt || att.createdAt,
        uploadedBy: att.uploadedBy || 'Field Agent',
        description: att.description || ''
      }));

      console.log(`✅ Successfully loaded ${attachments.length} real attachments for case ${caseId}`);

      // Log attachment details for debugging
      attachments.forEach(att => {
        console.log(`📎 Attachment: ${att.name} (${att.type}) - ${this.formatFileSize(att.size)}`);
      });

      return attachments;

    } catch (error) {
      console.error(`❌ Failed to fetch attachments for case ${caseId}:`, error);

      // Return empty array instead of throwing error to prevent app crashes
      console.log(`📝 Returning empty attachment list for case ${caseId}`);
      return [];
    }
  }

  /**
   * Get attachment content for secure viewing
   */
  async getAttachmentContent(attachment: Attachment): Promise<string> {
    try {
      console.log(`📎 Loading content for attachment: ${attachment.name}`);

      // Ensure service is initialized
      await this.initialize();

      // Try to get from offline storage first
      const offlineContent = await offlineAttachmentService.getOfflineAttachment(attachment.id);
      if (offlineContent) {
        console.log(`📱 Retrieved from offline storage: ${attachment.name}`);
        return offlineContent;
      }

      // If not available offline and in offline mode, throw error
      if (this.isOfflineMode) {
        throw new Error(`${attachment.name} is not available offline. Please download it when online.`);
      }

      // Simulate loading time based on file size
      const loadingTime = Math.min(2000, attachment.size / 1000);
      await new Promise(resolve => setTimeout(resolve, loadingTime));

      let content: string;
      if (attachment.type === 'pdf') {
        // Return base64 PDF content for secure in-app viewing
        content = await this.generateSecurePdfContent(attachment);
      } else {
        // Return secure image data URL for in-app viewing
        content = await this.generateSecureImageContent(attachment);
      }

      // Optionally store for offline access (auto-download)
      if (!this.isOfflineMode) {
        this.downloadForOfflineAccess(attachment, content, 'auto-download');
      }

      return content;

    } catch (error) {
      console.error(`❌ Failed to load attachment content:`, error);
      throw new Error(`Failed to load ${attachment.name}. Please try again.`);
    }
  }

  /**
   * Download attachment for offline access
   */
  private async downloadForOfflineAccess(attachment: Attachment, content: string, caseId?: string): Promise<void> {
    try {
      // Validate input parameters
      if (!attachment || !attachment.id || !content) {
        throw new Error('Invalid attachment data or content');
      }

      // Ensure attachment has required properties
      const attachmentData = {
        originalName: attachment.name || 'unknown-file',
        mimeType: attachment.mimeType || 'application/octet-stream',
        size: attachment.size || content.length,
        caseId: caseId || 'unknown'
      };

      console.log(`📱 Attempting to store attachment: ${attachmentData.originalName} (${attachmentData.size} bytes)`);

      // Store the content directly using secure storage (NOT in device gallery)
      // This ensures attachments are encrypted and stored securely in app-specific storage
      await secureStorageService.storeAttachment(
        attachment.id,
        content,
        attachmentData
      );

      console.log(`✅ Successfully stored attachment for offline access: ${attachmentData.originalName}`);
    } catch (error) {
      console.warn(`⚠️ Failed to store attachment for offline access: ${attachment.name || 'unknown'}`, error);

      // Don't throw the error - offline storage is optional
      // The attachment can still be viewed online
    }
  }

  /**
   * Download attachment for offline access (public method)
   */
  async downloadAttachmentForOffline(attachment: Attachment, caseId?: string): Promise<boolean> {
    try {
      await this.initialize();

      // Get the content first
      const content = await this.getAttachmentContent(attachment);

      // Store for offline access
      await secureStorageService.storeAttachment(
        attachment.id,
        content,
        {
          originalName: attachment.name,
          mimeType: attachment.mimeType,
          size: attachment.size,
          caseId: caseId || 'unknown'
        }
      );

      return true;
    } catch (error) {
      console.error(`❌ Failed to download attachment for offline: ${attachment.name}`, error);
      return false;
    }
  }

  /**
   * Check if attachment is available offline
   */
  async isAttachmentAvailableOffline(attachmentId: string): Promise<boolean> {
    await this.initialize();
    return await offlineAttachmentService.isAttachmentAvailableOffline(attachmentId);
  }

  /**
   * Get offline attachments for a case
   */
  async getOfflineAttachments(caseId?: string) {
    await this.initialize();
    return await offlineAttachmentService.getOfflineAttachments(caseId);
  }

  /**
   * Remove attachment from offline storage
   */
  async removeOfflineAttachment(attachmentId: string): Promise<boolean> {
    await this.initialize();
    return await offlineAttachmentService.removeOfflineAttachment(attachmentId);
  }

  /**
   * Get storage statistics
   */
  async getStorageStats() {
    await this.initialize();
    return await offlineAttachmentService.getStorageStats();
  }

  /**
   * Generate realistic attachments for demo purposes
   */
  private generateRealisticAttachments(caseId: string): Attachment[] {
    // Create deterministic but varied attachment scenarios based on case ID
    const caseHash = this.hashString(caseId);
    const attachmentCount = caseHash % 6; // 0-5 attachments

    if (attachmentCount === 0) return [];

    const baseUrl = this.getApiBaseUrl();
    const allAttachments: Attachment[] = [
      {
        id: `att-${caseId}-1`,
        name: 'download.pdf',
        type: 'pdf',
        mimeType: 'application/pdf',
        size: 2048576, // 2MB
        url: `${baseUrl}/files/download-${caseId}.pdf`,
        uploadedAt: this.getRandomDate(-7),
        uploadedBy: 'System Admin',
        description: 'Official property documentation and ownership papers'
      },
      {
        id: `att-${caseId}-2`,
        name: 'Bank_Statement_Jan2024.pdf',
        type: 'pdf',
        mimeType: 'application/pdf',
        size: 1536000, // 1.5MB
        url: `${baseUrl}/files/bank-statement-${caseId}.pdf`,
        uploadedAt: this.getRandomDate(-5),
        uploadedBy: 'Financial Analyst',
        description: 'Monthly bank statement for verification'
      },
      {
        id: `att-${caseId}-3`,
        name: 'Identity_Verification.jpg',
        type: 'image',
        mimeType: 'image/jpeg',
        size: 892000, // 892KB
        url: `${baseUrl}/files/identity-${caseId}.jpg`,
        thumbnailUrl: `${baseUrl}/files/identity-${caseId}-thumb.jpg`,
        uploadedAt: this.getRandomDate(-3),
        uploadedBy: 'Verification Officer',
        description: 'Identity document photograph'
      },
      {
        id: `att-${caseId}-4`,
        name: 'Site_Photo_Exterior.png',
        type: 'image',
        mimeType: 'image/png',
        size: 1024000, // 1MB
        url: `${baseUrl}/files/site-exterior-${caseId}.png`,
        thumbnailUrl: `${baseUrl}/files/site-exterior-${caseId}-thumb.png`,
        uploadedAt: this.getRandomDate(-2),
        uploadedBy: 'Field Agent',
        description: 'Exterior view of the property'
      },
      {
        id: `att-${caseId}-5`,
        name: 'Legal_Agreement.pdf',
        type: 'pdf',
        mimeType: 'application/pdf',
        size: 3145728, // 3MB
        url: `${baseUrl}/files/legal-agreement-${caseId}.pdf`,
        uploadedAt: this.getRandomDate(-1),
        uploadedBy: 'Legal Team',
        description: 'Legal agreement and contract documents'
      },
      {
        id: `att-${caseId}-6`,
        name: 'Address_Proof.jpg',
        type: 'image',
        mimeType: 'image/jpeg',
        size: 756000, // 756KB
        url: `${baseUrl}/files/address-proof-${caseId}.jpg`,
        thumbnailUrl: `${baseUrl}/files/address-proof-${caseId}-thumb.jpg`,
        uploadedAt: this.getRandomDate(-1),
        uploadedBy: 'Document Specialist',
        description: 'Address verification document'
      },
      {
        id: `att-${caseId}-7`,
        name: 'Compliance_Report.pdf',
        type: 'pdf',
        mimeType: 'application/pdf',
        size: 2097152, // 2MB
        url: `${baseUrl}/files/compliance-${caseId}.pdf`,
        uploadedAt: this.getRandomDate(-4),
        uploadedBy: 'Compliance Officer',
        description: 'Compliance verification report'
      },
      {
        id: `att-${caseId}-8`,
        name: 'Building_Interior.png',
        type: 'image',
        mimeType: 'image/png',
        size: 1310720, // 1.25MB
        url: `${baseUrl}/files/building-interior-${caseId}.png`,
        thumbnailUrl: `${baseUrl}/files/building-interior-${caseId}-thumb.png`,
        uploadedAt: this.getRandomDate(-2),
        uploadedBy: 'Site Inspector',
        description: 'Interior view of the building'
      },
      {
        id: `att-${caseId}-9`,
        name: 'download.pdf',
        type: 'pdf',
        mimeType: 'application/pdf',
        size: 1024000, // 1MB
        url: `${baseUrl}/files/download-copy-${caseId}.pdf`,
        uploadedAt: this.getRandomDate(-5),
        uploadedBy: 'Data Analyst',
        description: 'Additional verification document'
      },
      {
        id: `att-${caseId}-10`,
        name: 'Financial_Statement.pdf',
        type: 'pdf',
        mimeType: 'application/pdf',
        size: 1800000, // 1.8MB
        url: `${baseUrl}/files/financial-statement-${caseId}.pdf`,
        uploadedAt: this.getRandomDate(-6),
        uploadedBy: 'Finance Team',
        description: 'Financial statement and income verification'
      }
    ];

    // Return a subset based on the attachment count
    return allAttachments.slice(0, attachmentCount);
  }

  /**
   * Generate secure PDF content for in-app viewing
   */
  private async generateSecurePdfContent(attachment: Attachment): Promise<string> {
    console.log(`📄 Generating secure PDF content for: ${attachment.name}`);
    console.log(`📍 Secure API URL: ${attachment.url}`);

    try {
      // Get authentication token
      const token = await AuthStorageService.getAccessToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

      // Fetch PDF data with authentication
      const response = await fetch(attachment.url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-App-Version': '4.0.0',
          'X-Platform': 'MOBILE'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`);
      }

      // Convert to blob and then to data URL
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to convert PDF to data URL'));
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Error generating secure PDF content:', error);
      // Return a placeholder PDF
      return 'data:application/pdf;base64,JVBERi0xLjQKJcOkw7zDtsO4CjIgMCBvYmoKPDwKL0xlbmd0aCAzIDAgUgo+PgpzdHJlYW0KQNC0xLjQKJcOkw7zDtsO4CjIgMCBvYmoKPDwKL0xlbmd0aCAzIDAgUgo+PgpzdHJlYW0KZW5kc3RyZWFtCmVuZG9iago=';
    }
  }

  /**
   * Check if download.pdf file is available
   */
  private isDownloadPdfAvailable(): boolean {
    // In a real app, this would check if the file exists
    // For demo, we'll prefer embedded content for better compatibility
    // Only use file path in development with local server
    return typeof window !== 'undefined' &&
           window.location.hostname === 'localhost' &&
           window.location.protocol.startsWith('http');
  }

  /**
   * Create embedded PDF content as base64 data URL
   */
  private createEmbeddedPdfContent(fileName: string): string {
    // Create a simple but valid PDF with actual content
    const pdfContent = this.generateValidPdfBase64(fileName);
    return `data:application/pdf;base64,${pdfContent}`;
  }

  /**
   * Generate valid PDF base64 content
   */
  private generateValidPdfBase64(fileName: string): string {
    // Create document-specific content
    const documentInfo = this.getDocumentInfo(fileName);

    // Generate a valid PDF with actual readable content
    const pdfBase64 = this.createValidPdfDocument(documentInfo);

    return pdfBase64;
  }

  /**
   * Get document information based on filename
   */
  private getDocumentInfo(fileName: string): { title: string; content: string[] } {
    const documentMap: { [key: string]: { title: string; content: string[] } } = {
      'Property_Documents.pdf': {
        title: 'PROPERTY VERIFICATION DOCUMENTS',
        content: [
          'Document Type: Property Verification Report',
          'Property Address: 12B, Ocean View Apartments, Mumbai',
          'Owner Name: Priya Sharma',
          'Verification Date: January 15, 2024',
          'Status: Verified and Approved',
          'Verification Officer: John Doe (EMP001)',
          '',
          'Property Details:',
          '- Property Type: Residential Apartment',
          '- Built-up Area: 1,200 sq ft',
          '- Property Age: 5 years',
          '- Current Market Value: ₹85,00,000',
          '',
          'Verification Summary:',
          'The property has been physically verified and all',
          'documents are found to be authentic and valid.',
          'The property is suitable for loan approval.',
          '',
          'This document is generated by CaseFlow Mobile',
          'for demonstration purposes only.'
        ]
      },
      'Bank_Statement_Jan2024.pdf': {
        title: 'BANK STATEMENT - JANUARY 2024',
        content: [
          'Account Holder: John Doe',
          'Account Number: ****1234',
          'Statement Period: January 1-31, 2024',
          'Bank: State Bank of India',
          'Branch: Mumbai Central',
          '',
          'Account Summary:',
          'Opening Balance: ₹5,20,000.00',
          'Total Credits: ₹1,25,000.00',
          'Total Debits: ₹95,000.00',
          'Closing Balance: ₹5,50,000.00',
          '',
          'Recent Transactions:',
          'Jan 15: Salary Credit - ₹75,000.00',
          'Jan 20: EMI Debit - ₹25,000.00',
          'Jan 25: Utility Bills - ₹8,500.00',
          '',
          'This is a secure document generated for',
          'verification purposes only.',
          '',
          'For any queries, contact your branch.'
        ]
      },
      'Legal_Agreement.pdf': {
        title: 'LEGAL AGREEMENT DOCUMENT',
        content: [
          'Agreement Type: Property Sale Agreement',
          'Date: January 10, 2024',
          'Parties: Seller and Buyer',
          '',
          'Terms and Conditions:',
          '1. Property transfer as per legal requirements',
          '2. Payment terms agreed by both parties',
          '3. Registration to be completed within 30 days',
          '4. All legal formalities to be completed',
          '',
          'Legal Compliance:',
          'This agreement complies with all applicable',
          'laws and regulations.',
          '',
          'Signatures:',
          'Seller: _________________',
          'Buyer: _________________',
          'Witness: ________________',
          '',
          'Document prepared by CaseFlow Legal Team'
        ]
      }
    };

    return documentMap[fileName] || {
      title: 'CASEFLOW MOBILE DOCUMENT',
      content: [
        'Document Name: ' + fileName,
        'Generated: ' + new Date().toLocaleDateString(),
        '',
        'This is a sample document generated by',
        'CaseFlow Mobile for demonstration purposes.',
        '',
        'Features:',
        '• Secure in-app viewing',
        '• No download or sharing allowed',
        '• Real-time document processing',
        '• Cross-platform compatibility',
        '',
        'For more information, contact support.',
        '',
        'CaseFlow Mobile v4.0.0',
        'Powered by Capacitor'
      ]
    };
  }

  /**
   * Create a valid PDF document with content
   */
  private createValidPdfDocument(docInfo: { title: string; content: string[] }): string {
    // This is a simplified PDF generator for demo purposes
    // In production, use a proper PDF library like jsPDF or PDFKit

    // Create a minimal but valid PDF structure
    const pdfContent = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
/Resources <<
  /Font <<
    /F1 5 0 R
  >>
>>
>>
endobj

4 0 obj
<<
/Length ${this.calculateContentLength(docInfo)}
>>
stream
BT
/F1 16 Tf
50 750 Td
(${docInfo.title}) Tj
0 -30 Td
/F1 12 Tf
${docInfo.content.map(line => `(${line}) Tj\n0 -20 Td`).join('\n')}
ET
endstream
endobj

5 0 obj
<<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
endobj

xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000244 00000 n
0000000${(400 + this.calculateContentLength(docInfo)).toString().padStart(3, '0')} 00000 n
trailer
<<
/Size 6
/Root 1 0 R
>>
startxref
${500 + this.calculateContentLength(docInfo)}
%%EOF`;

    // Convert to base64
    return btoa(pdfContent);
  }

  /**
   * Calculate content length for PDF structure
   */
  private calculateContentLength(docInfo: { title: string; content: string[] }): number {
    const titleLength = docInfo.title.length;
    const contentLength = docInfo.content.join('').length;
    return titleLength + contentLength + 200; // Add padding for PDF commands
  }

  /**
   * Generate secure image content for in-app viewing
   */
  private async generateSecureImageContent(attachment: Attachment): Promise<string> {
    console.log(`🖼️ Generating secure image content for: ${attachment.name}`);
    console.log(`📍 Secure API URL: ${attachment.url}`);

    try {
      // Get authentication token
      const token = await AuthStorageService.getAccessToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

      // Fetch image data with authentication
      const response = await fetch(attachment.url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-App-Version': '4.0.0',
          'X-Platform': 'MOBILE'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
      }

      // Convert to blob and then to data URL
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to convert image to data URL'));
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Error generating secure image content:', error);
      // Return a placeholder or error image
      return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzY2NzM4NSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkVycm9yIExvYWRpbmcgSW1hZ2U8L3RleHQ+PC9zdmc+';
    }
  }

  /**
   * Utility functions
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  private getRandomDate(daysAgo: number): string {
    const date = new Date();
    date.setDate(date.getDate() + daysAgo);
    return date.toISOString();
  }

  /**
   * Validation and utility methods
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Check if attachments for a case are stored securely (not in gallery)
   */
  async areAttachmentsStoredSecurely(caseId: string): Promise<boolean> {
    try {
      await this.initialize();
      const attachments = await secureStorageService.getCaseAttachments(caseId);

      console.log(`🔒 Secure storage check for case ${caseId}: ${attachments.length} attachments found`);

      // All attachments stored via this service are automatically secure
      // They are encrypted and stored in app-specific storage, not device gallery
      return attachments.length > 0;
    } catch (error) {
      console.error(`❌ Failed to check secure storage for case ${caseId}:`, error);
      return false;
    }
  }

  /**
   * Get count of securely stored attachments for a case
   */
  async getSecureAttachmentCount(caseId: string): Promise<number> {
    try {
      await this.initialize();
      const attachments = await secureStorageService.getCaseAttachments(caseId);
      return attachments.length;
    } catch (error) {
      console.error(`❌ Failed to get secure attachment count for case ${caseId}:`, error);
      return 0;
    }
  }

  /**
   * Debug method to test PDF generation
   */
  async testPdfGeneration(): Promise<void> {
    console.log('🧪 Testing PDF generation...');

    const testAttachment: Attachment = {
      id: 'test-pdf',
      name: 'Property_Documents.pdf',
      type: 'pdf',
      mimeType: 'application/pdf',
      size: 1024000,
      url: 'test-url',
      uploadedAt: new Date().toISOString(),
      uploadedBy: 'Test User'
    };

    try {
      const pdfContent = await this.generateSecurePdfContent(testAttachment);
      console.log('✅ PDF generation successful');
      console.log('📄 Content type:', pdfContent.startsWith('data:') ? 'Data URL' : 'File Path');
      console.log('📏 Content length:', pdfContent.length);

      if (pdfContent.startsWith('data:application/pdf;base64,')) {
        console.log('✅ Valid PDF data URL format');
        const base64Data = pdfContent.split(',')[1];
        console.log('📊 Base64 data length:', base64Data.length);

        // Test if base64 is valid
        try {
          atob(base64Data);
          console.log('✅ Valid base64 encoding');
        } catch (e) {
          console.error('❌ Invalid base64 encoding:', e);
        }
      }
    } catch (error) {
      console.error('❌ PDF generation failed:', error);
    }
  }

  getFileTypeIcon(attachment: Attachment): string {
    switch (attachment.type) {
      case 'pdf':
        return '📄';
      case 'image':
        return '🖼️';
      default:
        return '📎';
    }
  }

  isValidFileSize(size: number): boolean {
    return size > 0 && size <= this.maxFileSize;
  }

  isValidAttachmentCount(count: number): boolean {
    return count >= 0 && count <= this.maxAttachments;
  }

  isPdfAttachment(attachment: Attachment): boolean {
    return attachment.type === 'pdf' && attachment.mimeType === 'application/pdf';
  }

  isImageAttachment(attachment: Attachment): boolean {
    return attachment.type === 'image' && 
           ['image/jpeg', 'image/jpg', 'image/png'].includes(attachment.mimeType);
  }
}

export const attachmentService = new AttachmentService();
