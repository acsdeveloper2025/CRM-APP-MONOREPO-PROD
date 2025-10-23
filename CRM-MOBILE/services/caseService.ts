import { Case, CaseStatus, VerificationType, Attachment } from '../types';
import AsyncStorage from '../polyfills/AsyncStorage';
import { migrateCasesVerificationOutcomes, isDeprecatedOutcome } from '../utils/verificationOutcomeMigration';
import { apiService } from './apiService';

const LOCAL_STORAGE_KEY = 'caseflow_cases';

/**
 * Get API base URL - Static IP only, no fallbacks
 */
function getApiBaseUrl(): string {
  console.log('🌐 Case Service - Static IP Only');

  // Mobile app uses static IP exclusively
  if (import.meta.env.VITE_API_BASE_URL_STATIC_IP) {
    const url = import.meta.env.VITE_API_BASE_URL_STATIC_IP;
    console.log('🌍 Case Service - Using Static IP API URL:', url);
    return url;
  }

  // If static IP not configured, throw error
  console.error('❌ Static IP not configured for Case Service');
  throw new Error('VITE_API_BASE_URL_STATIC_IP must be configured for mobile app');
}

// Backend case interface for API responses
interface BackendCase {
  id: string; // UUID primary key
  caseId: number; // Business identifier
  customerName: string;
  customerCallingCode?: string;
  customerPhone?: string;
  clientId: number;
  clientName?: string;
  clientCode?: string;
  productId?: number;
  productName?: string;
  productCode?: string;
  verificationTypeId?: number;
  verificationType?: string;
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
  address?: string;
  verificationTaskId?: string; // Verification Task UUID
  verificationTaskNumber?: string; // Verification Task Number (e.g., VT-000127)
  status: string;
  assignedAt: string; // Backend sends this as creation time
  updatedAt: string;
  completedAt?: string;
  [key: string]: any;
}

// Function to map backend case data to mobile Case interface
const mapBackendCaseToMobile = (backendCase: BackendCase): Case => {
  // Map backend priority string to mobile priority number
  const priorityMap: { [key: string]: number } = {
    'LOW': 1,
    'MEDIUM': 2,
    'HIGH': 3,
    'URGENT': 4
  };

  // Map backend status to mobile CaseStatus
  const statusMap: { [key: string]: CaseStatus } = {
    'PENDING': CaseStatus.Assigned,
    'IN_PROGRESS': CaseStatus.InProgress,
    'COMPLETED': CaseStatus.Completed
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
    id: backendCase.id, // Use the actual UUID from backend
    title: `${backendCase.verificationType || 'Verification'} - ${backendCase.customerName}`,
    description: `${backendCase.verificationType || 'Verification'} for ${backendCase.customerName}`,
    customer: {
      name: backendCase.customerName,
      contact: backendCase.customerPhone || backendCase.customerCallingCode || ''
    },
    status: statusMap[backendCase.status] || CaseStatus.Assigned,
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

    // Enhanced fields for 13 required case fields
    // Field 1: Customer Name
    customerName: backendCase.customerName,

    // Field 2: Case ID
    caseId: backendCase.caseId,

    // Verification Task Information
    verificationTaskId: backendCase.verificationTaskId,
    verificationTaskNumber: backendCase.verificationTaskNumber,

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
const generateAttachments = (caseId: string, count: number): Attachment[] => {
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
    id: `att-${caseId}-${index + 1}`,
    name: template.name,
    type: template.type,
    mimeType: template.mimeType,
    size: template.size,
    url: `${baseUrl}/files/${template.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${caseId}`,
    thumbnailUrl: template.type === 'image' ? `${baseUrl}/files/${template.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${caseId}-thumb` : undefined,
    uploadedAt: new Date(Date.now() - (index + 1) * 24 * 60 * 60 * 1000).toISOString(),
    uploadedBy: template.uploadedBy,
    description: `${template.name} for case ${caseId}`
  }));
};

// Mock data removed - using real API data only
const getInitialMockData = (): Case[] => [];

class CaseService {
  private useRealAPI: boolean = true; // Always use real API - mock data removed

  constructor() {
    this.initializeData();
  }

  private async initializeData() {
    // Initialize service - keep existing data
    console.log('Case service initialized');
  }

