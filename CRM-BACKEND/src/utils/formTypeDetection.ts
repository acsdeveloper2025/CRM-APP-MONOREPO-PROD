/**
 * Enhanced Form Type Detection Utilities
 *
 * This module provides comprehensive utilities for detecting form types and verification outcomes
 * based on form data submitted from mobile applications across all 9 verification types.
 */

export interface FormTypeResult {
  formType: string;
  verificationOutcome: string;
  confidence: number; // 0-100 confidence score
  detectionMethod: string; // How the type was detected
}

export interface FormTypeIndicators {
  positiveIndicators: string[];
  shiftedIndicators: string[];
  nspIndicators: string[];
  entryRestrictedIndicators: string[];
  untraceableIndicators: string[];
}

/**
 * Universal verification outcome mappings for all verification types
 */
export const UNIVERSAL_OUTCOME_MAPPING: Record<string, FormTypeResult> = {
  // Standard verification outcomes
  'VERIFIED': { formType: 'POSITIVE', verificationOutcome: 'Positive & Door Locked', confidence: 95, detectionMethod: 'outcome_mapping' },
  'POSITIVE': { formType: 'POSITIVE', verificationOutcome: 'Positive & Door Locked', confidence: 95, detectionMethod: 'outcome_mapping' },
  'Positive & Door Locked': { formType: 'POSITIVE', verificationOutcome: 'Positive & Door Locked', confidence: 100, detectionMethod: 'outcome_mapping' },
  'SUCCESSFUL': { formType: 'POSITIVE', verificationOutcome: 'Positive & Door Locked', confidence: 90, detectionMethod: 'outcome_mapping' },
  'COMPLETED': { formType: 'POSITIVE', verificationOutcome: 'Positive & Door Locked', confidence: 85, detectionMethod: 'outcome_mapping' },

  'SHIFTED': { formType: 'SHIFTED', verificationOutcome: 'Shifted & Door Lock', confidence: 95, detectionMethod: 'outcome_mapping' },
  'Shifted & Door Lock': { formType: 'SHIFTED', verificationOutcome: 'Shifted & Door Lock', confidence: 100, detectionMethod: 'outcome_mapping' },
  'Shifted & Door Locked': { formType: 'SHIFTED', verificationOutcome: 'Shifted & Door Lock', confidence: 100, detectionMethod: 'outcome_mapping' },
  'RELOCATED': { formType: 'SHIFTED', verificationOutcome: 'Shifted & Door Lock', confidence: 90, detectionMethod: 'outcome_mapping' },
  'MOVED': { formType: 'SHIFTED', verificationOutcome: 'Shifted & Door Lock', confidence: 85, detectionMethod: 'outcome_mapping' },

  'NSP': { formType: 'NSP', verificationOutcome: 'NSP & Door Lock', confidence: 95, detectionMethod: 'outcome_mapping' },
  'NSP & Door Lock': { formType: 'NSP', verificationOutcome: 'NSP & Door Lock', confidence: 100, detectionMethod: 'outcome_mapping' },
  'NSP & NSP Door Locked': { formType: 'NSP', verificationOutcome: 'NSP & Door Lock', confidence: 100, detectionMethod: 'outcome_mapping' },
  'NOT_STAYING_PERMANENTLY': { formType: 'NSP', verificationOutcome: 'NSP & Door Lock', confidence: 90, detectionMethod: 'outcome_mapping' },

  'ERT': { formType: 'ENTRY_RESTRICTED', verificationOutcome: 'ERT', confidence: 95, detectionMethod: 'outcome_mapping' },
  'ENTRY_RESTRICTED': { formType: 'ENTRY_RESTRICTED', verificationOutcome: 'ERT', confidence: 95, detectionMethod: 'outcome_mapping' },
  'Entry Restricted': { formType: 'ENTRY_RESTRICTED', verificationOutcome: 'ERT', confidence: 100, detectionMethod: 'outcome_mapping' },
  'ACCESS_DENIED': { formType: 'ENTRY_RESTRICTED', verificationOutcome: 'ERT', confidence: 90, detectionMethod: 'outcome_mapping' },
  'RESTRICTED': { formType: 'ENTRY_RESTRICTED', verificationOutcome: 'ERT', confidence: 85, detectionMethod: 'outcome_mapping' },

  'UNTRACEABLE': { formType: 'UNTRACEABLE', verificationOutcome: 'Untraceable', confidence: 95, detectionMethod: 'outcome_mapping' },
  'Untraceable': { formType: 'UNTRACEABLE', verificationOutcome: 'Untraceable', confidence: 100, detectionMethod: 'outcome_mapping' },
  'NOT_FOUND': { formType: 'UNTRACEABLE', verificationOutcome: 'Untraceable', confidence: 90, detectionMethod: 'outcome_mapping' },
  'UNREACHABLE': { formType: 'UNTRACEABLE', verificationOutcome: 'Untraceable', confidence: 85, detectionMethod: 'outcome_mapping' },

  // Legacy mappings
  'NOT_VERIFIED': { formType: 'NSP', verificationOutcome: 'NSP & Door Lock', confidence: 80, detectionMethod: 'legacy_mapping' },
  'NEGATIVE': { formType: 'NSP', verificationOutcome: 'NSP & Door Lock', confidence: 75, detectionMethod: 'legacy_mapping' },
  'FRAUD': { formType: 'NSP', verificationOutcome: 'NSP & Door Lock', confidence: 85, detectionMethod: 'legacy_mapping' },
  'REFER': { formType: 'ENTRY_RESTRICTED', verificationOutcome: 'ERT', confidence: 70, detectionMethod: 'legacy_mapping' },
  'HOLD': { formType: 'ENTRY_RESTRICTED', verificationOutcome: 'ERT', confidence: 70, detectionMethod: 'legacy_mapping' },
  'PARTIAL': { formType: 'ENTRY_RESTRICTED', verificationOutcome: 'ERT', confidence: 75, detectionMethod: 'legacy_mapping' },
};

