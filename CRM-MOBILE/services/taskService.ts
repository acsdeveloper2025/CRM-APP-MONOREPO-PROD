import { VerificationTask, TaskStatus, VerificationType, Attachment } from '../types';
import AsyncStorage from '../polyfills/AsyncStorage';
import { apiService } from './apiService';

const LOCAL_STORAGE_KEY = 'caseflow_cases';

/**
 * Get API base URL - Environment-aware configuration
 */
function getApiBaseUrl(): string {
  console.log('🔍 Case Service - API Configuration');

  // Check if we're in production mode
  const isProduction = import.meta.env.PROD;

  if (isProduction) {
    // Production: Use domain-based API URL
    const productionUrl = 'https://crm.allcheckservices.com/api';
    console.log('🌍 Case Service - Using Production API URL:', productionUrl);
    return productionUrl;
  } else {
    // Development: Try static IP first, then fallback to localhost
    if (import.meta.env.VITE_API_BASE_URL_STATIC_IP) {
      const url = import.meta.env.VITE_API_BASE_URL_STATIC_IP;
      console.log('🌍 Case Service - Using Static IP API URL:', url);
      return url;
    }

    // Fallback to localhost for development
    const devUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';
    console.log('🌍 Case Service - Using Development API URL:', devUrl);
    return devUrl;
  }
}

// Backend task interface for API responses
interface BackendTask {
  id: string; // UUID
  verificationTaskId: string; // UUID
  taskNumber: string; // Human-readable
  businessCaseId: number; // Business identifier for display
  customerName: string;
  customerCallingCode?: string;
  customerPhone?: string;
  clientId: number;
  clientName: string;
  clientCode?: string;
  productId?: number;
  productName: string;
  productCode?: string;
  verificationTypeId?: number;
  verificationType: string;
  verificationTypeName?: string;
  verificationTypeCode?: string;
  applicantType?: string;
  createdByBackendUser?: string;
  createdByBackendUserName?: string;
  createdByBackendUserEmail?: string;
  backendContactNumber?: string;
  assignedTo?: string;
  assignedToName?: string;
  assignedToEmail?: string;
  priority?: string;
  trigger?: string;
  address: string;
  city: string;
  state: string;
  status: string;
  assignedAt: string; // Backend sends this as creation time
  updatedAt: string;
  completedAt?: string;
  [key: string]: any;
}

