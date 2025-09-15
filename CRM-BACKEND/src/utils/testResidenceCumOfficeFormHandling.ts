/**
 * Test Script for Residence-cum-Office Form Field Handling
 * 
 * This script tests that all residence-cum-office verification form types properly capture
 * all fields in the database with appropriate defaults for missing fields.
 */

import { validateAndPrepareResidenceCumOfficeForm, generateResidenceCumOfficeFieldCoverageReport } from './residenceCumOfficeFormValidator';
import { mapResidenceCumOfficeFormDataToDatabase } from './residenceCumOfficeFormFieldMapping';

// Sample form data for each residence-cum-office verification type
const sampleResidenceCumOfficeFormData = {
  POSITIVE: {
    addressLocatable: 'Easy to Locate',
    addressRating: 'Excellent',
    houseStatus: 'Opened',
    officeStatus: 'Opened',
    metPersonName: 'John Doe',
    metPersonRelation: 'Self',
    totalFamilyMembers: 4,
    workingStatus: 'Salaried',
    stayingPeriod: '5 years',
    stayingStatus: 'On Owned Basis',
    designation: 'Manager',
    applicantDesignation: 'Software Engineer',
    workingPeriod: '3 years',
    officeType: 'Corporate Office',
    companyNatureOfBusiness: 'IT Services',
    staffStrength: 25,
    staffSeen: 20,
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
    metPersonName: 'Security Guard',
    shiftedPeriod: '6 months ago',
    premisesStatus: 'Locked',
    currentCompanyName: 'New Tech Solutions',
    oldOfficeShiftedPeriod: '4 months ago',
    locality: 'Row House',
    addressStructure: '2',
    politicalConnection: 'Not Having Political Connection',
    dominatedArea: 'Not a Community Dominated',
    feedbackFromNeighbour: 'No Adverse',
    otherObservation: 'Both residence and office have shifted',
    finalStatus: 'Negative'
  },
  
  NSP: {
    addressLocatable: 'Easy to Locate',
    addressRating: 'Average',
    houseStatus: 'Closed',
    officeStatus: 'Closed',
    officeExistence: 'Office Not Exist',
    metPersonName: 'Building Manager',
    locality: 'Tower/Building',
    addressStructure: '15',
    politicalConnection: 'Not Having Political Connection',
    dominatedArea: 'Not a Community Dominated',
    feedbackFromNeighbour: 'No Adverse',
    otherObservation: 'Neither residence nor office exist at this location',
    finalStatus: 'Refer'
  },
  
  ENTRY_RESTRICTED: {
    addressLocatable: 'Easy to Locate',
    addressRating: 'Good',
    nameOfMetPerson: 'Security Personnel',
    metPersonType: 'Security',
    metPersonConfirmation: 'Confirmed',
    applicantStayingStatus: 'Staying',
    applicantWorkingStatus: 'Working',
    locality: 'Tower/Building',
    addressStructure: '20',
    politicalConnection: 'Not Having Political Connection',
    dominatedArea: 'Not a Community Dominated',
    feedbackFromNeighbour: 'No Adverse',
    otherObservation: 'Entry restricted by security for both residence and office',
    finalStatus: 'Positive'
  },
  
  UNTRACEABLE: {
    callRemark: 'Number Switch Off',
    contactPerson: 'Reception',
    locality: 'Row House',
    landmark1: 'Near School',
    landmark2: 'Opposite Park',
    landmark3: 'Next to Temple',
    landmark4: 'Behind Market',
    dominatedArea: 'Not a Community Dominated',
    otherObservation: 'Unable to locate both residence and office',
    finalStatus: 'Negative'
  }
};

/**
 * Tests residence-cum-office form field handling for a specific form type
 */
function testResidenceCumOfficeFormType(formType: string, formData: any): void {
  console.log(`\n🧪 Testing ${formType} Residence-cum-Office Form Field Handling:`);
  console.log('='.repeat(60));
  
  try {
    // Test comprehensive validation and preparation
    const { validationResult, preparedData } = validateAndPrepareResidenceCumOfficeForm(formData, formType);
    
    // Generate coverage report
    const coverageReport = generateResidenceCumOfficeFieldCoverageReport(formData, preparedData, formType);
    
    console.log(`✅ Validation Result:`, {
      isValid: validationResult.isValid,
      missingFields: validationResult.missingFields,
      warnings: validationResult.warnings,
      fieldCoverage: validationResult.fieldCoverage
    });
    
    console.log(coverageReport);
    
    // Test legacy mapping function for comparison
    const legacyMappedData = mapResidenceCumOfficeFormDataToDatabase(formData, formType);
    
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
    console.error(`❌ Error testing ${formType} residence-cum-office form:`, error);
  }
}

/**
 * Tests all residence-cum-office verification form types
 */
export function testAllResidenceCumOfficeFormTypes(): void {
  console.log('🚀 Starting Comprehensive Residence-cum-Office Form Field Handling Tests');
  console.log('='.repeat(90));
  
  // Test each form type
  Object.entries(sampleResidenceCumOfficeFormData).forEach(([formType, formData]) => {
    testResidenceCumOfficeFormType(formType, formData);
  });
  
  console.log('\n🎯 Testing Edge Cases:');
  console.log('='.repeat(50));
  
  // Test with minimal data
  testResidenceCumOfficeFormType('POSITIVE', {
    finalStatus: 'Positive',
    addressLocatable: 'Easy to Locate'
  });
  
  // Test with empty data
  testResidenceCumOfficeFormType('UNTRACEABLE', {});
  
  console.log('\n✅ All residence-cum-office verification tests completed!');
}

/**
 * Tests specific field mapping scenarios for residence-cum-office verification
 */
export function testResidenceCumOfficeFieldMappingScenarios(): void {
  console.log('\n🔍 Testing Specific Residence-cum-Office Field Mapping Scenarios:');
  console.log('='.repeat(70));
  
  // Test field name variations
  const fieldVariations = {
    addressFloor: '5', // Should map to address_floor
    metPersonName: 'Manager', // Should map to met_person_name
    totalFamilyMembers: 4, // Should map to total_family_members
    staffStrength: 25, // Should map to staff_strength
    officeApproxArea: 1500, // Should map to office_approx_area
    nameOnBoard: 'Company ABC', // Should map to name_on_company_board
    nameOnCompanyBoard: 'Tech Corp' // Should also map to name_on_company_board
  };
  
  const { validationResult, preparedData } = validateAndPrepareResidenceCumOfficeForm(fieldVariations, 'POSITIVE');
  
  console.log('Residence-cum-Office field mapping test results:', {
    addressFloorMapping: preparedData.address_floor,
    metPersonNameMapping: preparedData.met_person_name,
    totalFamilyMembersMapping: preparedData.total_family_members,
    staffStrengthMapping: preparedData.staff_strength,
    officeApproxAreaMapping: preparedData.office_approx_area,
    nameOnCompanyBoardMapping: preparedData.name_on_company_board
  });
}

// Export test functions for use in other modules
export { testResidenceCumOfficeFormType, sampleResidenceCumOfficeFormData };

// Run tests if this file is executed directly
if (require.main === module) {
  testAllResidenceCumOfficeFormTypes();
  testResidenceCumOfficeFieldMappingScenarios();
}