/**
 * Form type indicators for different verification types
 */
export const FORM_TYPE_INDICATORS: Record<string, FormTypeIndicators> = {
  RESIDENCE: {
    positiveIndicators: ['applicantName', 'familyMembers', 'yearsOfStay', 'ownershipStatus', 'rentAmount', 'houseStatus', 'totalFamilyMembers', 'workingStatus', 'stayingStatus', 'documentShownStatus'],
    shiftedIndicators: ['shiftedPeriod', 'roomStatus', 'premisesStatus', 'currentLocation', 'previousAddress', 'metPersonStatus'],
    nspIndicators: ['stayingPersonName', 'houseStatus', 'temporaryStay'],
    entryRestrictedIndicators: ['nameOfMetPerson', 'metPersonType', 'applicantStayingStatus', 'entryRestrictionReason'],
    untraceableIndicators: ['callRemark', 'landmark3', 'landmark4', 'contactPerson', 'alternateContact']
  },
  OFFICE: {
    positiveIndicators: ['companyName', 'businessType', 'numberOfEmployees', 'officeArea', 'businessHours'],
    shiftedIndicators: ['shiftedPeriod', 'currentLocation', 'premisesStatus', 'previousOfficeAddress'],
    nspIndicators: ['temporaryOffice', 'businessStatus', 'operationalStatus'],
    entryRestrictedIndicators: ['entryRestrictionReason', 'securityPersonName', 'accessDenied'],
    untraceableIndicators: ['callRemark', 'contactPerson', 'businessClosed', 'noResponse']
  },
  BUSINESS: {
    positiveIndicators: ['businessName', 'businessType', 'licenseNumber', 'annualTurnover', 'customerFootfall'],
    shiftedIndicators: ['shiftedPeriod', 'currentLocation', 'premisesStatus', 'previousBusinessAddress'],
    nspIndicators: ['businessOperational', 'temporaryBusiness', 'seasonalBusiness'],
    entryRestrictedIndicators: ['entryRestrictionReason', 'securityPersonName', 'restrictedAccess'],
    untraceableIndicators: ['callRemark', 'contactPerson', 'businessClosed', 'phoneNotReachable']
  },
  BUILDER: {
    positiveIndicators: ['builderName', 'projectName', 'reraNumber', 'projectStatus', 'totalUnits'],
    shiftedIndicators: ['shiftedPeriod', 'currentLocation', 'premisesStatus', 'projectShifted'],
    nspIndicators: ['projectStatus', 'constructionStatus', 'temporaryOffice'],
    entryRestrictedIndicators: ['entryRestrictionReason', 'securityPersonName', 'siteRestricted'],
    untraceableIndicators: ['callRemark', 'contactPerson', 'projectAbandoned', 'builderUntraceable']
  },
  RESIDENCE_CUM_OFFICE: {
    positiveIndicators: ['applicantName', 'businessName', 'dualUsage', 'businessHours', 'familyMembers'],
    shiftedIndicators: ['shiftedPeriod', 'currentLocation', 'premisesStatus', 'businessShifted'],
    nspIndicators: ['temporaryUsage', 'businessStatus', 'residenceStatus'],
    entryRestrictedIndicators: ['entryRestrictionReason', 'securityPersonName', 'accessRestricted'],
    untraceableIndicators: ['callRemark', 'contactPerson', 'premisesClosed', 'noActivity']
  },
  NOC: {
    positiveIndicators: ['nocNumber', 'nocStatus', 'issuingAuthority', 'nocValidityDate', 'complianceStatus'],
    shiftedIndicators: ['shiftedPeriod', 'currentLocation', 'premisesStatus', 'nocTransferred'],
    nspIndicators: ['nocStatus', 'temporaryNoc', 'conditionalNoc'],
    entryRestrictedIndicators: ['entryRestrictionReason', 'securityPersonName', 'documentRestricted'],
    untraceableIndicators: ['callRemark', 'contactPerson', 'nocCancelled', 'authorityUntraceable']
  },
  PROPERTY_APF: {
    positiveIndicators: ['apfNumber', 'apfStatus', 'propertyValue', 'projectName', 'builderName'],
    shiftedIndicators: ['shiftedPeriod', 'currentLocation', 'premisesStatus', 'propertyShifted'],
    nspIndicators: ['apfStatus', 'temporaryApf', 'conditionalApf'],
    entryRestrictedIndicators: ['entryRestrictionReason', 'securityPersonName', 'propertyRestricted'],
    untraceableIndicators: ['callRemark', 'contactPerson', 'propertyCancelled', 'apfUntraceable']
  },
  PROPERTY_INDIVIDUAL: {
    positiveIndicators: ['ownerName', 'propertyType', 'propertyValue', 'ownershipStatus', 'familyMembers'],
    shiftedIndicators: ['shiftedPeriod', 'currentLocation', 'premisesStatus', 'ownerShifted'],
    nspIndicators: ['ownershipStatus', 'temporaryOwnership', 'disputedProperty'],
    entryRestrictedIndicators: ['entryRestrictionReason', 'securityPersonName', 'propertyLocked'],
    untraceableIndicators: ['callRemark', 'contactPerson', 'ownerUntraceable', 'propertyAbandoned']
  },
  DSA_CONNECTOR: {
    positiveIndicators: ['connectorName', 'connectorCode', 'businessName', 'licenseStatus', 'monthlyBusinessVolume'],
    shiftedIndicators: ['shiftedPeriod', 'currentLocation', 'premisesStatus', 'businessShifted'],
    nspIndicators: ['businessOperational', 'temporaryBusiness', 'connectorStatus'],
    entryRestrictedIndicators: ['entryRestrictionReason', 'securityPersonName', 'officeRestricted'],
    untraceableIndicators: ['callRemark', 'contactPerson', 'businessClosed', 'connectorUntraceable']
  }
};