// Function to map backend task data to mobile Case interface
const mapBackendTaskToMobile = (backendCase: BackendTask): VerificationTask => {
  // Map backend priority string to mobile priority number
  const priorityMap: { [key: string]: number } = {
    'LOW': 1,
    'MEDIUM': 2,
    'HIGH': 3,
    'URGENT': 4
  };

  // Map backend status to mobile TaskStatus
  // This maps task status from verification_tasks table
  const statusMap: { [key: string]: TaskStatus } = {
    'PENDING': TaskStatus.Assigned,
    'ASSIGNED': TaskStatus.Assigned,
    'IN_PROGRESS': TaskStatus.InProgress,
    'COMPLETED': TaskStatus.Completed,
    'CANCELLED': TaskStatus.Assigned,
    'ON_HOLD': TaskStatus.InProgress,
  };

  // Map backend status to task status (preserves task-level status)
  const taskStatusMap: { [key: string]: TaskStatus } = {
    'PENDING': TaskStatus.Assigned,
    'ASSIGNED': TaskStatus.Assigned,
    'IN_PROGRESS': TaskStatus.InProgress,
    'COMPLETED': TaskStatus.Completed,
    'CANCELLED': TaskStatus.Assigned,
    'ON_HOLD': TaskStatus.InProgress,
  };

  // Map backend verification type to mobile VerificationType
  const verificationTypeMap: { [key: string]: VerificationType } = {
    'RESIDENCE': VerificationType.Residence,
    'OFFICE': VerificationType.Office,
    'BUSINESS': VerificationType.Business,
    'RESIDENCE_CUM_OFFICE': VerificationType.ResidenceCumOffice,
    'BUILDER': VerificationType.Builder,
    'NOC': VerificationType.NOC,
    'CONNECTOR': VerificationType.Connector,
    'PROPERTY_APF': VerificationType.PropertyAPF,
    'PROPERTY_INDIVIDUAL': VerificationType.PropertyIndividual,
    // Map backend verification type names to mobile types (exact database names)
    'Residence Verification': VerificationType.Residence,
    'Office Verification': VerificationType.Office,
    'Business Verification': VerificationType.Business,
    'Residence cum office Verification': VerificationType.ResidenceCumOffice, // Exact DB name
    'Builder Verification': VerificationType.Builder,
    'Noc Verification': VerificationType.NOC, // Exact DB name (lowercase 'oc')
    'NOC Verification': VerificationType.NOC, // Alternative uppercase
    'DSA DST & connector Verification': VerificationType.Connector,
    'Property APF Verification': VerificationType.PropertyAPF,
    'Property Individual Verification': VerificationType.PropertyIndividual
  };

  return {
    // Core mobile app fields
    // CRITICAL FIX: Use Verification Task ID as unique identifier to support multiple tasks per task
    // This allows revisit tasks and multiple verification tasks from the same task to appear separately
    id: backendCase.verificationTaskId || backendCase.id, // Use task ID first, fallback to task ID
    title: `${backendCase.verificationType || 'Verification'} - ${backendCase.customerName}`,
    description: `${backendCase.verificationType || 'Verification'} for ${backendCase.customerName}`,
    customer: {
      name: backendCase.customerName,
      contact: backendCase.customerPhone || backendCase.customerCallingCode || ''
    },
    status: statusMap[backendCase.status] || TaskStatus.Assigned,
    taskStatus: taskStatusMap[backendCase.status] || TaskStatus.Assigned, // Preserve task-level status
    isSaved: false,
    createdAt: backendCase.assignedAt, // Backend sends assignedAt as creation time
    updatedAt: backendCase.updatedAt,
    inProgressAt: (backendCase.status === 'IN_PROGRESS' || backendCase.status === 'In Progress') ? backendCase.updatedAt : undefined, // Use updatedAt when status is IN_PROGRESS
    savedAt: undefined, // Backend doesn't track save timestamps separately
    completedAt: backendCase.completedAt,
    verificationType: (() => {
      const typeKey = backendCase.verificationTypeName || backendCase.verificationType || '';
      const mappedType = verificationTypeMap[typeKey];
      console.log('🔍 Verification Type Mapping:', {
        typeKey,
        mappedType,
        fallback: mappedType || VerificationType.Residence
      });
      return mappedType || VerificationType.Residence;
    })(),
    verificationOutcome: null,
    priority: priorityMap[backendCase.priority || 'MEDIUM'] || 2,

    // Field 1: Customer Name
    customerName: backendCase.customerName,

    // Field 2: Business Case ID (for display)
    businessCaseId: backendCase.businessCaseId,

    // Verification Task Information
    verificationTaskId: backendCase.verificationTaskId,
    verificationTaskNumber: backendCase.taskNumber,

    // Field 3: Client
    clientId: backendCase.clientId,
    clientName: backendCase.clientName,
    clientCode: backendCase.clientCode,
    client: backendCase.client || {
      id: backendCase.clientId,
      name: backendCase.clientName,
      code: backendCase.clientCode
    },

    // Field 4: Product
    productId: backendCase.productId,
    productName: backendCase.productName,
    productCode: backendCase.productCode,
    product: backendCase.product || {
      id: backendCase.productId,
      name: backendCase.productName,
      code: backendCase.productCode
    },

    // Field 5: Verification Type
    verificationTypeId: backendCase.verificationTypeId,
    verificationTypeName: backendCase.verificationTypeName,
    verificationTypeCode: backendCase.verificationTypeCode,

    // Field 6: Applicant Type
    applicantType: backendCase.applicantType,
    applicantStatus: backendCase.applicantType, // Legacy compatibility

    // Field 7: Created By Backend User
    createdByBackendUser: backendCase.createdByBackendUser,
    createdByBackendUserName: backendCase.createdByUserName, // Fixed: backend returns createdByUserName
    createdByBackendUserEmail: backendCase.createdByUserEmail,

    // Field 8: Backend Contact Number
    backendContactNumber: backendCase.backendContactNumber,
    systemContactNumber: backendCase.backendContactNumber, // Legacy compatibility

    // Field 9: Assign to Field User
    assignedTo: backendCase.assignedTo,
    assignedToName: backendCase.assignedToUserName, // Fixed: backend returns assignedToUserName
    assignedToFieldUser: backendCase.assignedToFieldUser, // Backend sends this field
    assignedToEmail: backendCase.assignedToUserEmail,

    // Field 10: Priority (already mapped above)

    // Field 11: Trigger
    trigger: backendCase.trigger,
    notes: backendCase.notes, // Backend sends trigger as notes field

    // Field 12: Customer Calling Code
    customerCallingCode: backendCase.customerCallingCode,

    // Field 13: Address
    address: backendCase.address,
    addressStreet: backendCase.addressStreet, // Backend sends address as addressStreet
    visitAddress: backendCase.address, // Legacy compatibility

    // Attachments will be loaded separately when needed (no mock data)
    attachments: []
  };
};

