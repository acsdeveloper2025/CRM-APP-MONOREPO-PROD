/**
 * Test Script for DSA Connector Form Field Handling
 * 
 * This script tests that all DSA Connector verification form types properly capture
 * all fields in the database with appropriate defaults for missing fields.
 */

import { validateAndPrepareDsaConnectorForm, generateDsaConnectorFieldCoverageReport } from './dsaConnectorFormValidator';
import { mapDsaConnectorFormDataToDatabase } from './dsaConnectorFormFieldMapping';

// Sample form data for each DSA Connector verification type
const sampleDsaConnectorFormData = {
  POSITIVE: {
    addressLocatable: 'Easy to Locate',
    addressRating: 'Excellent',
    connectorType: 'DSA',
    connectorCode: 'DSA-2024-001',
    connectorName: 'Rajesh Sharma',
    connectorDesignation: 'Senior DSA',
    connectorExperience: 5,
    connectorStatus: 'Active',
    businessName: 'Sharma Financial Services',
    businessType: 'Registered',
    businessRegistrationNumber: 'REG-123456789',
    businessEstablishmentYear: 2019,
    officeType: 'Rented Office',
    officeArea: 500,
    monthlyBusinessVolume: 500000,
    annualTurnover: 6000000,
    teamSize: 8,
    subAgentsCount: 5,
    trainingCompleted: 'Yes',
    certificationStatus: 'Certified',
    contactNumber: '9876543210',
    alternateNumber: '9876543211',
    emailAddress: 'rajesh.sharma@email.com',
    metPersonName: 'Rajesh Sharma',
    designation: 'DSA',
    documentShown: 'Yes',
    documentType: 'DSA Certificate',
    bankAccountDetails: 'ICICI Bank - 123456789',
    panNumber: 'ABCDE1234F',
    gstNumber: 'GST123456789',
    locality: 'Tower/Building',
    addressStructure: '10',
    politicalConnection: 'Not Having Political Connection',
    dominatedArea: 'Not a Community Dominated',
    feedbackFromNeighbour: 'No Adverse',
    otherObservation: 'All DSA connector details verified successfully',
    finalStatus: 'Positive'
  },
  
  SHIFTED: {
    addressLocatable: 'Difficult to Locate',
    addressRating: 'Good',
    metPersonName: 'Security Guard',
    designation: 'Security',
    shiftedPeriod: '4 months ago',
    currentLocation: 'New Business Complex',
    locality: 'Row House',
    addressStructure: '2',
    politicalConnection: 'Not Having Political Connection',
    dominatedArea: 'Not a Community Dominated',
    feedbackFromNeighbour: 'No Adverse',
    otherObservation: 'DSA connector has shifted to new location',
    finalStatus: 'Negative'
  },
  
  NSP: {
    addressLocatable: 'Easy to Locate',
    addressRating: 'Average',
    connectorStatus: 'Inactive',
    metPersonName: 'Building Manager',
    designation: 'Manager',
    locality: 'Tower/Building',
    addressStructure: '15',
    politicalConnection: 'Not Having Political Connection',
    dominatedArea: 'Not a Community Dominated',
    feedbackFromNeighbour: 'No Adverse',
    otherObservation: 'DSA connector not active at this location',
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
    otherObservation: 'Unable to locate the DSA connector',
    finalStatus: 'Negative'
  }
};

/**
 * Tests DSA Connector form field handling for a specific form type
 */
function testDsaConnectorFormType(formType: string, formData: any): void {
  console.log(`\n🧪 Testing ${formType} DSA Connector Form Field Handling:`);
  console.log('='.repeat(70));
  
  try {
    // Test comprehensive validation and preparation
    const { validationResult, preparedData } = validateAndPrepareDsaConnectorForm(formData, formType);
    
    // Generate coverage report
    const coverageReport = generateDsaConnectorFieldCoverageReport(formData, preparedData, formType);
    
    console.log(`✅ Validation Result:`, {
      isValid: validationResult.isValid,
      missingFields: validationResult.missingFields,
      warnings: validationResult.warnings,
      fieldCoverage: validationResult.fieldCoverage
    });
    
    console.log(coverageReport);
    
    // Test legacy mapping function for comparison
    const legacyMappedData = mapDsaConnectorFormDataToDatabase(formData, formType);
    
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
    console.error(`❌ Error testing ${formType} DSA Connector form:`, error);
  }
}

/**
 * Tests all DSA Connector verification form types
 */
export function testAllDsaConnectorFormTypes(): void {
  console.log('🚀 Starting Comprehensive DSA Connector Form Field Handling Tests');
  console.log('='.repeat(100));
  
  // Test each form type
  Object.entries(sampleDsaConnectorFormData).forEach(([formType, formData]) => {
    testDsaConnectorFormType(formType, formData);
  });
  
  console.log('\n🎯 Testing Edge Cases:');
  console.log('='.repeat(50));
  
  // Test with minimal data
  testDsaConnectorFormType('POSITIVE', {
    finalStatus: 'Positive',
    addressLocatable: 'Easy to Locate'
  });
  
  // Test with empty data
  testDsaConnectorFormType('UNTRACEABLE', {});
  
  console.log('\n✅ All DSA Connector verification tests completed!');
}

/**
 * Tests specific field mapping scenarios for DSA Connector verification
 */
export function testDsaConnectorFieldMappingScenarios(): void {
  console.log('\n🔍 Testing Specific DSA Connector Field Mapping Scenarios:');
  console.log('='.repeat(80));
  
  // Test field name variations
  const fieldVariations = {
    addressFloor: '5', // Should map to address_floor
    connectorName: 'John Doe', // Should map to connector_name
    connectorCode: 'DSA-001', // Should map to connector_code
    businessName: 'ABC Financial', // Should map to business_name
    officeArea: 800, // Should map to office_area
    monthlyBusinessVolume: 750000, // Should map to monthly_business_volume
    teamSize: 12, // Should map to team_size
    contactNumber: '9876543210' // Should map to contact_number
  };
  
  const { validationResult, preparedData } = validateAndPrepareDsaConnectorForm(fieldVariations, 'POSITIVE');
  
  console.log('DSA Connector field mapping test results:', {
    addressFloorMapping: preparedData.address_floor,
    connectorNameMapping: preparedData.connector_name,
    connectorCodeMapping: preparedData.connector_code,
    businessNameMapping: preparedData.business_name,
    officeAreaMapping: preparedData.office_area,
    monthlyBusinessVolumeMapping: preparedData.monthly_business_volume,
    teamSizeMapping: preparedData.team_size,
    contactNumberMapping: preparedData.contact_number
  });
}

// Export test functions for use in other modules
export { testDsaConnectorFormType, sampleDsaConnectorFormData };

// Run tests if this file is executed directly
if (require.main === module) {
  testAllDsaConnectorFormTypes();
  testDsaConnectorFieldMappingScenarios();
}
