/**
 * Test Script for NOC Form Field Handling
 * 
 * This script tests that all NOC verification form types properly capture
 * all fields in the database with appropriate defaults for missing fields.
 */

import { validateAndPrepareNocForm, generateNocFieldCoverageReport } from './nocFormValidator';
import { mapNocFormDataToDatabase } from './nocFormFieldMapping';

// Sample form data for each NOC verification type
const sampleNocFormData = {
  POSITIVE: {
    addressLocatable: 'Easy to Locate',
    addressRating: 'Excellent',
    nocStatus: 'Available',
    nocType: 'Fire Safety NOC',
    nocNumber: 'FS-NOC-2024-001',
    nocIssueDate: '2024-01-15',
    nocExpiryDate: '2025-01-15',
    nocIssuingAuthority: 'Fire Department',
    nocValidityStatus: 'Valid',
    propertyType: 'Commercial Building',
    projectName: 'Tech Park Phase 1',
    projectStatus: 'Under Construction',
    constructionStatus: '75% Complete',
    projectApprovalStatus: 'Approved',
    builderName: 'ABC Constructions Ltd',
    developerName: 'XYZ Developers',
    contactPerson: 'John Smith',
    contactNumber: '9876543210',
    builderLicenseNumber: 'BL-2024-001',
    environmentalClearance: 'Obtained',
    fireSafetyClearance: 'Valid',
    municipalApproval: 'Approved',
    metPersonName: 'Site Engineer',
    designation: 'Engineer',
    documentShown: 'Yes',
    documentType: 'NOC Certificate',
    locality: 'Tower/Building',
    addressStructure: '10',
    politicalConnection: 'Not Having Political Connection',
    dominatedArea: 'Not a Community Dominated',
    feedbackFromNeighbour: 'No Adverse',
    otherObservation: 'All NOC documents verified successfully',
    finalStatus: 'Positive'
  },
  
  SHIFTED: {
    addressLocatable: 'Difficult to Locate',
    addressRating: 'Good',
    metPersonName: 'Security Guard',
    designation: 'Security',
    shiftedPeriod: '8 months ago',
    currentLocation: 'New Industrial Area',
    locality: 'Row House',
    addressStructure: '2',
    politicalConnection: 'Not Having Political Connection',
    dominatedArea: 'Not a Community Dominated',
    feedbackFromNeighbour: 'No Adverse',
    otherObservation: 'Project has shifted to new location',
    finalStatus: 'Negative'
  },
  
  NSP: {
    addressLocatable: 'Easy to Locate',
    addressRating: 'Average',
    nocStatus: 'Not Available',
    metPersonName: 'Building Manager',
    designation: 'Manager',
    locality: 'Tower/Building',
    addressStructure: '15',
    politicalConnection: 'Not Having Political Connection',
    dominatedArea: 'Not a Community Dominated',
    feedbackFromNeighbour: 'No Adverse',
    otherObservation: 'NOC not available at this location',
    finalStatus: 'Refer'
  },
  
  ENTRY_RESTRICTED: {
    addressLocatable: 'Easy to Locate',
    addressRating: 'Good',
    nameOfMetPerson: 'Security Personnel',
    metPersonType: 'Security',
    metPersonConfirmation: 'Confirmed',
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
    otherObservation: 'Unable to locate the project',
    finalStatus: 'Negative'
  }
};

/**
 * Tests NOC form field handling for a specific form type
 */
function testNocFormType(formType: string, formData: any): void {
  console.log(`\n🧪 Testing ${formType} NOC Form Field Handling:`);
  console.log('='.repeat(50));
  
  try {
    // Test comprehensive validation and preparation
    const { validationResult, preparedData } = validateAndPrepareNocForm(formData, formType);
    
    // Generate coverage report
    const coverageReport = generateNocFieldCoverageReport(formData, preparedData, formType);
    
    console.log(`✅ Validation Result:`, {
      isValid: validationResult.isValid,
      missingFields: validationResult.missingFields,
      warnings: validationResult.warnings,
      fieldCoverage: validationResult.fieldCoverage
    });
    
    console.log(coverageReport);
    
    // Test legacy mapping function for comparison
    const legacyMappedData = mapNocFormDataToDatabase(formData, formType);
    
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
    console.error(`❌ Error testing ${formType} NOC form:`, error);
  }
}

/**
 * Tests all NOC verification form types
 */
export function testAllNocFormTypes(): void {
  console.log('🚀 Starting Comprehensive NOC Form Field Handling Tests');
  console.log('='.repeat(80));
  
  // Test each form type
  Object.entries(sampleNocFormData).forEach(([formType, formData]) => {
    testNocFormType(formType, formData);
  });
  
  console.log('\n🎯 Testing Edge Cases:');
  console.log('='.repeat(50));
  
  // Test with minimal data
  testNocFormType('POSITIVE', {
    finalStatus: 'Positive',
    addressLocatable: 'Easy to Locate'
  });
  
  // Test with empty data
  testNocFormType('UNTRACEABLE', {});
  
  console.log('\n✅ All NOC verification tests completed!');
}

/**
 * Tests specific field mapping scenarios for NOC verification
 */
export function testNocFieldMappingScenarios(): void {
  console.log('\n🔍 Testing Specific NOC Field Mapping Scenarios:');
  console.log('='.repeat(50));
  
  // Test field name variations
  const fieldVariations = {
    addressFloor: '5', // Should map to address_floor
    nocNumber: 'NOC-123456', // Should map to noc_number
    nocType: 'Environmental NOC', // Should map to noc_type
    builderName: 'ABC Builders', // Should map to builder_name
    projectArea: 2500, // Should map to project_area
    totalUnits: 100, // Should map to total_units
    completedUnits: 75, // Should map to completed_units
    contactNumber: '9876543210' // Should map to contact_number
  };
  
  const { validationResult, preparedData } = validateAndPrepareNocForm(fieldVariations, 'POSITIVE');
  
  console.log('NOC field mapping test results:', {
    addressFloorMapping: preparedData.address_floor,
    nocNumberMapping: preparedData.noc_number,
    nocTypeMapping: preparedData.noc_type,
    builderNameMapping: preparedData.builder_name,
    projectAreaMapping: preparedData.project_area,
    totalUnitsMapping: preparedData.total_units,
    completedUnitsMapping: preparedData.completed_units,
    contactNumberMapping: preparedData.contact_number
  });
}

// Export test functions for use in other modules
export { testNocFormType, sampleNocFormData };

// Run tests if this file is executed directly
if (require.main === module) {
  testAllNocFormTypes();
  testNocFieldMappingScenarios();
}