/**
 * Enhanced form type detection with confidence scoring and multiple detection methods
 *
 * @param formData - The form data submitted from mobile app
 * @param verificationType - The type of verification being performed
 * @returns Object containing formType, verificationOutcome, confidence, and detectionMethod
 */
export function detectFormTypeEnhanced(formData: any, verificationType: string = 'RESIDENCE'): FormTypeResult {
  const outcome = formData.outcome || formData.finalStatus || formData.verificationOutcome;
  const normalizedType = verificationType.toUpperCase();

  console.log(`🔍 Enhanced form type detection for ${normalizedType}:`, {
    outcome,
    hasOutcome: !!outcome,
    formDataKeys: Object.keys(formData || {}).length,
    verificationType: normalizedType
  });

  // Method 1: Direct outcome mapping (highest confidence)
  if (outcome && UNIVERSAL_OUTCOME_MAPPING[outcome]) {
    const result = UNIVERSAL_OUTCOME_MAPPING[outcome];
    console.log(`✅ Direct outcome mapping: ${outcome} -> ${result.formType} (confidence: ${result.confidence}%)`);
    return result;
  }

  // Method 2: Field-based detection using indicators
  const indicators = FORM_TYPE_INDICATORS[normalizedType];
  if (indicators) {
    const detectionResult = detectByFieldIndicators(formData, indicators, normalizedType);
    if (detectionResult.confidence > 70) {
      console.log(`✅ Field-based detection: ${detectionResult.formType} (confidence: ${detectionResult.confidence}%)`);
      return detectionResult;
    }
  }

  // Method 3: Pattern-based detection for specific outcomes
  const patternResult = detectByPatterns(formData, normalizedType);
  if (patternResult.confidence > 60) {
    console.log(`✅ Pattern-based detection: ${patternResult.formType} (confidence: ${patternResult.confidence}%)`);
    return patternResult;
  }

  // Method 4: Default fallback with low confidence
  console.log(`⚠️ No specific indicators found, defaulting to POSITIVE form (confidence: 50%)`);
  return {
    formType: 'POSITIVE',
    verificationOutcome: 'Positive & Door Locked',
    confidence: 50,
    detectionMethod: 'default_fallback'
  };
}

