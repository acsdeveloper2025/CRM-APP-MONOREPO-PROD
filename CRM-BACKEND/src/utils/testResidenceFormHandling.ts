/**
 * Test Script for Residence Form Field Handling
 * 
 * This script tests that all residence verification form types properly capture
 * all fields in the database with appropriate defaults for missing fields.
 */

import { validateAndPrepareResidenceForm, generateFieldCoverageReport } from './residenceFormValidator';
import { mapFormDataToDatabase } from './residenceFormFieldMapping';

// Sample form data for each residence verification type
const sampleFormData = {
  POSITIVE: {
    addressLocatable: 'Easy to Locate',
    addressRating: 'Excellent',
    houseStatus: 'Opened',
    metPersonName: 'John Doe',
    metPersonRelation: 'Self',
    totalFamilyMembers: 4,
    workingStatus: 'Salaried',
    stayingPeriod: '5 years',
    stayingStatus: 'On Owned Basis',
    documentShownStatus: 'Showed',
    documentType: 'Aadhar Card',
    tpcMetPerson1: 'Neighbour',
    tpcName1: 'Jane Smith',
    tpcConfirmation1: 'Confirmed',
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
    roomStatus: 'Closed',
    metPersonName: 'Security Guard',
    metPersonStatus: 'Neighbour',
    shiftedPeriod: '2 months ago',
    tpcMetPerson1: 'Neighbour',
    tpcName1: 'Local Resident',
    premisesStatus: 'Locked',
    locality: 'Row House',
    addressStructure: '2',
    politicalConnection: 'Not Having Political Connection',
    dominatedArea: 'Not a Community Dominated',
    feedbackFromNeighbour: 'No Adverse',
    otherObservation: 'Family has shifted to new location',
    finalStatus: 'Negative'
  },
  
  NSP: {
    addressLocatable: 'Easy to Locate',
    addressRating: 'Average',
    houseStatus: 'Closed',
    stayingPersonName: 'Temporary Resident',
    locality: 'Tower/Building',
    addressStructure: '15',
    politicalConnection: 'Not Having Political Connection',
    dominatedArea: 'Not a Community Dominated',
    feedbackFromNeighbour: 'No Adverse',
    otherObservation: 'House is closed, temporary person staying',
    finalStatus: 'Refer'
  },
  
  ENTRY_RESTRICTED: {
    addressLocatable: 'Easy to Locate',
    addressRating: 'Good',
    nameOfMetPerson: 'Security Personnel',
    metPerson: 'Security',
    metPersonConfirmation: 'Confirmed',
    applicantStayingStatus: 'Staying',
    locality: 'Tower/Building',
    addressStructure: '20',
    politicalConnection: 'Not Having Political Connection',
    dominatedArea: 'Not a Community Dominated',
    feedbackFromNeighbour: 'No Adverse',
    otherObservation: 'Entry restricted by security',
    finalStatus: 'Positive'
  },
  
  UNTRACEABLE: {
    callRemark: 'Number Switch Off',
    locality: 'Row House',
    landmark1: 'Near School',
    landmark2: 'Opposite Park',
    landmark3: 'Next to Temple',
    landmark4: 'Behind Market',
    dominatedArea: 'Not a Community Dominated',
    otherObservation: 'Unable to locate the address',
    finalStatus: 'Negative'
  }
};

/**
 * Tests form field handling for a specific form type
 */
function testFormType(formType: string, formData: any): void {
  console.log(`\n🧪 Testing ${formType} Form Field Handling:`);
  console.log('='.repeat(50));
  
  try {
    // Test comprehensive validation and preparation
    const { validationResult, preparedData } = validateAndPrepareResidenceForm(formData, formType);
    
    // Generate coverage report
    const coverageReport = generateFieldCoverageReport(formData, preparedData, formType);
    
    console.log(`✅ Validation Result:`, {
      isValid: validationResult.isValid,
      missingFields: validationResult.missingFields,
      warnings: validationResult.warnings,
      fieldCoverage: validationResult.fieldCoverage
    });
    
    console.log(coverageReport);
    
    // Test legacy mapping function for comparison
    const legacyMappedData = mapFormDataToDatabase(formData, formType);
    
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
    console.error(`❌ Error testing ${formType} form:`, error);
  }
}

/**
 * Tests all residence verification form types
 */
export function testAllResidenceFormTypes(): void {
  console.log('🚀 Starting Comprehensive Residence Form Field Handling Tests');
  console.log('='.repeat(80));
  
  // Test each form type
  Object.entries(sampleFormData).forEach(([formType, formData]) => {
    testFormType(formType, formData);
  });
  
  console.log('\n🎯 Testing Edge Cases:');
  console.log('='.repeat(50));
  
  // Test with minimal data
  testFormType('POSITIVE', {
    finalStatus: 'Positive',
    addressLocatable: 'Easy to Locate'
  });
  
  // Test with empty data
  testFormType('UNTRACEABLE', {});
  
  console.log('\n✅ All tests completed!');
}

/**
 * Tests specific field mapping scenarios
 */
export function testFieldMappingScenarios(): void {
  console.log('\n🔍 Testing Specific Field Mapping Scenarios:');
  console.log('='.repeat(50));
  
  // Test field name variations
  const fieldVariations = {
    addressFloor: '5', // Should map to address_floor
    applicantStayingFloor: '3', // Should also map to address_floor
    metPerson: 'Security', // Should map to met_person_type
    metPersonType: 'Neighbour', // Should also map to met_person_type
    familyMembers: 4, // Should map to total_family_members
    totalFamilyMembers: 6 // Should also map to total_family_members
  };
  
  const { validationResult, preparedData } = validateAndPrepareResidenceForm(fieldVariations, 'POSITIVE');
  
  console.log('Field mapping test results:', {
    addressFloorMapping: preparedData.address_floor,
    metPersonTypeMapping: preparedData.met_person_type,
    totalFamilyMembersMapping: preparedData.total_family_members
  });
}

// Export test functions for use in other modules
export { testFormType, sampleFormData };

// Run tests if this file is executed directly
if (require.main === module) {
  testAllResidenceFormTypes();
  testFieldMappingScenarios();
}
