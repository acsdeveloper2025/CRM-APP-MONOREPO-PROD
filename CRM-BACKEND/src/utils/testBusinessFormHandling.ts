/**
 * Test Script for Business Form Field Handling
 * 
 * This script tests that all business verification form types properly capture
 * all fields in the database with appropriate defaults for missing fields.
 */

import { validateAndPrepareBusinessForm, generateBusinessFieldCoverageReport } from './businessFormValidator';
import { mapBusinessFormDataToDatabase } from './businessFormFieldMapping';

// Sample form data for each business verification type
const sampleBusinessFormData = {
  POSITIVE: {
    addressLocatable: 'Easy to Locate',
    addressRating: 'Excellent',
    businessStatus: 'Opened',
    metPerson: 'Business Owner',
    designation: 'Owner',
    workingPeriod: '5 years',
    applicantDesignation: 'Manager',
    workingStatus: 'Working',
    businessType: 'Retail Store',
    ownershipType: 'Proprietorship',
    companyNatureOfBusiness: 'Retail Sales',
    staffStrength: 10,
    staffSeen: 8,
    locality: 'Tower/Building',
    addressStructure: '10',
    politicalConnection: 'Not Having Political Connection',
    dominatedArea: 'Not a Community Dominated',
    feedbackFromNeighbour: 'No Adverse',
    otherObservation: 'All details verified successfully',
    finalStatus: 'Positive'
  },
  
  SHIFTED: {
    addressLocatable: 'Difficult to Locate',
    addressRating: 'Good',
    businessStatus: 'Closed',
    metPerson: 'Security Guard',
    designation: 'Security',
    currentCompanyName: 'New Business Ventures',
    oldBusinessShiftedPeriod: '8 months ago',
    locality: 'Row House',
    addressStructure: '2',
    politicalConnection: 'Not Having Political Connection',
    dominatedArea: 'Not a Community Dominated',
    feedbackFromNeighbour: 'No Adverse',
    otherObservation: 'Business has shifted to new location',
    finalStatus: 'Negative'
  },
  
  NSP: {
    addressLocatable: 'Easy to Locate',
    addressRating: 'Average',
    businessStatus: 'Closed',
    businessExistence: 'Business Not Exist',
    metPerson: 'Building Manager',
    designation: 'Manager',
    locality: 'Tower/Building',
    addressStructure: '15',
    politicalConnection: 'Not Having Political Connection',
    dominatedArea: 'Not a Community Dominated',
    feedbackFromNeighbour: 'No Adverse',
    otherObservation: 'Business does not exist at this location',
    finalStatus: 'Refer'
  },
  
  ENTRY_RESTRICTED: {
    addressLocatable: 'Easy to Locate',
    addressRating: 'Good',
    nameOfMetPerson: 'Security Personnel',
    metPersonType: 'Security',
    metPersonConfirmation: 'Confirmed',
    applicantWorkingStatus: 'Working',
    locality: 'Tower/Building',
    addressStructure: '20',
    politicalConnection: 'Not Having Political Connection',
    dominatedArea: 'Not a Community Dominated',
    feedbackFromNeighbour: 'No Adverse',
    otherObservation: 'Entry restricted by security',
    finalStatus: 'Positive'
  },
  
  UNTRACEABLE: {
    contactPerson: 'Reception',
    callRemark: 'Number Switch Off',
    locality: 'Row House',
    landmark1: 'Near School',
    landmark2: 'Opposite Park',
    landmark3: 'Next to Temple',
    landmark4: 'Behind Market',
    dominatedArea: 'Not a Community Dominated',
    otherObservation: 'Unable to locate the business',
    finalStatus: 'Negative'
  }
};

/**
 * Tests business form field handling for a specific form type
 */