/**
 * Detects form type based on field indicators with confidence scoring
 *
 * @param formData - The form data submitted from mobile app
 * @param indicators - Form type indicators for the verification type
 * @param verificationType - The verification type
 * @returns FormTypeResult with confidence score
 */
function detectByFieldIndicators(formData: any, indicators: FormTypeIndicators, verificationType: string): FormTypeResult {
  const scores = {
    POSITIVE: 0,
    SHIFTED: 0,
    NSP: 0,
    ENTRY_RESTRICTED: 0,
    UNTRACEABLE: 0
  };

  // Calculate scores based on field presence
  indicators.positiveIndicators.forEach(field => {
    if (formData[field] && formData[field] !== null && formData[field] !== '') {
      scores.POSITIVE += 10;
    }
  });

  indicators.shiftedIndicators.forEach(field => {
    if (formData[field] && formData[field] !== null && formData[field] !== '') {
      scores.SHIFTED += 15; // Higher weight for specific indicators
    }
  });

  indicators.nspIndicators.forEach(field => {
    if (formData[field] && formData[field] !== null && formData[field] !== '') {
      scores.NSP += 12;
    }
  });

  indicators.entryRestrictedIndicators.forEach(field => {
    if (formData[field] && formData[field] !== null && formData[field] !== '') {
      scores.ENTRY_RESTRICTED += 15;
    }
  });

  indicators.untraceableIndicators.forEach(field => {
    if (formData[field] && formData[field] !== null && formData[field] !== '') {
      scores.UNTRACEABLE += 20; // Highest weight for untraceable indicators
    }
  });

  // Find the highest scoring form type
  const maxScore = Math.max(...Object.values(scores));
  const detectedType = Object.keys(scores).find(key => scores[key as keyof typeof scores] === maxScore) || 'POSITIVE';

  // Calculate confidence based on score and field presence
  const totalFields = Object.keys(formData).length;
  const confidence = Math.min(95, Math.max(30, (maxScore / totalFields) * 100));

  return {
    formType: detectedType,
    verificationOutcome: getVerificationOutcome(detectedType),
    confidence: Math.round(confidence),
    detectionMethod: 'field_indicators'
  };
}

/**
 * Detects form type based on data patterns and combinations
 *
 * @param formData - The form data submitted from mobile app
 * @param verificationType - The verification type
 * @returns FormTypeResult with confidence score
 */
