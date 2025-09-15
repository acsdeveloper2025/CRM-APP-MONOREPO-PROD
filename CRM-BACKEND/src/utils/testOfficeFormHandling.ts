/**
 * Test Script for Office Form Field Handling
 * 
 * This script tests that all office verification form types properly capture
 * all fields in the database with appropriate defaults for missing fields.
 */

import { validateAndPrepareOfficeForm, generateOfficeFieldCoverageReport } from './officeFormValidator';
import { mapOfficeFormDataToDatabase } from './officeFormFieldMapping';

// Sample form data for each office verification type
const sampleOfficeFormData = {
  POSITIVE: {
    addressLocatable: 'Easy to Locate',
    addressRating: 'Excellent',
    officeStatus: 'Opened',
    metPerson: 'HR Manager',
    designation: 'Manager',
    workingPeriod: '3 years',
    applicantDesignation: 'Software Engineer',
    workingStatus: 'Working',
    officeType: 'Corporate Office',
    companyNatureOfBusiness: 'IT Services',
    staffStrength: 50,
    staffSeen: 25,
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
    officeStatus: 'Closed',
    metPerson: 'Security Guard',
    designation: 'Security',
    currentCompanyName: 'New Tech Solutions',
    oldOfficeShiftedPeriod: '6 months ago',
    locality: 'Row House',
    addressStructure: '2',
    politicalConnection: 'Not Having Political Connection',
    dominatedArea: 'Not a Community Dominated',
    feedbackFromNeighbour: 'No Adverse',
    otherObservation: 'Office has shifted to new location',
    finalStatus: 'Negative'
  },
  
  NSP: {
    addressLocatable: 'Easy to Locate',
    addressRating: 'Average',
    officeStatus: 'Closed',
    officeExistence: 'Office Not Exist',
    metPerson: 'Building Manager',
    designation: 'Manager',
    locality: 'Tower/Building',
    addressStructure: '15',
    politicalConnection: 'Not Having Political Connection',
    dominatedArea: 'Not a Community Dominated',
    feedbackFromNeighbour: 'No Adverse',
    otherObservation: 'Office does not exist at this location',
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
    otherObservation: 'Unable to locate the office',
    finalStatus: 'Negative'
  }
};

/**
 * Tests office form field handling for a specific form type
 */
function testOfficeFormType(formType: string, formData: any): void {
  console.log(`\n🧪 Testing ${formType} Office Form Field Handling:`);
  console.log('='.repeat(50));
  
  try {
    // Test comprehensive validation and preparation
    const { validationResult, preparedData } = validateAndPrepareOfficeForm(formData, formType);
    
    // Generate coverage report
    const coverageReport = generateOfficeFieldCoverageReport(formData, preparedData, formType);
    
    console.log(`✅ Validation Result:`, {
      isValid: validationResult.isValid,
      missingFields: validationResult.missingFields,
      warnings: validationResult.warnings,
      fieldCoverage: validationResult.fieldCoverage
    });
    
    console.log(coverageReport);
    
    // Test legacy mapping function for comparison
    const legacyMappedData = mapOfficeFormDataToDatabase(formData, formType);
    
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
    console.error(`❌ Error testing ${formType} office form:`, error);
  }
}

/**
 * Tests all office verification form types
 */
export function testAllOfficeFormTypes(): void {
  console.log('🚀 Starting Comprehensive Office Form Field Handling Tests');
  console.log('='.repeat(80));
  
  // Test each form type
  Object.entries(sampleOfficeFormData).forEach(([formType, formData]) => {
    testOfficeFormType(formType, formData);
  });
  
  console.log('\n🎯 Testing Edge Cases:');
  console.log('='.repeat(50));
  
  // Test with minimal data
  testOfficeFormType('POSITIVE', {
    finalStatus: 'Positive',
    addressLocatable: 'Easy to Locate'
  });
  
  // Test with empty data
  testOfficeFormType('UNTRACEABLE', {});
  
  console.log('\n✅ All office verification tests completed!');
}

/**
 * Tests specific field mapping scenarios for office verification
 */
export function testOfficeFieldMappingScenarios(): void {
  console.log('\n🔍 Testing Specific Office Field Mapping Scenarios:');
  console.log('='.repeat(50));
  
  // Test field name variations
  const fieldVariations = {
    addressFloor: '5', // Should map to address_floor
    metPerson: 'Manager', // Should map to met_person_name
    metPersonName: 'HR Manager', // Should also map to met_person_name
    staffStrength: 25, // Should map to staff_strength
    officeApproxArea: 1000 // Should map to office_approx_area
  };
  
  const { validationResult, preparedData } = validateAndPrepareOfficeForm(fieldVariations, 'POSITIVE');
  
  console.log('Office field mapping test results:', {
    addressFloorMapping: preparedData.address_floor,
    metPersonNameMapping: preparedData.met_person_name,
    staffStrengthMapping: preparedData.staff_strength,
    officeApproxAreaMapping: preparedData.office_approx_area
  });
}

// Export test functions for use in other modules
export { testOfficeFormType, sampleOfficeFormData };

// Run tests if this file is executed directly
if (require.main === module) {
  testAllOfficeFormTypes();
  testOfficeFieldMappingScenarios();
}
