/**
 * Test Script for Property APF Form Field Handling
 * 
 * This script tests that all Property APF verification form types properly capture
 * all fields in the database with appropriate defaults for missing fields.
 */

import { validateAndPreparePropertyApfForm, generatePropertyApfFieldCoverageReport } from './propertyApfFormValidator';
import { mapPropertyApfFormDataToDatabase } from './propertyApfFormFieldMapping';

// Sample form data for each Property APF verification type
const samplePropertyApfFormData = {
  POSITIVE: {
    addressLocatable: 'Easy to Locate',
    addressRating: 'Excellent',
    propertyType: 'Residential Apartment',
    propertyStatus: 'Occupied',
    propertyOwnership: 'Self Owned',
    propertyAge: 5,
    propertyCondition: 'Good',
    propertyArea: 1200,
    propertyValue: 5000000,
    marketValue: 4800000,
    apfStatus: 'Active',
    apfNumber: 'APF-2024-001',
    apfIssueDate: '2024-01-15',
    apfExpiryDate: '2025-01-15',
    apfAmount: 500000,
    apfCoverage: 'Comprehensive',
    loanAmount: 3500000,
    bankName: 'HDFC Bank',
    ownerName: 'John Doe',
    ownerContact: '9876543210',
    occupancyStatus: 'Owner Occupied',
    metPersonName: 'John Doe',
    designation: 'Owner',
    titleDeedStatus: 'Clear',
    registrationNumber: 'REG-123456',
    propertyTaxStatus: 'Paid',
    electricityConnection: 'Available',
    waterConnection: 'Available',
    valuationDate: '2024-01-10',
    valuerName: 'ABC Valuers',
    locality: 'Tower/Building',
    addressStructure: '10',
    politicalConnection: 'Not Having Political Connection',
    dominatedArea: 'Not a Community Dominated',
    feedbackFromNeighbour: 'No Adverse',
    otherObservation: 'All property details verified successfully',
    finalStatus: 'Positive'
  },
  
  SHIFTED: {
    addressLocatable: 'Difficult to Locate',
    addressRating: 'Good',
    metPersonName: 'Security Guard',
    designation: 'Security',
    shiftedPeriod: '1 year ago',
    currentLocation: 'New Residential Complex',
    locality: 'Row House',
    addressStructure: '2',
    politicalConnection: 'Not Having Political Connection',
    dominatedArea: 'Not a Community Dominated',
    feedbackFromNeighbour: 'No Adverse',
    otherObservation: 'Property owner has shifted to new location',
    finalStatus: 'Negative'
  },
  
  NSP: {
    addressLocatable: 'Easy to Locate',
    addressRating: 'Average',
    propertyStatus: 'Not Found',
    apfStatus: 'Not Available',
    metPersonName: 'Building Manager',
    designation: 'Manager',
    locality: 'Tower/Building',
    addressStructure: '15',
    politicalConnection: 'Not Having Political Connection',
    dominatedArea: 'Not a Community Dominated',
    feedbackFromNeighbour: 'No Adverse',
    otherObservation: 'Property does not exist at this location',
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
    contactPerson: 'Reception',
    locality: 'Row House',
    landmark1: 'Near School',
    landmark2: 'Opposite Park',
    landmark3: 'Next to Temple',
    landmark4: 'Behind Market',
    dominatedArea: 'Not a Community Dominated',
    otherObservation: 'Unable to locate the property',
    finalStatus: 'Negative'
  }
};

/**
 * Tests Property APF form field handling for a specific form type
 */
function testPropertyApfFormType(formType: string, formData: any): void {
  console.log(`\n🧪 Testing ${formType} Property APF Form Field Handling:`);
  console.log('='.repeat(60));
  
  try {
    // Test comprehensive validation and preparation
    const { validationResult, preparedData } = validateAndPreparePropertyApfForm(formData, formType);
    
    // Generate coverage report
    const coverageReport = generatePropertyApfFieldCoverageReport(formData, preparedData, formType);
    
    console.log(`✅ Validation Result:`, {
      isValid: validationResult.isValid,
      missingFields: validationResult.missingFields,
      warnings: validationResult.warnings,
      fieldCoverage: validationResult.fieldCoverage
    });
    
    console.log(coverageReport);
    
    // Test legacy mapping function for comparison
    const legacyMappedData = mapPropertyApfFormDataToDatabase(formData, formType);
    
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
    console.error(`❌ Error testing ${formType} Property APF form:`, error);
  }
}

/**
 * Tests all Property APF verification form types
 */
export function testAllPropertyApfFormTypes(): void {
  console.log('🚀 Starting Comprehensive Property APF Form Field Handling Tests');
  console.log('='.repeat(90));
  
  // Test each form type
  Object.entries(samplePropertyApfFormData).forEach(([formType, formData]) => {
    testPropertyApfFormType(formType, formData);
  });
  
  console.log('\n🎯 Testing Edge Cases:');
  console.log('='.repeat(50));
  
  // Test with minimal data
  testPropertyApfFormType('POSITIVE', {
    finalStatus: 'Positive',
    addressLocatable: 'Easy to Locate'
  });
  
  // Test with empty data
  testPropertyApfFormType('UNTRACEABLE', {});
  
  console.log('\n✅ All Property APF verification tests completed!');
}

/**
 * Tests specific field mapping scenarios for Property APF verification
 */
export function testPropertyApfFieldMappingScenarios(): void {
  console.log('\n🔍 Testing Specific Property APF Field Mapping Scenarios:');
  console.log('='.repeat(70));
  
  // Test field name variations
  const fieldVariations = {
    addressFloor: '5', // Should map to address_floor
    propertyArea: 1500, // Should map to property_area
    propertyValue: 5000000, // Should map to property_value
    marketValue: 4800000, // Should map to market_value
    apfNumber: 'APF-123456', // Should map to apf_number
    loanAmount: 3500000, // Should map to loan_amount
    bankName: 'SBI Bank', // Should map to bank_name
    ownerName: 'Jane Doe' // Should map to owner_name
  };
  
  const { validationResult, preparedData } = validateAndPreparePropertyApfForm(fieldVariations, 'POSITIVE');
  
  console.log('Property APF field mapping test results:', {
    addressFloorMapping: preparedData.address_floor,
    propertyAreaMapping: preparedData.property_area,
    propertyValueMapping: preparedData.property_value,
    marketValueMapping: preparedData.market_value,
    apfNumberMapping: preparedData.apf_number,
    loanAmountMapping: preparedData.loan_amount,
    bankNameMapping: preparedData.bank_name,
    ownerNameMapping: preparedData.owner_name
  });
}

// Export test functions for use in other modules
export { testPropertyApfFormType, samplePropertyApfFormData };

// Run tests if this file is executed directly
if (require.main === module) {
  testAllPropertyApfFormTypes();
  testPropertyApfFieldMappingScenarios();
}