// Helper function to generate realistic attachments
const generateAttachments = (taskId: string, count: number): Attachment[] => {
  const baseUrl = 'https://api.caseflow.com/v1';
  const attachmentTemplates = [
    { name: 'Property_Documents.pdf', type: 'pdf' as const, mimeType: 'application/pdf' as const, size: 2048576, uploadedBy: 'System Admin' },
    { name: 'Bank_Statement.pdf', type: 'pdf' as const, mimeType: 'application/pdf' as const, size: 1536000, uploadedBy: 'Financial Analyst' },
    { name: 'Identity_Verification.jpg', type: 'image' as const, mimeType: 'image/jpeg' as const, size: 892000, uploadedBy: 'Verification Officer' },
    { name: 'Site_Photo_Exterior.png', type: 'image' as const, mimeType: 'image/png' as const, size: 1024000, uploadedBy: 'Field Agent' },
    { name: 'Legal_Agreement.pdf', type: 'pdf' as const, mimeType: 'application/pdf' as const, size: 3145728, uploadedBy: 'Legal Team' },
    { name: 'Address_Proof.jpg', type: 'image' as const, mimeType: 'image/jpeg' as const, size: 756000, uploadedBy: 'Document Specialist' },
    { name: 'Compliance_Report.pdf', type: 'pdf' as const, mimeType: 'application/pdf' as const, size: 2097152, uploadedBy: 'Compliance Officer' },
    { name: 'Building_Interior.png', type: 'image' as const, mimeType: 'image/png' as const, size: 1310720, uploadedBy: 'Site Inspector' }
  ];

  return attachmentTemplates.slice(0, count).map((template, index) => ({
    id: `att-${taskId}-${index + 1}`,
    name: template.name,
    type: template.type,
    mimeType: template.mimeType,
    size: template.size,
    url: `${baseUrl}/files/${template.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${taskId}`,
    thumbnailUrl: template.type === 'image' ? `${baseUrl}/files/${template.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${taskId}-thumb` : undefined,
    uploadedAt: new Date(Date.now() - (index + 1) * 24 * 60 * 60 * 1000).toISOString(),
    uploadedBy: template.uploadedBy,
    description: `${template.name} for task ${taskId}`
  }));
};

// Mock data removed - using real API data only
const getInitialMockData = (): VerificationTask[] => [];

class CaseService {
  private useRealAPI: boolean = true; // Always use real API - mock data removed

  constructor() {
    this.initializeData();
  }

