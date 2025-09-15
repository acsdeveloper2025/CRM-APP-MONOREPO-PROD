/**
 * Test Script for Property Individual Form Field Handling
 * 
 * This script tests that all Property Individual verification form types properly capture
 * all fields in the database with appropriate defaults for missing fields.
 */

import { validateAndPreparePropertyIndividualForm, generatePropertyIndividualFieldCoverageReport } from './propertyIndividualFormValidator';
import { mapPropertyIndividualFormDataToDatabase } from './propertyIndividualFormFieldMapping';

// Sample form data for each Property Individual verification type
const samplePropertyIndividualFormData = {
  POSITIVE: {
    addressLocatable: 'Easy to Locate',
    addressRating: 'Excellent',
    propertyType: 'Residential House',
    propertyStatus: 'Occupied',
    propertyOwnership: 'Self Owned',
    propertyAge: 8,
    propertyCondition: 'Good',
    propertyArea: 1500,
    propertyValue: 7500000,
    marketValue: 7200000,
    individualName: 'Rajesh Kumar',
    individualAge: 35,
    individualOccupation: 'Software Engineer',
    individualIncome: 80000,
    familyMembers: 4,
    earningMembers: 2,
    employmentType: 'Salaried',
    employerName: 'Tech Solutions Pvt Ltd',
    monthlyIncome: 80000,
    annualIncome: 960000,
    bankName: 'ICICI Bank',
    contactNumber: '9876543210',
    alternateNumber: '9876543211',
    emailAddress: 'rajesh.kumar@email.com',
    metPersonName: 'Rajesh Kumar',
    metPersonRelation: 'Self',
    designation: 'Applicant',
    documentShown: 'Yes',
    documentType: 'Aadhar Card',
    reference1Name: 'Suresh Sharma',
    reference1Contact: '9876543212',
    reference1Relation: 'Friend',
    locality: 'Tower/Building',
    addressStructure: '10',
    politicalConnection: 'Not Having Political Connection',
    dominatedArea: 'Not a Community Dominated',
    feedbackFromNeighbour: 'No Adverse',
    otherObservation: 'All individual details verified successfully',
    finalStatus: 'Positive'
  },
  
  SHIFTED: {
    addressLocatable: 'Difficult to Locate',
    addressRating: 'Good',
    metPersonName: 'Security Guard',
    metPersonRelation: 'Security',
    designation: 'Security',
    shiftedPeriod: '6 months ago',
    currentLocation: 'New Residential Area',
    locality: 'Row House',
    addressStructure: '2',
    politicalConnection: 'Not Having Political Connection',
    dominatedArea: 'Not a Community Dominated',
    feedbackFromNeighbour: 'No Adverse',
    otherObservation: 'Individual has shifted to new location',
    finalStatus: 'Negative'
  },
  
  NSP: {
    addressLocatable: 'Easy to Locate',
    addressRating: 'Average',
    propertyStatus: 'Not Found',
    metPersonName: 'Building Manager',
    metPersonRelation: 'Manager',
    designation: 'Manager',
    locality: 'Tower/Building',
    addressStructure: '15',
    politicalConnection: 'Not Having Political Connection',
    dominatedArea: 'Not a Community Dominated',
    feedbackFromNeighbour: 'No Adverse',
    otherObservation: 'Individual does not exist at this location',
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
    otherObservation: 'Unable to locate the individual',
    finalStatus: 'Negative'
  }
};

/**
 * Tests Property Individual form field handling for a specific form type
 */
function testPropertyIndividualFormType(formType: string, formData: any): void {
  console.log(`\n🧪 Testing ${formType} Property Individual Form Field Handling:`);
  console.log('='.repeat(70));
  
  try {
    // Test comprehensive validation and preparation
    const { validationResult, preparedData } = validateAndPreparePropertyIndividualForm(formData, formType);
    
    // Generate coverage report
    const coverageReport = generatePropertyIndividualFieldCoverageReport(formData, preparedData, formType);
    
    console.log(`✅ Validation Result:`, {
      isValid: validationResult.isValid,
      missingFields: validationResult.missingFields,
      warnings: validationResult.warnings,
      fieldCoverage: validationResult.fieldCoverage
    });
    
    console.log(coverageReport);
    
    // Test legacy mapping function for comparison
    const legacyMappedData = mapPropertyIndividualFormDataToDatabase(formData, formType);
    
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
    console.error(`❌ Error testing ${formType} Property Individual form:`, error);
  }
}

/**
 * Tests all Property Individual verification form types
 */
export function testAllPropertyIndividualFormTypes(): void {
  console.log('🚀 Starting Comprehensive Property Individual Form Field Handling Tests');
  console.log('='.repeat(100));
  
  // Test each form type
  Object.entries(samplePropertyIndividualFormData).forEach(([formType, formData]) => {
    testPropertyIndividualFormType(formType, formData);
  });
  
  console.log('\n🎯 Testing Edge Cases:');
  console.log('='.repeat(50));
  
  // Test with minimal data
  testPropertyIndividualFormType('POSITIVE', {
    finalStatus: 'Positive',
    addressLocatable: 'Easy to Locate'
  });
  
  // Test with empty data
  testPropertyIndividualFormType('UNTRACEABLE', {});
  
  console.log('\n✅ All Property Individual verification tests completed!');
}

/**
 * Tests specific field mapping scenarios for Property Individual verification
 */
export function testPropertyIndividualFieldMappingScenarios(): void {
  console.log('\n🔍 Testing Specific Property Individual Field Mapping Scenarios:');
  console.log('='.repeat(80));
  
  // Test field name variations
  const fieldVariations = {
    addressFloor: '5', // Should map to address_floor
    individualName: 'John Doe', // Should map to individual_name
    individualAge: 30, // Should map to individual_age
    propertyArea: 1200, // Should map to property_area
    propertyValue: 5000000, // Should map to property_value
    monthlyIncome: 75000, // Should map to monthly_income
    bankName: 'HDFC Bank', // Should map to bank_name
    contactNumber: '9876543210' // Should map to contact_number
  };
  
  const { validationResult, preparedData } = validateAndPreparePropertyIndividualForm(fieldVariations, 'POSITIVE');
  
  console.log('Property Individual field mapping test results:', {
    addressFloorMapping: preparedData.address_floor,
    individualNameMapping: preparedData.individual_name,
    individualAgeMapping: preparedData.individual_age,
    propertyAreaMapping: preparedData.property_area,
    propertyValueMapping: preparedData.property_value,
    monthlyIncomeMapping: preparedData.monthly_income,
    bankNameMapping: preparedData.bank_name,
    contactNumberMapping: preparedData.contact_number
  });
}

// Export test functions for use in other modules
export { testPropertyIndividualFormType, samplePropertyIndividualFormData };

// Run tests if this file is executed directly
if (require.main === module) {
  testAllPropertyIndividualFormTypes();
  testPropertyIndividualFieldMappingScenarios();
}