function detectByPatterns(formData: any, verificationType: string): FormTypeResult {
  let confidence = 40;
  let formType = 'POSITIVE';
  let detectionMethod = 'pattern_analysis';

  // Pattern 1: Phone/contact related patterns for UNTRACEABLE
  if ((formData.callRemark && formData.callRemark.toLowerCase().includes('not reachable')) ||
      (formData.contactPerson && !formData.metPersonName) ||
      (formData.phoneStatus && formData.phoneStatus.toLowerCase().includes('switched off'))) {
    formType = 'UNTRACEABLE';
    confidence = 85;
  }

  // Pattern 2: Location/address patterns for SHIFTED
  else if ((formData.currentLocation && formData.shiftedPeriod) ||
           (formData.premisesStatus && formData.premisesStatus.toLowerCase().includes('vacant')) ||
           (formData.addressStatus && formData.addressStatus.toLowerCase().includes('shifted'))) {
    formType = 'SHIFTED';
    confidence = 80;
  }

  // Pattern 3: Access/security patterns for ENTRY_RESTRICTED
  else if ((formData.entryRestrictionReason) ||
           (formData.securityPersonName && !formData.metPersonName) ||
           (formData.accessStatus && formData.accessStatus.toLowerCase().includes('denied'))) {
    formType = 'ENTRY_RESTRICTED';
    confidence = 75;
  }

  // Pattern 4: Temporary/status patterns for NSP
  else if ((formData.temporaryStay || formData.temporaryBusiness || formData.temporaryOffice) ||
           (formData.stayingStatus && formData.stayingStatus.toLowerCase().includes('temporary')) ||
           (formData.businessStatus && formData.businessStatus.toLowerCase().includes('closed'))) {
    formType = 'NSP';
    confidence = 70;
  }

  return {
    formType,
    verificationOutcome: getVerificationOutcome(formType),
    confidence,
    detectionMethod
  };
}

/**
 * Gets the appropriate verification outcome for a form type
 *
 * @param formType - The detected form type
 * @returns Verification outcome string
 */
function getVerificationOutcome(formType: string): string {
  const outcomeMap: Record<string, string> = {
    'POSITIVE': 'Positive & Door Locked',
    'SHIFTED': 'Shifted & Door Lock',
    'NSP': 'NSP & Door Lock',
    'ENTRY_RESTRICTED': 'ERT',
    'UNTRACEABLE': 'Untraceable'
  };

  return outcomeMap[formType] || 'Positive & Door Locked';
}

/**
 * Legacy wrapper functions for backward compatibility
 */

/**
 * Detects residence form type (legacy function - use detectFormTypeEnhanced instead)
 */
export function detectResidenceFormType(formData: any): FormTypeResult {
  return detectFormTypeEnhanced(formData, 'RESIDENCE');
}

/**
 * Detects office form type (legacy function - use detectFormTypeEnhanced instead)
 */
export function detectOfficeFormType(formData: any): FormTypeResult {
  return detectFormTypeEnhanced(formData, 'OFFICE');
}

/**
 * Detects business form type (legacy function - use detectFormTypeEnhanced instead)
 */
export function detectBusinessFormType(formData: any): FormTypeResult {
  return detectFormTypeEnhanced(formData, 'BUSINESS');
}

/**
 * Detects builder form type
 */
export function detectBuilderFormType(formData: any): FormTypeResult {
  return detectFormTypeEnhanced(formData, 'BUILDER');
}

/**
 * Detects residence-cum-office form type
 */
export function detectResidenceCumOfficeFormType(formData: any): FormTypeResult {
  return detectFormTypeEnhanced(formData, 'RESIDENCE_CUM_OFFICE');
}

/**
 * Detects NOC form type
 */
export function detectNocFormType(formData: any): FormTypeResult {
  return detectFormTypeEnhanced(formData, 'NOC');
}

/**
 * Detects Property APF form type
 */
export function detectPropertyApfFormType(formData: any): FormTypeResult {
  return detectFormTypeEnhanced(formData, 'PROPERTY_APF');
}

/**
 * Detects Property Individual form type
 */
export function detectPropertyIndividualFormType(formData: any): FormTypeResult {
  return detectFormTypeEnhanced(formData, 'PROPERTY_INDIVIDUAL');
}

/**
 * Detects DSA/DST Connector form type
 */
export function detectDsaConnectorFormType(formData: any): FormTypeResult {
  return detectFormTypeEnhanced(formData, 'DSA_CONNECTOR');
}

/**
 * Enhanced generic form type detector with support for all verification types
 *
 * @param verificationType - The type of verification (RESIDENCE, OFFICE, BUSINESS, etc.)
 * @param formData - The form data submitted from mobile app
 * @returns Object containing formType, verificationOutcome, confidence, and detectionMethod
 */
export function detectFormType(verificationType: string, formData: any): FormTypeResult {
  return detectFormTypeEnhanced(formData, verificationType);
}

/**
 * Validates if a form type is valid for a given verification type
 *
 * @param verificationType - The verification type
 * @param formType - The form type to validate
 * @returns True if valid, false otherwise
 */
