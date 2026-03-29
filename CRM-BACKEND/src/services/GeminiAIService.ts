import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { logger } from '../utils/logger';
import { circuitBreakers } from '../utils/circuitBreaker';

export interface VerificationReportData {
  verificationType: string;
  outcome: string;
  formData: Record<string, unknown>;
  caseDetails: {
    caseId: string;
    customerName: string;
    address: string;
    verificationDate: string;
    agentName: string;
  };
  geoLocation?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  photos?: Array<{
    type: string;
    metadata?: Record<string, unknown>;
  }>;
  metadata?: Record<string, unknown>;
}

export interface AIReportResult {
  success: boolean;
  report?: {
    executiveSummary: string;
    keyFindings: string[];
    verificationDetails: string;
    riskAssessment: string;
    recommendations: string[];
    conclusion: string;
    confidence: number;
    templateReport?: string; // For template-based reports
  };
  error?: string;
}

export class GeminiAIService {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;

  // Residence verification templates
  private readonly RESIDENCE_TEMPLATES = {
    POSITIVE_DOOR_ACCESSIBLE: `Residence Remark: POSITIVE.
Visited at the given address {ADDRESS}. The given address is traceable and {Address_Locatable}. Address locality is {Address_Rating}. At the time of visit met with {Met_Person_Name} {Applicant_Status} {Relation}, confirmed {Applicant_Status} stay and provide the details and also confirmed {Applicant_Status} is staying at given address since {Staying_Period} {Staying_Status}. The area of premises is approx. {Approx_Area_Sq_Feet}. Total family members are {Total_Family_Members} and earning members are {Total_Earning}. {Applicant_Status} is {Working_Status} {Company_Name}. The door name plate is {Door_Name_Plate} {Name_on_Door_Plate} and also name on Society board is {Society_Name_Plate} {Name_on_Society_Board}. Locality is Residential & type of locality is {Locality}. {Locality} is of {Address_Structure_G_Plus} and {Applicant_Status} is staying on {Applicant_Staying_Floor} floor.
{Locality} color is {Address_Structure_Color}. The Door color is {Door_Color}.
Residence set up is sighted at the time of visit.
During visit met person {Document_Shown_Status} {Document_Type}.
TPC {TPC_Met_Person_1} {Name_of_TPC_1} {TPC_Confirmation_1} {Applicant_Status} name and stay.
TPC {TPC_Met_Person_2} {Name_of_TPC_2} {TPC_Confirmation_2} {Applicant_Status} name and stay.
Landmarks: {Landmark_1} and {Landmark_2}.
It is {Dominated_Area} area.
{Feedback_from_Neighbour} feedback received from neighbors.
Field executive also confirmed {Applicant_Status} is {Political_Connection}.
{Applicant_Status} stay is confirmed by our executive's observation as well as from TPC.
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,

    POSITIVE_DOOR_LOCKED: `Residence Remark: Door locked.
Visited at the given address {ADDRESS}. The given address is traceable and {Address_Locatable}. Address locality is {Address_Rating}. At the time of visit door was {House_Status}. TPC done with {TPC_Met_Person_1} {Name_of_TPC_1} {TPC_Confirmation_1} and {TPC_Met_Person_2} {Name_of_TPC_2} {TPC_Confirmation_2} {Applicant_Status} is staying at given address since {Staying_Period} {Staying_Status}. The door name plate is {Door_Name_Plate} {Name_on_Door_Plate} and also name on Society board is {Society_Name_Plate} {Name_on_Society_Board}. Locality is Residential & type of locality is {Locality}. {Locality} is of {Address_Structure_G_Plus} and {Applicant_Status} is staying on {Applicant_Staying_Floor} floor.
{Locality} color is {Address_Structure_Color}. The Door color is {Door_Color}.
Landmarks: {Landmark_1} and {Landmark_2}.
It is {Dominated_Area} area.
{Feedback_from_Neighbour} feedback received from neighbors.
Field executive also confirmed {Applicant_Status} is {Political_Connection}.
{Applicant_Status} stay is confirmed by our executive's observation as well as from TPC.
Field Executive Observation: {Other_Observation}
Hence the profile is marked as {Final_Status}.`,
  };

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  }

  /**
   * Generate comprehensive AI report for verification form submission
   */
  async generateVerificationReport(data: VerificationReportData): Promise<AIReportResult> {
    try {
      logger.info('Generating AI verification report', {
        verificationType: data.verificationType,
        outcome: data.outcome,
        caseId: data.caseDetails.caseId,
      });

      const prompt = this.buildReportPrompt(data);

      const result = await circuitBreakers.gemini.execute(() => this.model.generateContent(prompt));
      const response = result.response;
      const text = response.text();

      // Parse the structured response
      const parsedReport = this.parseAIResponse(text);

      // Generate template-based report for residence verification
      if (data.verificationType.toUpperCase() === 'RESIDENCE') {
        const templateReport = this.generateResidenceTemplateReport(data);
        parsedReport.templateReport = templateReport;
      }

      logger.info('AI verification report generated successfully', {
        caseId: data.caseDetails.caseId,
        confidence: parsedReport.confidence,
      });

      return {
        success: true,
        report: parsedReport as unknown as AIReportResult['report'],
      };
    } catch (error) {
      logger.error('Error generating AI verification report:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Generate template-based report for residence verification
   */
  private generateResidenceTemplateReport(data: VerificationReportData): string {
    const { outcome, formData, caseDetails } = data;

    // Determine which template to use based on outcome and door status
    let templateKey = 'POSITIVE_DOOR_LOCKED'; // Default

    if (outcome.toLowerCase().includes('positive')) {
      // Check if door was accessible (not locked)
      const houseStatusKey = formData?.houseStatus || formData?.house_status || '';
      const houseStatus = String(houseStatusKey as string | number | boolean | undefined);
      if (!houseStatus.toLowerCase().includes('locked')) {
        templateKey = 'POSITIVE_DOOR_ACCESSIBLE';
      }
    }

    const template = this.RESIDENCE_TEMPLATES[templateKey];

    // Map form data to template variables
    const templateVariables = this.mapFormDataToTemplateVariables(formData, caseDetails);

    // Replace template variables with actual data
    let populatedTemplate = template;
    Object.entries(templateVariables).forEach(([key, value]) => {
      const placeholder = `{${key}}`;
      populatedTemplate = populatedTemplate.replace(new RegExp(placeholder, 'g'), value);
    });

    return populatedTemplate;
  }

  /**
   * Map form data to template variables for residence verification
   */
  private mapFormDataToTemplateVariables(
    formData: Record<string, unknown>,
    caseDetails: Record<string, unknown>
  ): Record<string, string> {
    const safeGet = (
      obj: Record<string, unknown> | null | undefined,
      key: string,
      defaultValue = 'Not provided'
    ): string => {
      const val =
        obj?.[key] ||
        obj?.[key.toLowerCase()] ||
        obj?.[key.replace(/([A-Z])/g, '_$1').toLowerCase()];
      if (val === undefined || val === null || val === '') {
        return defaultValue;
      }
      return String(val as string | number | boolean | undefined);
    };

    return {
      // Address and basic info
      ADDRESS: String(
        (caseDetails.address || 'Address not provided') as string | number | boolean | undefined
      ),
      Address_Locatable: safeGet(formData, 'addressLocatable'),
      Address_Rating: safeGet(formData, 'addressRating'),

      // Person details
      Met_Person_Name: safeGet(formData, 'metPersonName') || safeGet(formData, 'personMet'),
      Applicant_Status: safeGet(formData, 'applicantStatus') || 'Applicant',
      Relation: safeGet(formData, 'relation') || safeGet(formData, 'applicantRelation'),

      // Staying details
      Staying_Period: safeGet(formData, 'stayingPeriod') || safeGet(formData, 'stayingSince'),
      Staying_Status: safeGet(formData, 'stayingStatus'),

      // Property details
      Approx_Area_Sq_Feet:
        safeGet(formData, 'approxAreaSqFeet') || safeGet(formData, 'approximateArea'),
      Total_Family_Members:
        safeGet(formData, 'totalFamilyMembers') || safeGet(formData, 'familyMembers'),
      Total_Earning_Members:
        safeGet(formData, 'totalEarningMember') || safeGet(formData, 'earningMembers'),

      // Work details
      Working_Status: safeGet(formData, 'workingStatus'),
      Company_Name: safeGet(formData, 'companyName') || safeGet(formData, 'employerName'),

      // Name plates and boards
      Door_Name_Plate:
        safeGet(formData, 'doorNamePlate') || safeGet(formData, 'nameOnDoorPlate')
          ? 'Available'
          : 'Not Available',
      Name_on_Door_Plate:
        safeGet(formData, 'nameOnDoorPlate') || safeGet(formData, 'doorNamePlate'),
      Society_Name_Plate:
        safeGet(formData, 'societyNamePlate') || safeGet(formData, 'nameOnSocietyBoard')
          ? 'Available'
          : 'Not Available',
      Name_on_Society_Board:
        safeGet(formData, 'nameOnSocietyBoard') || safeGet(formData, 'societyNamePlate'),

      // Locality details
      Locality: safeGet(formData, 'locality') || safeGet(formData, 'localityType'),
      Address_Structure_G_Plus:
        safeGet(formData, 'addressStructureGPlus') || safeGet(formData, 'addressStructure'),
      Applicant_Staying_Floor:
        safeGet(formData, 'applicantStayingFloor') || safeGet(formData, 'floor'),
      Address_Structure_Color:
        safeGet(formData, 'addressStructureColor') || safeGet(formData, 'buildingColor'),
      Door_Color: safeGet(formData, 'doorColor'),

      // House status
      House_Status: safeGet(formData, 'houseStatus') || 'locked',

      // Documents
      Document_Shown_Status:
        safeGet(formData, 'documentShownStatus') || safeGet(formData, 'documentShown')
          ? 'shown'
          : 'not shown',
      Document_Type: safeGet(formData, 'documentType'),

      // TPC details
      TPC_Met_Person_1: safeGet(formData, 'tpcMetPerson1') || safeGet(formData, 'tpcMetPerson'),
      Name_of_TPC_1: safeGet(formData, 'nameOfTpc1') || safeGet(formData, 'tpcName1'),
      TPC_Confirmation_1:
        safeGet(formData, 'tpcConfirmation1') || safeGet(formData, 'tpcConfirmation'),
      TPC_Met_Person_2: safeGet(formData, 'tpcMetPerson2'),
      Name_of_TPC_2: safeGet(formData, 'nameOfTpc2') || safeGet(formData, 'tpcName2'),
      TPC_Confirmation_2: safeGet(formData, 'tpcConfirmation2'),

      // Landmarks
      Landmark_1: safeGet(formData, 'landmark1') || safeGet(formData, 'nearbyLandmark1'),
      Landmark_2: safeGet(formData, 'landmark2') || safeGet(formData, 'nearbyLandmark2'),

      // Area assessment
      Dominated_Area: safeGet(formData, 'dominatedArea'),
      Feedback_from_Neighbour:
        safeGet(formData, 'feedbackFromNeighbour') || safeGet(formData, 'neighborFeedback'),
      Political_Connection: safeGet(formData, 'politicalConnection'),
      Other_Observation:
        safeGet(formData, 'otherObservation') ||
        safeGet(formData, 'remarks') ||
        safeGet(formData, 'verifierComments'),
      Final_Status:
        safeGet(formData, 'finalStatus') || safeGet(formData, 'verificationOutcome') || 'Positive',
    };
  }

  /**
   * Build comprehensive prompt for Gemini AI
   */
  private buildReportPrompt(data: VerificationReportData): string {
    const { verificationType, outcome, formData, caseDetails, geoLocation, photos } = data;

    return `
You are an expert verification analyst tasked with generating a comprehensive verification report. Analyze the provided data and create a professional, detailed report.

**CASE INFORMATION:**
- Case ID: ${caseDetails.caseId}
- Customer Name: ${caseDetails.customerName}
- Address: ${caseDetails.address}
- Verification Type: ${verificationType}
- Verification Outcome: ${outcome}
- Verification Date: ${caseDetails.verificationDate}
- Field Agent: ${caseDetails.agentName}

**LOCATION DATA:**
${
  geoLocation
    ? `- Coordinates: ${geoLocation.latitude}, ${geoLocation.longitude}
- Captured Address: ${geoLocation.address || 'Not available'}`
    : '- Location data not available'
}

**PHOTO EVIDENCE:**
${
  photos && photos.length > 0
    ? `- Total Photos: ${photos.length}
- Photo Types: ${photos.map(p => p.type).join(', ')}`
    : '- No photos captured'
}

**FORM DATA ANALYSIS:**
${this.formatFormDataForPrompt(formData, verificationType)}

**INSTRUCTIONS:**
Generate a comprehensive verification report in the following JSON format. Ensure all analysis is based on the provided data and follows professional verification standards.

{
  "executiveSummary": "Brief 2-3 sentence summary of the verification outcome and key findings",
  "keyFindings": [
    "List of 3-5 key findings from the verification",
    "Each finding should be specific and evidence-based"
  ],
  "verificationDetails": "Detailed analysis of the verification process, what was verified, who was met, documents checked, etc. (200-300 words)",
  "riskAssessment": "Professional risk assessment based on findings - categorize as LOW, MEDIUM, or HIGH risk with justification (150-200 words)",
  "recommendations": [
    "List of 2-4 actionable recommendations",
    "Based on the verification outcome and risk assessment"
  ],
  "conclusion": "Final conclusion with clear verification status and any follow-up actions needed (100-150 words)",
  "confidence": 85
}

**IMPORTANT GUIDELINES:**
1. Base analysis only on provided data - do not make assumptions
2. Use professional, objective language
3. Highlight any discrepancies or concerns found
4. Consider verification type-specific factors (residence vs office vs business etc.)
5. Factor in the outcome status (Positive, Shifted, NSP, ERT, Untraceable)
6. Confidence score should be 70-95 based on data completeness and verification quality
7. Ensure JSON format is valid and complete

Generate the report now:`;
  }

  /**
   * Format form data for AI prompt based on verification type
   */
  private formatFormDataForPrompt(
    formData: Record<string, unknown>,
    verificationType: string
  ): string {
    if (!formData) {
      return 'No form data available';
    }

    const formatValue = (val: unknown): string => {
      if (val === undefined || val === null) {
        return '';
      }
      if (typeof val === 'object') {
        return JSON.stringify(val);
      }
      return String(val as string | number | boolean | null | undefined);
    };

    let formatted = '';

    // Common fields across all verification types
    if (formData.addressLocatable) {
      formatted += `- Address Locatable: ${formatValue(formData.addressLocatable)}\n`;
    }
    if (formData.addressRating) {
      formatted += `- Address Rating: ${formatValue(formData.addressRating)}\n`;
    }
    if (formData.personMet) {
      formatted += `- Person Met: ${formatValue(formData.personMet)}\n`;
    }
    if (formData.documentShown) {
      formatted += `- Document Shown: ${formatValue(formData.documentShown)}\n`;
    }
    if (formData.documentType) {
      formatted += `- Document Type: ${formatValue(formData.documentType)}\n`;
    }
    if (formData.remarks) {
      formatted += `- Remarks: ${formatValue(formData.remarks)}\n`;
    }
    if (formData.verifierComments) {
      formatted += `- Verifier Comments: ${formatValue(formData.verifierComments)}\n`;
    }

    // Verification type specific fields
    switch (verificationType.toUpperCase()) {
      case 'RESIDENCE':
      case 'RESIDENCE_CUM_OFFICE':
        if (formData.applicantName) {
          formatted += `- Applicant Name: ${formatValue(formData.applicantName)}\n`;
        }
        if (formData.applicantAge) {
          formatted += `- Applicant Age: ${formatValue(formData.applicantAge)}\n`;
        }
        if (formData.applicantRelation) {
          formatted += `- Applicant Relation: ${formatValue(formData.applicantRelation)}\n`;
        }
        if (formData.stayingStatus) {
          formatted += `- Staying Status: ${formatValue(formData.stayingStatus)}\n`;
        }
        if (formData.houseStatus) {
          formatted += `- House Status: ${formatValue(formData.houseStatus)}\n`;
        }
        if (formData.localityType) {
          formatted += `- Locality Type: ${formatValue(formData.localityType)}\n`;
        }
        break;

      case 'OFFICE':
        if (formData.companyName) {
          formatted += `- Company Name: ${formatValue(formData.companyName)}\n`;
        }
        if (formData.designation) {
          formatted += `- Designation: ${formatValue(formData.designation)}\n`;
        }
        if (formData.officeType) {
          formatted += `- Office Type: ${formatValue(formData.officeType)}\n`;
        }
        if (formData.workingStatus) {
          formatted += `- Working Status: ${formatValue(formData.workingStatus)}\n`;
        }
        break;

      case 'BUSINESS':
        if (formData.businessName) {
          formatted += `- Business Name: ${formatValue(formData.businessName)}\n`;
        }
        if (formData.businessType) {
          formatted += `- Business Type: ${formatValue(formData.businessType)}\n`;
        }
        if (formData.ownershipType) {
          formatted += `- Ownership Type: ${formatValue(formData.ownershipType)}\n`;
        }
        if (formData.businessExistence) {
          formatted += `- Business Existence: ${formatValue(formData.businessExistence)}\n`;
        }
        break;
    }

    // Third party confirmation
    if (formData.tpcMetPerson) {
      formatted += `- TPC Met Person: ${formatValue(formData.tpcMetPerson)}\n`;
    }
    if (formData.tpcConfirmation) {
      formatted += `- TPC Confirmation: ${formatValue(formData.tpcConfirmation)}\n`;
    }

    // Area information
    if (formData.politicalConnection) {
      formatted += `- Political Connection: ${formatValue(formData.politicalConnection)}\n`;
    }
    if (formData.dominatedArea) {
      formatted += `- Dominated Area: ${formatValue(formData.dominatedArea)}\n`;
    }
    if (formData.feedbackFromNeighbour) {
      formatted += `- Neighbor Feedback: ${formatValue(formData.feedbackFromNeighbour)}\n`;
    }

    return formatted || 'No specific form data available';
  }

  /**
   * Parse AI response and extract structured report
   */
  private parseAIResponse(text: string): Record<string, unknown> {
    try {
      // Try to extract JSON from the response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const jsonStr = jsonMatch[0];
        const parsed = JSON.parse(jsonStr);

        // Validate required fields
        const required = [
          'executiveSummary',
          'keyFindings',
          'verificationDetails',
          'riskAssessment',
          'recommendations',
          'conclusion',
        ];
        const missing = required.filter(field => !parsed[field]);

        if (missing.length > 0) {
          throw new Error(`Missing required fields: ${missing.join(', ')}`);
        }

        // Ensure confidence is a number between 70-95
        if (!parsed.confidence || parsed.confidence < 70 || parsed.confidence > 95) {
          parsed.confidence = 80; // Default confidence
        }

        return parsed;
      } else {
        throw new Error('No JSON found in AI response');
      }
    } catch (error) {
      logger.error('Error parsing AI response:', error);

      // Fallback: create a basic report from the text
      return {
        executiveSummary: 'AI-generated report based on verification data analysis.',
        keyFindings: ['Verification completed', 'Data analyzed by AI system'],
        verificationDetails: `${text.substring(0, 500)}...`,
        riskAssessment: 'Unable to determine risk level due to parsing error.',
        recommendations: ['Review verification data', 'Manual analysis recommended'],
        conclusion: 'AI report generation encountered parsing issues. Manual review recommended.',
        confidence: 70,
      };
    }
  }

  /**
   * Test Gemini AI connection
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await circuitBreakers.gemini.execute(() =>
        this.model.generateContent('Test connection. Respond with "Connection successful"')
      );
      const response = result.response;
      const text = response.text();

      return {
        success: text.toLowerCase().includes('connection successful') || text.length > 0,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

export const geminiAIService = new GeminiAIService();