  private async readFromStorage(): Promise<Case[]> {
    const data = await AsyncStorage.getItem(LOCAL_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  }

  private async writeToStorage(cases: Case[]): Promise<void> {
    await AsyncStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cases));
  }



  // Fetch cases from backend API
  private async fetchCasesFromAPI(): Promise<Case[]> {
    try {
      const result = await apiService.request('/mobile/cases?limit=200', {
        method: 'GET',
        requireAuth: true,
      });

      if (!result.success || !result.data || !result.data.cases) {
        throw new Error('Invalid API response format');
      }

      // Map backend cases to mobile format
      const mobileCases = result.data.cases.map((backendCase: BackendCase) =>
        mapBackendCaseToMobile(backendCase)
      );

      // Cache the cases locally for offline access
      await this.writeToStorage(mobileCases);

      console.log(`Fetched ${mobileCases.length} cases from API`);
      return mobileCases;

    } catch (error) {
      console.error('Failed to fetch cases from API:', error);
      console.log('Falling back to cached/mock data');
      return this.getMockCases();
    }
  }

  // No mock cases - all mock data removed
  private async getMockCases(): Promise<Case[]> {
    console.log('No mock data available - returning empty array');
    return [];
  }

  async getCases(forceFresh: boolean = false): Promise<Case[]> {
    // If forcing fresh data, skip local storage
    if (forceFresh) {
      console.log("🔄 Forcing fresh data from API");
      if (this.useRealAPI) {
        return this.fetchCasesFromAPI();
      } else {
        return this.getMockCases();
      }
    }

    // First try to get cases from local storage
    const localCases = await this.readFromStorage();

    if (localCases.length > 0) {
      console.log(`Loaded ${localCases.length} cases from local storage`);
      return localCases;
    }

    // If no local cases, fetch from API
    if (this.useRealAPI) {
      return this.fetchCasesFromAPI();
    } else {
      return this.getMockCases();
    }
  }

  async getCase(id: string): Promise<Case | undefined> {
    const cases = await this.readFromStorage();
    return cases.find(c => c.id === id);
  }

  async updateCase(id: string, updates: Partial<Case>): Promise<Case> {
    const cases = await this.readFromStorage();
    const caseIndex = cases.findIndex(c => c.id === id);
    if (caseIndex === -1) {
      throw new Error('Case not found');
    }
    const updatedCase = { ...cases[caseIndex], ...updates, updatedAt: new Date().toISOString() };
    cases[caseIndex] = updatedCase;
    await this.writeToStorage(cases);
    return updatedCase;
  }
  
  async revokeCase(id: string, reason: string): Promise<void> {
    const cases = await this.readFromStorage();
    const updatedCases = cases.filter(c => c.id !== id);
    console.log(`Case ${id} revoked. Reason: ${reason}. Simulating sending to server.`);
    await this.writeToStorage(updatedCases);
  }

  async syncWithServer(): Promise<Case[]> {
    console.log("Syncing with server...");

    if (this.useRealAPI) {
      // Clear local cache first to force fresh data
      await this.clearCache();
      console.log("🗑️ Cleared local cache");

      // Fetch fresh data from API and save to storage
      const freshCases = await this.fetchCasesFromAPI();
      await this.writeToStorage(freshCases);
      console.log(`💾 Saved ${freshCases.length} fresh cases to storage`);

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
      error: 'This method is deprecated. Please use the Submit button in the verification form to complete this case.'
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

  // Test API connection and field mapping
  async testAPIConnection(): Promise<{ success: boolean; message: string; sampleCase?: any }> {
    try {
      const token = await this.getAuthToken();
      if (!token) {
        return { success: false, message: 'No authentication token available' };
      }

      const response = await fetch(`${getApiBaseUrl()}/cases?limit=1`, {
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
        return { success: false, message: 'No cases available from API' };
      }

      const backendCase = result.data[0];
      const mobileCase = mapBackendCaseToMobile(backendCase);

      // Verify all 13 required fields are present
      const requiredFields = [
        'customerName', 'caseId', 'clientName', 'productName', 'verificationType',
        'applicantType', 'createdByBackendUserName', 'backendContactNumber',
        'assignedToName', 'priority', 'trigger', 'customerCallingCode', 'address'
      ];

      const missingFields = requiredFields.filter(field => {
        const value = mobileCase[field as keyof Case];
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

export const caseService = new CaseService();