export function isValidFormType(verificationType: string, formType: string): boolean {
  const validFormTypes = ['POSITIVE', 'SHIFTED', 'NSP', 'ENTRY_RESTRICTED', 'UNTRACEABLE'];
  const normalizedType = verificationType.toUpperCase();
  const normalizedFormType = formType.toUpperCase();

  // All verification types support the same form types
  return validFormTypes.includes(normalizedFormType);
}

/**
 * Gets all possible form types for a verification type
 *
 * @param verificationType - The verification type
 * @returns Array of valid form types
 */
export function getValidFormTypes(verificationType: string): string[] {
  const normalizedType = verificationType.toUpperCase();

  // All verification types support the same form types
  return ['POSITIVE', 'SHIFTED', 'NSP', 'ENTRY_RESTRICTED', 'UNTRACEABLE'];
}

/**
 * Gets verification type specific indicators
 *
 * @param verificationType - The verification type
 * @returns FormTypeIndicators for the verification type
 */
export function getFormTypeIndicators(verificationType: string): FormTypeIndicators | null {
  const normalizedType = verificationType.toUpperCase();
  return FORM_TYPE_INDICATORS[normalizedType] || null;
}

/**
 * Analyzes form data and provides detailed detection information
 *
 * @param formData - The form data submitted from mobile app
 * @param verificationType - The verification type
 * @returns Detailed analysis of form type detection
 */
export function analyzeFormTypeDetection(formData: any, verificationType: string = 'RESIDENCE'): {
  result: FormTypeResult;
  analysis: {
    outcomeFound: boolean;
    fieldIndicators: Record<string, number>;
    patternMatches: string[];
    totalFields: number;
    confidenceFactors: string[];
  };
} {
  const outcome = formData.outcome || formData.finalStatus || formData.verificationOutcome;
  const normalizedType = verificationType.toUpperCase();
  const indicators = FORM_TYPE_INDICATORS[normalizedType];

  const analysis = {
    outcomeFound: !!outcome && !!UNIVERSAL_OUTCOME_MAPPING[outcome],
    fieldIndicators: {
      POSITIVE: 0,
      SHIFTED: 0,
      NSP: 0,
      ENTRY_RESTRICTED: 0,
      UNTRACEABLE: 0
    },
    patternMatches: [] as string[],
    totalFields: Object.keys(formData || {}).length,
    confidenceFactors: [] as string[]
  };

  // Analyze field indicators
  if (indicators) {
    indicators.positiveIndicators.forEach(field => {
      if (formData[field] && formData[field] !== null && formData[field] !== '') {
        analysis.fieldIndicators.POSITIVE += 10;
      }
    });

    indicators.shiftedIndicators.forEach(field => {
      if (formData[field] && formData[field] !== null && formData[field] !== '') {
        analysis.fieldIndicators.SHIFTED += 15;
      }
    });

    indicators.nspIndicators.forEach(field => {
      if (formData[field] && formData[field] !== null && formData[field] !== '') {
        analysis.fieldIndicators.NSP += 12;
      }
    });

    indicators.entryRestrictedIndicators.forEach(field => {
      if (formData[field] && formData[field] !== null && formData[field] !== '') {
        analysis.fieldIndicators.ENTRY_RESTRICTED += 15;
      }
    });

    indicators.untraceableIndicators.forEach(field => {
      if (formData[field] && formData[field] !== null && formData[field] !== '') {
        analysis.fieldIndicators.UNTRACEABLE += 20;
      }
    });
  }

  // Analyze patterns
  if (formData.callRemark && formData.callRemark.toLowerCase().includes('not reachable')) {
    analysis.patternMatches.push('phone_unreachable');
  }
  if (formData.shiftedPeriod && formData.currentLocation) {
    analysis.patternMatches.push('location_shifted');
  }
  if (formData.entryRestrictionReason) {
    analysis.patternMatches.push('access_restricted');
  }

  // Build confidence factors
  if (analysis.outcomeFound) {
    analysis.confidenceFactors.push('direct_outcome_mapping');
  }
  if (Math.max(...Object.values(analysis.fieldIndicators)) > 20) {
    analysis.confidenceFactors.push('strong_field_indicators');
  }
  if (analysis.patternMatches.length > 0) {
    analysis.confidenceFactors.push('pattern_matches');
  }
  if (analysis.totalFields > 10) {
    analysis.confidenceFactors.push('comprehensive_data');
  }

  const result = detectFormTypeEnhanced(formData, verificationType);

  return { result, analysis };
}