  private async initializeData() {
    // Initialize service - keep existing data
    console.log('Case service initialized');
  }

  private async readFromStorage(): Promise<VerificationTask[]> {
    const data = await AsyncStorage.getItem(LOCAL_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  }

  private async writeToStorage(tasks: VerificationTask[]): Promise<void> {
    await AsyncStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(tasks));
  }



  // Fetch tasks from backend API
  private async fetchTasksFromAPI(): Promise<VerificationTask[]> {
    try {
      const result = await apiService.request('/mobile/tasks?limit=200', {
        method: 'GET',
        requireAuth: true,
      });

      if (!result.success || !result.data || !result.data.tasks) {
        throw new Error('Invalid API response format');
      }

      // Map backend tasks to mobile format
      const mobileCases = result.data.tasks.map((backendCase: BackendTask) =>
        mapBackendTaskToMobile(backendCase)
      );

      // Cache the tasks locally for offline access
      await this.writeToStorage(mobileCases);

      console.log(`Fetched ${mobileCases.length} tasks from API`);
      return mobileCases;

    } catch (error) {
      console.error('Failed to fetch tasks from API:', error);
      console.log('Falling back to cached/mock data');
      return this.getMockCases();
    }
  }

  // No mock tasks - all mock data removed
  private async getMockCases(): Promise<VerificationTask[]> {
    console.log('No mock data available - returning empty array');
    return [];
  }

  async getTasks(forceFresh: boolean = false): Promise<VerificationTask[]> {
    // If forcing fresh data, skip local storage
    if (forceFresh) {
      console.log("🔄 Forcing fresh data from API");
      if (this.useRealAPI) {
        return this.fetchTasksFromAPI();
      } else {
        return this.getMockCases();
      }
    }

    // First try to get tasks from local storage
    const localCases = await this.readFromStorage();

    if (localCases.length > 0) {
      console.log(`Loaded ${localCases.length} tasks from local storage`);
      return localCases;
    }

    // If no local tasks, fetch from API
    if (this.useRealAPI) {
      return this.fetchTasksFromAPI();
    } else {
      return this.getMockCases();
    }
  }

  async getTask(id: string): Promise<VerificationTask | undefined> {
    const tasks = await this.readFromStorage();
    return tasks.find(c => c.id === id);
  }

  async updateTask(id: string, updates: Partial<VerificationTask>): Promise<VerificationTask> {
    const tasks = await this.readFromStorage();
    const caseIndex = tasks.findIndex(c => c.id === id);
    if (caseIndex === -1) {
      throw new Error('Case not found');
    }
    const updatedCase = { ...tasks[caseIndex], ...updates, updatedAt: new Date().toISOString() };
    tasks[caseIndex] = updatedCase;
    await this.writeToStorage(tasks);
    return updatedCase;
  }
  
  async revokeTask(id: string, reason: string): Promise<void> {
    const tasks = await this.readFromStorage();
    const updatedCases = tasks.filter(c => c.id !== id);
    console.log(`Case ${id} revoked. Reason: ${reason}. Simulating sending to server.`);
    await this.writeToStorage(updatedCases);
  }

  async syncWithServer(): Promise<VerificationTask[]> {
    console.log("Syncing with server...");

    if (this.useRealAPI) {
      // Clear local cache first to force fresh data
      await this.clearCache();
      console.log("🗑️ Cleared local cache");

      // Fetch fresh data from API and save to storage
      const freshCases = await this.fetchTasksFromAPI();
      await this.writeToStorage(freshCases);
      console.log(`💾 Saved ${freshCases.length} fresh tasks to storage`);

      // Automatically download and encrypt attachments for offline access
      try {
        const { attachmentSyncService } = await import('./attachmentSyncService');
        console.log('📦 Starting automatic attachment sync...');

        const syncResult = await attachmentSyncService.syncAttachmentsForCases(freshCases);

        if (syncResult.success) {
          console.log(`✅ All attachments synced successfully: ${syncResult.syncedCount}/${syncResult.totalAttachments}`);
        } else {
          console.warn(`⚠️ Attachment sync completed with errors: ${syncResult.syncedCount}/${syncResult.totalAttachments} synced, ${syncResult.failedCount} failed`);
          if (syncResult.errors.length > 0) {
            console.warn('Attachment sync errors:', syncResult.errors);
          }
        }
      } catch (error) {
        console.error('❌ Failed to sync attachments:', error);
        // Don't fail the entire sync if attachment sync fails
        // Cases are still available, just without offline attachments
      }

      return freshCases;
    } else {
      // Simulate sync for mock data
      await new Promise(resolve => setTimeout(resolve, 1500));
      console.log("Sync complete (mock mode).");
      return this.getMockCases();
    }
  }

