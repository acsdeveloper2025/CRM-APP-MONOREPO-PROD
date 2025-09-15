/**
 * Test Script for Builder Form Field Handling
 * 
 * This script tests that all builder verification form types properly capture
 * all fields in the database with appropriate defaults for missing fields.
 */

import { validateAndPrepareBuilderForm, generateBuilderFieldCoverageReport } from './builderFormValidator';
import { mapBuilderFormDataToDatabase } from './builderFormFieldMapping';

// Sample form data for each builder verification type
const sampleBuilderFormData = {
  POSITIVE: {
    addressLocatable: 'Easy to Locate',
    addressRating: 'Excellent',
    officeStatus: 'Opened',
    metPerson: 'Project Manager',
    designation: 'Manager',
    workingPeriod: '5 years',
    applicantDesignation: 'Site Engineer',
    workingStatus: 'Working',
    builderType: 'Private Builder',
    companyNatureOfBusiness: 'Real Estate Development',
    staffStrength: 50,
    staffSeen: 40,
    projectName: 'Green Valley Apartments',
    projectType: 'Residential',
    projectStatus: 'Under Construction',
    projectApprovalStatus: 'Approved',
    projectArea: 5000,
    totalUnits: 200,
    soldUnits: 150,
    constructionStage: '70% Complete',
    approvalAuthority: 'Municipal Corporation',
    reraRegistration: 'Yes',
    reraNumber: 'RERA123456789',
    licenseStatus: 'Valid',
    licenseNumber: 'LIC987654321',
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
    currentCompanyName: 'New Construction Ltd',
    oldOfficeShiftedPeriod: '1 year ago',
    locality: 'Row House',
    addressStructure: '2',
    politicalConnection: 'Not Having Political Connection',
    dominatedArea: 'Not a Community Dominated',
    feedbackFromNeighbour: 'No Adverse',
    otherObservation: 'Builder office has shifted to new location',
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
    otherObservation: 'Builder office does not exist at this location',
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
    otherObservation: 'Unable to locate the builder office',
    finalStatus: 'Negative'
  }
};

/**
 * Tests builder form field handling for a specific form type
 */
function testBuilderFormType(formType: string, formData: any): void {
  console.log(`\n🧪 Testing ${formType} Builder Form Field Handling:`);
  console.log('='.repeat(50));
  
  try {
    // Test comprehensive validation and preparation
    const { validationResult, preparedData } = validateAndPrepareBuilderForm(formData, formType);
    
    // Generate coverage report
    const coverageReport = generateBuilderFieldCoverageReport(formData, preparedData, formType);
    
    console.log(`✅ Validation Result:`, {
      isValid: validationResult.isValid,
      missingFields: validationResult.missingFields,
      warnings: validationResult.warnings,
      fieldCoverage: validationResult.fieldCoverage
    });
    
    console.log(coverageReport);
    
    // Test legacy mapping function for comparison
    const legacyMappedData = mapBuilderFormDataToDatabase(formData, formType);
    
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
    console.error(`❌ Error testing ${formType} builder form:`, error);
  }
}

/**
 * Tests all builder verification form types
 */
export function testAllBuilderFormTypes(): void {
  console.log('🚀 Starting Comprehensive Builder Form Field Handling Tests');
  console.log('='.repeat(80));
  
  // Test each form type
  Object.entries(sampleBuilderFormData).forEach(([formType, formData]) => {
    testBuilderFormType(formType, formData);
  });
  
  console.log('\n🎯 Testing Edge Cases:');
  console.log('='.repeat(50));
  
  // Test with minimal data
  testBuilderFormType('POSITIVE', {
    finalStatus: 'Positive',
    addressLocatable: 'Easy to Locate'
  });
  
  // Test with empty data
  testBuilderFormType('UNTRACEABLE', {});
  
  console.log('\n✅ All builder verification tests completed!');
}

/**
 * Tests specific field mapping scenarios for builder verification
 */
export function testBuilderFieldMappingScenarios(): void {
  console.log('\n🔍 Testing Specific Builder Field Mapping Scenarios:');
  console.log('='.repeat(50));
  
  // Test field name variations
  const fieldVariations = {
    addressFloor: '5', // Should map to address_floor
    metPerson: 'Manager', // Should map to met_person_name
    metPersonName: 'Project Manager', // Should also map to met_person_name
    staffStrength: 25, // Should map to staff_strength
    officeApproxArea: 1500, // Should map to office_approx_area
    totalUnits: 100, // Should map to total_units
    soldUnits: 75, // Should map to sold_units
    projectArea: 2000 // Should map to project_area
  };
  
  const { validationResult, preparedData } = validateAndPrepareBuilderForm(fieldVariations, 'POSITIVE');
  
  console.log('Builder field mapping test results:', {
    addressFloorMapping: preparedData.address_floor,
    metPersonNameMapping: preparedData.met_person_name,
    staffStrengthMapping: preparedData.staff_strength,
    officeApproxAreaMapping: preparedData.office_approx_area,
    totalUnitsMapping: preparedData.total_units,
    soldUnitsMapping: preparedData.sold_units,
    projectAreaMapping: preparedData.project_area
  });
}

// Export test functions for use in other modules
export { testBuilderFormType, sampleBuilderFormData };

// Run tests if this file is executed directly
if (require.main === module) {
  testAllBuilderFormTypes();
  testBuilderFieldMappingScenarios();
}
