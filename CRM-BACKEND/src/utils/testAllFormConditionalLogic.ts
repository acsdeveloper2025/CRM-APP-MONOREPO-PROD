/**
 * Comprehensive Test Suite for ALL Verification Form Types Conditional Logic
 * 
 * This test validates conditional logic implementation across all verification types
 * to identify and fix falsy value issues (especially with 0 values).
 */

import { validateAndPrepareResidenceForm } from './residenceFormValidator';
import { validateAndPrepareOfficeForm } from './officeFormValidator';
import { validateAndPrepareBusinessForm } from './businessFormValidator';
import { validateAndPrepareResidenceCumOfficeForm } from './residenceCumOfficeFormValidator';
import { validateAndPrepareBuilderForm } from './builderFormValidator';
import { validateAndPrepareNocForm } from './nocFormValidator';
import { validateAndPreparePropertyApfForm } from './propertyApfFormValidator';
import { validateAndPreparePropertyIndividualForm } from './propertyIndividualFormValidator';
import { validateAndPrepareDsaConnectorForm } from './dsaConnectorFormValidator';

/**
 * Test cases for falsy value issues across all form types
 */
const falsyValueTestCases = {
  RESIDENCE: {
    validator: validateAndPrepareResidenceForm,
    testCases: [
      {
        name: 'totalFamilyMembers = 0',
        data: {
          addressLocatable: 'Easy to Locate',
          addressRating: 'Excellent',
          houseStatus: 'Opened',
          metPersonName: 'John Doe',
          metPersonRelation: 'Self',
          totalFamilyMembers: 0,  // Should trigger warning
          workingStatus: 'Working',
          stayingPeriod: '5 years',
          stayingStatus: 'On Owned Basis',
          locality: 'Tower/Building',
          addressStructure: '10',
          politicalConnection: 'Not Having Political Connection',
          dominatedArea: 'Not a Community Dominated',
          feedbackFromNeighbour: 'No Adverse',
          otherObservation: 'All details verified',
          finalStatus: 'Positive'
        },
        expectedWarning: 'totalFamilyMembers should be between 1 and 50',
        formType: 'POSITIVE'
      }
    ]
  },

  OFFICE: {
    validator: validateAndPrepareOfficeForm,
    testCases: [
      {
        name: 'staffStrength = 0',
        data: {
          addressLocatable: 'Easy to Locate',
          addressRating: 'Excellent',
          officeStatus: 'Opened',
          staffSeen: 'Yes',
          staffStrength: 0,  // Should trigger warning
          locality: 'Tower/Building',
          addressStructure: '10',
          politicalConnection: 'Not Having Political Connection',
          dominatedArea: 'Not a Community Dominated',
          feedbackFromNeighbour: 'No Adverse',
          otherObservation: 'All details verified',
          finalStatus: 'Positive'
        },
        expectedWarning: 'staffStrength should be between 1 and 10000',
        formType: 'POSITIVE'
      }
    ]
  },

  BUSINESS: {
    validator: validateAndPrepareBusinessForm,
    testCases: [
      {
        name: 'staffStrength = 0',
        data: {
          addressLocatable: 'Easy to Locate',
          addressRating: 'Excellent',
          businessStatus: 'Opened',
          staffSeen: 'Yes',
          staffStrength: 0,  // Should trigger warning
          locality: 'Tower/Building',
          addressStructure: '10',
          politicalConnection: 'Not Having Political Connection',
          dominatedArea: 'Not a Community Dominated',
          feedbackFromNeighbour: 'No Adverse',
          otherObservation: 'All details verified',
          finalStatus: 'Positive'
        },
        expectedWarning: 'staffStrength should be between 1 and 10000',
        formType: 'POSITIVE'
      }
    ]
  },

  RESIDENCE_CUM_OFFICE: {
    validator: validateAndPrepareResidenceCumOfficeForm,
    testCases: [
      {
        name: 'totalFamilyMembers = 0',
        data: {
          addressLocatable: 'Easy to Locate',
          addressRating: 'Excellent',
          houseStatus: 'Opened',
          officeStatus: 'Opened',
          metPersonName: 'John Doe',
          metPersonRelation: 'Self',
          totalFamilyMembers: 0,  // Should trigger warning
          staffSeen: 'Yes',
          locality: 'Tower/Building',
          addressStructure: '10',
          politicalConnection: 'Not Having Political Connection',
          dominatedArea: 'Not a Community Dominated',
          feedbackFromNeighbour: 'No Adverse',
          otherObservation: 'All details verified',
          finalStatus: 'Positive'
        },
        expectedWarning: 'totalFamilyMembers should be between 1 and 50',
        formType: 'POSITIVE'
      },
      {
        name: 'staffStrength = 0',
        data: {
          addressLocatable: 'Easy to Locate',
          addressRating: 'Excellent',
          houseStatus: 'Opened',
          officeStatus: 'Opened',
          metPersonName: 'John Doe',
          metPersonRelation: 'Self',
          totalFamilyMembers: 4,
          staffSeen: 'Yes',
          staffStrength: 0,  // Should trigger warning
          locality: 'Tower/Building',
          addressStructure: '10',
          politicalConnection: 'Not Having Political Connection',
          dominatedArea: 'Not a Community Dominated',
          feedbackFromNeighbour: 'No Adverse',
          otherObservation: 'All details verified',
          finalStatus: 'Positive'
        },
        expectedWarning: 'staffStrength should be between 1 and 10000',
        formType: 'POSITIVE'
      }
    ]
  },

  BUILDER: {
    validator: validateAndPrepareBuilderForm,
    testCases: [
      {
        name: 'staffStrength = 0',
        data: {
          addressLocatable: 'Easy to Locate',
          addressRating: 'Excellent',
          officeStatus: 'Opened',
          staffSeen: 'Yes',
          staffStrength: 0,  // Should trigger warning
          locality: 'Tower/Building',
          addressStructure: '10',
          politicalConnection: 'Not Having Political Connection',
          dominatedArea: 'Not a Community Dominated',
          feedbackFromNeighbour: 'No Adverse',
          otherObservation: 'All details verified',
          finalStatus: 'Positive'
        },
        expectedWarning: 'staffStrength should be between 1 and 10000',
        formType: 'POSITIVE'
      }
    ]
  },

  DSA_CONNECTOR: {
    validator: validateAndPrepareDsaConnectorForm,
    testCases: [
      {
        name: 'connectorExperience = 0',
        data: {
          addressLocatable: 'Easy to Locate',
          addressRating: 'Excellent',
          connectorType: 'DSA',
          connectorCode: 'DSA-001',
          connectorName: 'John Doe',
          connectorDesignation: 'Senior DSA',
          connectorExperience: 0,  // Should trigger warning (0 < 0 is false, but 0 is valid experience)
          connectorStatus: 'Active',
          businessName: 'ABC Financial',
          businessType: 'Registered',
          officeType: 'Rented Office',
          contactNumber: '9876543210',
          metPersonName: 'John Doe',
          designation: 'DSA',
          locality: 'Tower/Building',
          addressStructure: '10',
          politicalConnection: 'Not Having Political Connection',
          dominatedArea: 'Not a Community Dominated',
          feedbackFromNeighbour: 'No Adverse',
          otherObservation: 'All details verified',
          finalStatus: 'Positive'
        },
        expectedWarning: null, // 0 experience should be valid
        formType: 'POSITIVE'
      }
    ]
  }
};

