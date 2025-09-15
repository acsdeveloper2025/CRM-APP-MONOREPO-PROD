/**
 * Report Templates for AI-Generated Verification Reports
 * Supports all 9 verification types and 5 status categories
 */

export interface ReportTemplate {
  verificationType: string;
  statusCategory: string;
  keyFields: string[];
  riskFactors: string[];
  recommendations: string[];
  analysisPoints: string[];
}

export interface VerificationTypeConfig {
  name: string;
  description: string;
  primaryFields: string[];
  riskIndicators: string[];
  successCriteria: string[];
}

/**
 * Verification Types Configuration
 */
export const VERIFICATION_TYPES: Record<string, VerificationTypeConfig> = {
  RESIDENCE: {
    name: 'Residence Verification',
    description: 'Verification of residential address and occupancy status',
    primaryFields: [
      'applicantName', 'applicantAge', 'applicantRelation', 'applicantContact',
      'addressLocatable', 'addressRating', 'houseStatus', 'localityType',
      'personMet', 'relationToApplicant', 'stayingStatus', 'workingStatus',
      'documentShown', 'documentType', 'tpcMetPerson', 'tpcConfirmation',
      'politicalConnection', 'dominatedArea', 'feedbackFromNeighbour'
    ],
    riskIndicators: [
      'addressNotLocatable', 'personNotMet', 'noDocumentShown', 
      'negativeNeighborFeedback', 'politicalConnection', 'dominatedArea'
    ],
    successCriteria: [
      'addressLocatable', 'applicantMet', 'documentVerified', 
      'positiveNeighborFeedback', 'stableResidence'
    ]
  },

  RESIDENCE_CUM_OFFICE: {
    name: 'Residence cum Office Verification',
    description: 'Combined verification of residential and office premises',
    primaryFields: [
      'applicantName', 'companyName', 'designation', 'addressLocatable',
      'addressRating', 'houseStatus', 'officeStatus', 'localityType',
      'personMet', 'workingStatus', 'businessActivity', 'documentShown',
      'tpcConfirmation', 'politicalConnection', 'feedbackFromNeighbour'
    ],
    riskIndicators: [
      'addressNotLocatable', 'noBusinessActivity', 'personNotMet',
      'noDocumentShown', 'negativeNeighborFeedback'
    ],
    successCriteria: [
      'addressLocatable', 'businessActivityConfirmed', 'applicantMet',
      'documentVerified', 'positiveNeighborFeedback'
    ]
  },

  OFFICE: {
    name: 'Office Verification',
    description: 'Verification of office address and employment status',
    primaryFields: [
      'companyName', 'officeType', 'designation', 'addressLocatable',
      'addressRating', 'officeStatus', 'localityType', 'personMet',
      'workingStatus', 'applicantWorkingPremises', 'documentShown',
      'tpcConfirmation', 'politicalConnection', 'feedbackFromNeighbour'
    ],
    riskIndicators: [
      'officeNotFound', 'applicantNotWorking', 'personNotMet',
      'noDocumentShown', 'negativeNeighborFeedback'
    ],
    successCriteria: [
      'officeLocated', 'applicantEmployed', 'documentVerified',
      'positiveNeighborFeedback', 'stableEmployment'
    ]
  },

  BUSINESS: {
    name: 'Business Verification',
    description: 'Verification of business premises and operations',
    primaryFields: [
      'businessName', 'businessType', 'ownershipType', 'addressLocatable',
      'addressRating', 'businessStatus', 'premisesStatus', 'businessExistence',
      'applicantExistence', 'documentShown', 'tpcConfirmation',
      'politicalConnection', 'dominatedArea', 'feedbackFromNeighbour'
    ],
    riskIndicators: [
      'businessNotFound', 'premisesClosed', 'applicantNotFound',
      'noDocumentShown', 'negativeNeighborFeedback'
    ],
    successCriteria: [
      'businessOperational', 'applicantPresent', 'documentVerified',
      'positiveNeighborFeedback', 'stableBusiness'
    ]
  },

  BUILDER: {
    name: 'Builder Verification',
    description: 'Verification of builder/developer credentials and projects',
    primaryFields: [
      'builderName', 'projectName', 'projectType', 'addressLocatable',
      'addressRating', 'projectStatus', 'constructionStatus', 'personMet',
      'documentShown', 'licenseVerification', 'tpcConfirmation',
      'politicalConnection', 'feedbackFromNeighbour'
    ],
    riskIndicators: [
      'projectNotFound', 'noValidLicense', 'constructionStopped',
      'personNotMet', 'negativeNeighborFeedback'
    ],
    successCriteria: [
      'projectLocated', 'validLicense', 'activeConstruction',
      'builderPresent', 'positiveNeighborFeedback'
    ]
  },

  NOC: {
    name: 'NOC Verification',
    description: 'No Objection Certificate verification',
    primaryFields: [
      'nocType', 'issuingAuthority', 'nocNumber', 'validityDate',
      'addressLocatable', 'addressRating', 'documentShown', 'personMet',
      'authorityConfirmation', 'tpcConfirmation', 'politicalConnection'
    ],
    riskIndicators: [
      'nocExpired', 'invalidNoc', 'authorityNotConfirmed',
      'personNotMet', 'documentNotShown'
    ],
    successCriteria: [
      'validNoc', 'authorityConfirmed', 'documentVerified',
      'personMet', 'nocActive'
    ]
  },

  DSA_CONNECTOR: {
    name: 'DSA/DST & Connector Verification',
    description: 'Direct Selling Agent and Connector verification',
    primaryFields: [
      'agentName', 'agentCode', 'connectorType', 'addressLocatable',
      'addressRating', 'agentStatus', 'businessActivity', 'personMet',
      'documentShown', 'licenseVerification', 'tpcConfirmation',
      'politicalConnection', 'feedbackFromNeighbour'
    ],
    riskIndicators: [
      'agentNotFound', 'noValidLicense', 'noBusinessActivity',
      'personNotMet', 'negativeNeighborFeedback'
    ],
    successCriteria: [
      'agentLocated', 'validLicense', 'activeAgent',
      'documentVerified', 'positiveNeighborFeedback'
    ]
  },

  PROPERTY_APF: {
    name: 'Property (APF) Verification',
    description: 'Asset Protection Fund property verification',
    primaryFields: [
      'propertyType', 'propertyValue', 'ownershipStatus', 'addressLocatable',
      'addressRating', 'propertyStatus', 'occupancyStatus', 'personMet',
      'documentShown', 'titleVerification', 'tpcConfirmation',
      'politicalConnection', 'feedbackFromNeighbour'
    ],
    riskIndicators: [
      'propertyNotFound', 'disputedOwnership', 'noValidTitle',
      'personNotMet', 'negativeNeighborFeedback'
    ],
    successCriteria: [
      'propertyLocated', 'clearTitle', 'validOwnership',
      'documentVerified', 'positiveNeighborFeedback'
    ]
  },

  PROPERTY_INDIVIDUAL: {
    name: 'Property (Individual) Verification',
    description: 'Individual property ownership verification',
    primaryFields: [
      'ownerName', 'propertyType', 'propertyValue', 'addressLocatable',
      'addressRating', 'propertyStatus', 'occupancyStatus', 'personMet',
      'documentShown', 'titleVerification', 'tpcConfirmation',
      'politicalConnection', 'feedbackFromNeighbour'
    ],
    riskIndicators: [
      'ownerNotFound', 'propertyNotFound', 'disputedOwnership',
      'noValidTitle', 'negativeNeighborFeedback'
    ],
    successCriteria: [
      'ownerMet', 'propertyLocated', 'clearTitle',
      'documentVerified', 'positiveNeighborFeedback'
    ]
  }
};