function testBusinessFormType(formType: string, formData: any): void {
  console.log(`\n🧪 Testing ${formType} Business Form Field Handling:`);
  console.log('='.repeat(50));
  
  try {
    // Test comprehensive validation and preparation
    const { validationResult, preparedData } = validateAndPrepareBusinessForm(formData, formType);
    
    // Generate coverage report
    const coverageReport = generateBusinessFieldCoverageReport(formData, preparedData, formType);
    
    console.log(`✅ Validation Result:`, {
      isValid: validationResult.isValid,
      missingFields: validationResult.missingFields,
      warnings: validationResult.warnings,
      fieldCoverage: validationResult.fieldCoverage
    });
    
    console.log(coverageReport);
    
    // Test legacy mapping function for comparison
    const legacyMappedData = mapBusinessFormDataToDatabase(formData, formType);
    
    console.log(`📊 Comparison:`, {
      newMethodFields: Object.keys(preparedData).length,
      legacyMethodFields: Object.keys(legacyMappedData).length,
      newMethodNullFields: Object.values(preparedData).filter(v => v === null).length,
      legacyMethodNullFields: Object.values(legacyMappedData).filter(v => v === null).length
    });
    
    // Show sample of fields that are defaulted to null
    const nullFields = Object.entries(preparedData)
      .filter(([_, value]) => value === null)
      .slice(0, 10);
    
    if (nullFields.length > 0) {
      console.log(`📝 Sample fields defaulted to null:`, nullFields.map(([key]) => key));
    }
    
    // Show sample of populated fields
    const populatedFields = Object.entries(preparedData)
      .filter(([_, value]) => value !== null && value !== undefined)
      .slice(0, 10);
    
    console.log(`✨ Sample populated fields:`, Object.fromEntries(populatedFields));
    
  } catch (error) {
    console.error(`❌ Error testing ${formType} business form:`, error);
  }
}

/**
 * Tests all business verification form types
 */
export function testAllBusinessFormTypes(): void {
  console.log('🚀 Starting Comprehensive Business Form Field Handling Tests');
  console.log('='.repeat(80));
  
  // Test each form type
  Object.entries(sampleBusinessFormData).forEach(([formType, formData]) => {
    testBusinessFormType(formType, formData);
  });
  
  console.log('\n🎯 Testing Edge Cases:');
  console.log('='.repeat(50));
  
  // Test with minimal data
  testBusinessFormType('POSITIVE', {
    finalStatus: 'Positive',
    addressLocatable: 'Easy to Locate'
  });
  
  // Test with empty data
  testBusinessFormType('UNTRACEABLE', {});
  
  console.log('\n✅ All business verification tests completed!');
}

/**
 * Tests specific field mapping scenarios for business verification
 */
export function testBusinessFieldMappingScenarios(): void {
  console.log('\n🔍 Testing Specific Business Field Mapping Scenarios:');
  console.log('='.repeat(50));
  
  // Test field name variations
  const fieldVariations = {
    addressFloor: '5', // Should map to address_floor
    metPerson: 'Manager', // Should map to met_person_name
    businessExistance: 'Business Exist', // Should map to business_existence (typo handling)
    businessExistence: 'Business Not Exist', // Should also map to business_existence
    staffStrength: 25, // Should map to staff_strength
    businessApproxArea: 1500 // Should map to business_approx_area
  };
  
  const { validationResult, preparedData } = validateAndPrepareBusinessForm(fieldVariations, 'POSITIVE');
  
  console.log('Business field mapping test results:', {
    addressFloorMapping: preparedData.address_floor,
    metPersonNameMapping: preparedData.met_person_name,
    businessExistenceMapping: preparedData.business_existence,
    staffStrengthMapping: preparedData.staff_strength,
    businessApproxAreaMapping: preparedData.business_approx_area
  });
}

// Export test functions for use in other modules
export { testBusinessFormType, sampleBusinessFormData };

// Run tests if this file is executed directly
if (require.main === module) {
  testAllBusinessFormTypes();
  testBusinessFieldMappingScenarios();
}