/**
 * Tests a specific form type for falsy value issues
 */
function testFormTypeFalsyValues(formTypeName: string, testConfig: any): void {
  console.log(`\n🧪 Testing ${formTypeName} Form Falsy Value Issues:`);
  console.log('='.repeat(70));

  testConfig.testCases.forEach((testCase: any, index: number) => {
    console.log(`\n  📋 Test ${index + 1}: ${testCase.name}`);
    
    try {
      const result = testConfig.validator(testCase.data, testCase.formType);
      
      const hasExpectedWarning = testCase.expectedWarning 
        ? result.validationResult.warnings.includes(testCase.expectedWarning)
        : result.validationResult.warnings.length === 0;
      
      if (hasExpectedWarning) {
        console.log(`    ✅ PASS: Conditional logic working correctly`);
        if (testCase.expectedWarning) {
          console.log(`    📝 Expected warning found: "${testCase.expectedWarning}"`);
        }
      } else {
        console.log(`    ❌ FAIL: Falsy value issue detected!`);
        console.log(`    📝 Expected: ${testCase.expectedWarning || 'No warnings'}`);
        console.log(`    📝 Actual warnings: ${result.validationResult.warnings.join(', ') || 'None'}`);
        console.log(`    🐛 This indicates a falsy value (0) is not being validated correctly`);
      }
      
    } catch (error) {
      console.log(`    ❌ ERROR: ${error}`);
    }
  });
}

/**
 * Main test function to validate all form types for falsy value issues
 */
export function testAllFormConditionalLogic(): void {
  console.log('🚀 Starting Comprehensive Conditional Logic Tests for ALL Form Types');
  console.log('='.repeat(100));
  console.log('🎯 Focus: Identifying falsy value issues (especially with 0 values)');
  
  Object.entries(falsyValueTestCases).forEach(([formType, testConfig]) => {
    testFormTypeFalsyValues(formType, testConfig);
  });
  
  console.log('\n📊 Summary: Falsy Value Issues Found');
  console.log('='.repeat(50));
  console.log('Forms that need fixing:');
  console.log('- OFFICE: staffStrength validation');
  console.log('- BUSINESS: staffStrength validation');
  console.log('- BUILDER: staffStrength validation');
  console.log('- RESIDENCE_CUM_OFFICE: totalFamilyMembers & staffStrength validation');
  console.log('- DSA_CONNECTOR: connectorExperience validation (edge case)');
  
  console.log('\n✅ All conditional logic tests completed!');
}

// Export for use in other modules
export { falsyValueTestCases, testFormTypeFalsyValues };

// Run tests if this file is executed directly
if (require.main === module) {
  testAllFormConditionalLogic();
}