/**
 * Status Categories Configuration
 */
export const STATUS_CATEGORIES = {
  POSITIVE_DOOR_LOCKED: {
    name: 'Positive & Door Locked',
    description: 'Verification successful but premises were locked',
    riskLevel: 'LOW',
    confidence: 85,
    keyPoints: [
      'Address located successfully',
      'Premises confirmed but locked during visit',
      'Third-party confirmation obtained',
      'Neighbor feedback positive'
    ]
  },

  SHIFTED_DOOR_LOCKED: {
    name: 'Shifted & Door Locked',
    description: 'Subject has shifted from the address, premises locked',
    riskLevel: 'MEDIUM',
    confidence: 75,
    keyPoints: [
      'Address located but subject shifted',
      'Premises locked during visit',
      'New address information gathered if available',
      'Neighbor confirmation of shifting'
    ]
  },

  NSP_DOOR_LOCKED: {
    name: 'NSP & Door Locked',
    description: 'No Such Person found, premises locked',
    riskLevel: 'HIGH',
    confidence: 70,
    keyPoints: [
      'Address located but no such person found',
      'Premises locked during visit',
      'Neighbors confirm no knowledge of person',
      'Possible address discrepancy'
    ]
  },

  ERT: {
    name: 'Entry Restricted (ERT)',
    description: 'Entry restricted due to various factors',
    riskLevel: 'MEDIUM',
    confidence: 65,
    keyPoints: [
      'Address located but entry restricted',
      'Security or access limitations',
      'Alternative verification methods used',
      'Limited information gathering'
    ]
  },

  UNTRACEABLE: {
    name: 'Untraceable',
    description: 'Address or person could not be traced',
    riskLevel: 'HIGH',
    confidence: 60,
    keyPoints: [
      'Address not locatable',
      'No information available from neighbors',
      'Possible incorrect address provided',
      'Requires further investigation'
    ]
  }
};