  // Clear local cache
  async clearCache(): Promise<void> {
    await AsyncStorage.removeItem(LOCAL_STORAGE_KEY);
    console.log("🗑️ Local cache cleared");
  }

  /**
   * @deprecated This method is deprecated. Use VerificationFormService for form submission.
   * Case submission should be handled through the individual verification form components
   * using VerificationFormService.submitResidenceVerification(), submitOfficeVerification(), etc.
   */
  async submitCase(id: string): Promise<{ success: boolean; error?: string }> {
    console.warn('submitCase is deprecated. Use VerificationFormService for form submission.');
    console.warn('Cases should be submitted through verification forms using VerificationFormService');

    return {
      success: false,
      error: 'This method is deprecated. Please use the Submit button in the verification form to complete this task.'
    };
  }

  /**
   * @deprecated This method is deprecated. Use VerificationFormService for form submission.
   */
  async resubmitCase(id: string): Promise<{ success: boolean; error?: string }> {
    console.warn('resubmitCase is deprecated. Use VerificationFormService for form submission.');
    return this.submitCase(id);
  }

  // Method to toggle between API and mock data (for testing/development)
  setUseRealAPI(useAPI: boolean): void {
    this.useRealAPI = useAPI;
    console.log(`Case service switched to ${useAPI ? 'real API' : 'mock data'} mode`);
  }

  // Method to check current mode
  isUsingRealAPI(): boolean {
    return this.useRealAPI;
  }

  // Helper to get auth token
  private async getAuthToken(): Promise<string | null> {
    return await AsyncStorage.getItem('auth_token');
  }

  // Test API connection and field mapping
  async testAPIConnection(): Promise<{ success: boolean; message: string; sampleCase?: any }> {
    try {
      const token = await this.getAuthToken();
      if (!token) {
        return { success: false, message: 'No authentication token available' };
      }

      const response = await fetch(`${getApiBaseUrl()}/tasks?limit=1`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return { success: false, message: `API request failed: ${response.status} ${response.statusText}` };
      }

      const result = await response.json();

      if (!result.success || !result.data || result.data.length === 0) {
        return { success: false, message: 'No tasks available from API' };
      }

      const backendCase = result.data[0];
      const mobileCase = mapBackendTaskToMobile(backendCase);

      // Verify all 13 required fields are present
      const requiredFields = [
        'customerName', 'businessCaseId', 'clientName', 'productName', 'verificationType',
        'applicantType', 'createdByBackendUserName', 'backendContactNumber',
        'assignedToName', 'priority', 'trigger', 'customerCallingCode', 'address'
      ];

      const missingFields = requiredFields.filter(field => {
        const value = mobileCase[field as keyof VerificationTask];
        return value === undefined || value === null || value === '';
      });

      if (missingFields.length > 0) {
        return {
          success: false,
          message: `Missing required fields: ${missingFields.join(', ')}`,
          sampleCase: mobileCase
        };
      }

      return {
        success: true,
        message: 'API connection successful, all 13 required fields mapped correctly',
        sampleCase: mobileCase
      };

    } catch (error) {
      return {
        success: false,
        message: `API test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}

export const taskService = new CaseService();