/**
 * Get report template for specific verification type and status
 */
export function getReportTemplate(verificationType: string, statusCategory: string): ReportTemplate {
  const verificationConfig = VERIFICATION_TYPES[verificationType.toUpperCase()];

  // Normalize status category key by removing special characters and replacing spaces with underscores
  const normalizedStatusKey = statusCategory.toUpperCase()
    .replace(/[&]/g, '') // Remove ampersand
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/_+/g, '_'); // Replace multiple underscores with single underscore

  const statusConfig = STATUS_CATEGORIES[normalizedStatusKey];

  if (!verificationConfig) {
    throw new Error(`Unknown verification type: ${verificationType}`);
  }

  if (!statusConfig) {
    throw new Error(`Unknown status category: ${statusCategory} (normalized: ${normalizedStatusKey})`);
  }

  return {
    verificationType: verificationConfig.name,
    statusCategory: statusConfig.name,
    keyFields: verificationConfig.primaryFields,
    riskFactors: verificationConfig.riskIndicators,
    recommendations: generateRecommendations(verificationType, statusCategory),
    analysisPoints: [...verificationConfig.successCriteria, ...statusConfig.keyPoints]
  };
}

/**
 * Generate recommendations based on verification type and status
 */
function generateRecommendations(verificationType: string, statusCategory: string): string[] {
  const baseRecommendations = [
    'Review all captured documentation',
    'Verify geo-location accuracy',
    'Cross-check with third-party sources'
  ];

  const statusSpecificRecommendations: Record<string, string[]> = {
    'POSITIVE_DOOR_LOCKED': [
      'Schedule follow-up visit during business hours',
      'Attempt phone verification if contact available'
    ],
    'SHIFTED_DOOR_LOCKED': [
      'Investigate new address if provided',
      'Update records with current information',
      'Consider re-verification at new location'
    ],
    'NSP_DOOR_LOCKED': [
      'Conduct detailed neighbor inquiry',
      'Verify address accuracy with multiple sources',
      'Consider case for rejection or re-investigation'
    ],
    'ERT': [
      'Explore alternative verification methods',
      'Contact building management or security',
      'Schedule verification during accessible hours'
    ],
    'UNTRACEABLE': [
      'Verify address with postal services',
      'Conduct area survey for address confirmation',
      'Recommend case rejection if address invalid'
    ]
  };

  const statusKey = statusCategory.toUpperCase().replace(/\s+/g, '_');
  const statusRecs = statusSpecificRecommendations[statusKey] || [];

  return [...baseRecommendations, ...statusRecs];
}

/**
 * Get risk assessment based on verification type and status
 */
export function getRiskAssessment(verificationType: string, statusCategory: string): {
  level: 'LOW' | 'MEDIUM' | 'HIGH';
  factors: string[];
  mitigation: string[];
} {
  // Normalize status category key by removing special characters and replacing spaces with underscores
  const statusKey = statusCategory.toUpperCase()
    .replace(/[&]/g, '') // Remove ampersand
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/_+/g, '_'); // Replace multiple underscores with single underscore

  const statusConfig = STATUS_CATEGORIES[statusKey];
  
  const riskLevel = statusConfig?.riskLevel as 'LOW' | 'MEDIUM' | 'HIGH' || 'MEDIUM';
  
  const riskFactors: Record<string, string[]> = {
    'LOW': ['Minimal verification concerns', 'Standard documentation available'],
    'MEDIUM': ['Some verification limitations', 'Partial information available'],
    'HIGH': ['Significant verification concerns', 'Limited or no information available']
  };

  const mitigationStrategies: Record<string, string[]> = {
    'LOW': ['Regular monitoring', 'Standard follow-up procedures'],
    'MEDIUM': ['Enhanced monitoring', 'Additional verification steps', 'Periodic review'],
    'HIGH': ['Intensive monitoring', 'Immediate escalation', 'Consider rejection', 'Re-verification required']
  };

  return {
    level: riskLevel,
    factors: riskFactors[riskLevel],
    mitigation: mitigationStrategies[riskLevel]
  };
}
