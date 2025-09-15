/**
 * Comprehensive Test Suite for Residence Verification Conditional Logic
 * 
 * This test validates conditional logic implementation for all residence verification form types
 * to ensure proper handling during form submission and database field population.
 */

import { validateAndPrepareResidenceForm, generateFieldCoverageReport } from './residenceFormValidator';
import { mapFormDataToDatabase } from './residenceFormFieldMapping';

/**
 * Test scenarios for conditional logic validation
 */
const conditionalTestScenarios = {
  POSITIVE: {
    // Test 1: Document verification conditional logic
    documentVerificationTest: {
      baseData: {
        addressLocatable: 'Easy to Locate',
        addressRating: 'Excellent',
        houseStatus: 'Opened',
        metPersonName: 'John Doe',
        metPersonRelation: 'Self',
        totalFamilyMembers: 4,
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
      conditionalScenarios: [
        {
          name: 'Document shown but type not specified',
          data: { documentShownStatus: 'Showed' },
          expectedWarning: 'documentType should be specified when documentShownStatus is Showed'
        },
        {
          name: 'Document shown with type specified',
          data: { documentShownStatus: 'Showed', documentType: 'Aadhar Card' },
          expectedWarning: null
        },
        {
          name: 'Document not shown',
          data: { documentShownStatus: 'Not Showed' },
          expectedWarning: null
        }
      ]
    },

    // Test 2: TPC conditional logic
    tpcValidationTest: {
      baseData: {
        addressLocatable: 'Easy to Locate',
        addressRating: 'Excellent',
        houseStatus: 'Opened',
        metPersonName: 'John Doe',
        metPersonRelation: 'Self',
        totalFamilyMembers: 4,
        workingStatus: 'Working',
        stayingPeriod: '5 years',
        stayingStatus: 'On Owned Basis',
        documentShownStatus: 'Showed',
        locality: 'Tower/Building',
        addressStructure: '10',
        politicalConnection: 'Not Having Political Connection',
        dominatedArea: 'Not a Community Dominated',
        feedbackFromNeighbour: 'No Adverse',
        otherObservation: 'All details verified',
        finalStatus: 'Positive'
      },
      conditionalScenarios: [
        {
          name: 'TPC person 1 selected but name not provided',
          data: { tpcMetPerson1: 'Neighbour' },
          expectedWarning: 'tpcName1 should be specified when tpcMetPerson1 is selected'
        },
        {
          name: 'TPC person 1 with name but no confirmation',
          data: { tpcMetPerson1: 'Neighbour', tpcName1: 'Rajesh Kumar' },
          expectedWarning: 'tpcConfirmation1 should be specified when TPC person 1 is provided'
        },
        {
          name: 'Complete TPC person 1 details',
          data: { tpcMetPerson1: 'Neighbour', tpcName1: 'Rajesh Kumar', tpcConfirmation1: 'Confirmed' },
          expectedWarning: null
        },
        {
          name: 'TPC person 2 selected but name not provided',
          data: { tpcMetPerson2: 'Security' },
          expectedWarning: 'tpcName2 should be specified when tpcMetPerson2 is selected'
        }
      ]
    },

    // Test 3: Family members validation
    familyMembersTest: {
      baseData: {
        addressLocatable: 'Easy to Locate',
        addressRating: 'Excellent',
        houseStatus: 'Opened',
        metPersonName: 'John Doe',
        metPersonRelation: 'Self',
        workingStatus: 'Working',
        stayingPeriod: '5 years',
        stayingStatus: 'On Owned Basis',
        documentShownStatus: 'Showed',
        locality: 'Tower/Building',
        addressStructure: '10',
        politicalConnection: 'Not Having Political Connection',
        dominatedArea: 'Not a Community Dominated',
        feedbackFromNeighbour: 'No Adverse',
        otherObservation: 'All details verified',
        finalStatus: 'Positive'
      },
      conditionalScenarios: [
        {
          name: 'Family members below minimum',
          data: { totalFamilyMembers: 0 },
          expectedWarning: 'totalFamilyMembers should be between 1 and 50'
        },
        {
          name: 'Family members above maximum',
          data: { totalFamilyMembers: 51 },
          expectedWarning: 'totalFamilyMembers should be between 1 and 50'
        },
        {
          name: 'Valid family members count',
          data: { totalFamilyMembers: 4 },
          expectedWarning: null
        }
      ]
    }
  },

  SHIFTED: {
    // Test 4: Shifted form TPC validation
    tpcValidationTest: {
      baseData: {
        addressLocatable: 'Difficult to Locate',
        addressRating: 'Good',
        roomStatus: 'Locked',
        metPersonName: 'Security Guard',
        metPersonStatus: 'Available',
        shiftedPeriod: '6 months ago',
        premisesStatus: 'Locked',
        locality: 'Row House',
        addressStructure: '2',
        politicalConnection: 'Not Having Political Connection',
        dominatedArea: 'Not a Community Dominated',
        feedbackFromNeighbour: 'No Adverse',
        otherObservation: 'Family has shifted',
        finalStatus: 'Negative'
      },
      conditionalScenarios: [
        {
          name: 'TPC person selected but name not provided',
          data: { tpcMetPerson1: 'Neighbour' },
          expectedWarning: 'tpcName1 should be specified when tpcMetPerson1 is selected'
        },
        {
          name: 'Complete TPC details',
          data: { tpcMetPerson1: 'Neighbour', tpcName1: 'Local Resident' },
          expectedWarning: null
        }
      ]
    }
  },

  NSP: {
    // Test 5: NSP house status conditional logic
    houseStatusTest: {
      baseData: {
        addressLocatable: 'Easy to Locate',
        addressRating: 'Average',
        locality: 'Tower/Building',
        addressStructure: '15',
        politicalConnection: 'Not Having Political Connection',
        dominatedArea: 'Not a Community Dominated',
        feedbackFromNeighbour: 'No Adverse',
        otherObservation: 'Person not available',
        finalStatus: 'Refer'
      },
      conditionalScenarios: [
        {
          name: 'House closed but staying person not specified',
          data: { houseStatus: 'Closed' },
          expectedWarning: 'stayingPersonName should be specified when house status is Closed'
        },
        {
          name: 'House closed with staying person specified',
          data: { houseStatus: 'Closed', stayingPersonName: 'Caretaker' },
          expectedWarning: null
        },
        {
          name: 'House opened but met person not specified',
          data: { houseStatus: 'Opened' },
          expectedWarning: 'metPersonName should be specified when house status is Opened'
        },
        {
          name: 'House opened with met person specified',
          data: { houseStatus: 'Opened', metPersonName: 'Resident' },
          expectedWarning: null
        }
      ]
    }
  },

  ENTRY_RESTRICTED: {
    // Test 6: Entry restricted form validation
    entryRestrictedTest: {
      baseData: {
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
        otherObservation: 'Entry restricted',
        finalStatus: 'Positive'
      },
      conditionalScenarios: [
        {
          name: 'Valid entry restricted form',
          data: {},
          expectedWarning: null
        }
      ]
    }
  },

  UNTRACEABLE: {
    // Test 7: Untraceable form validation
    untraceableTest: {
      baseData: {
        callRemark: 'Number Switch Off',
        locality: 'Row House',
        landmark1: 'Near School',
        landmark2: 'Opposite Park',
        landmark3: 'Next to Temple',
        landmark4: 'Behind Market',
        dominatedArea: 'Not a Community Dominated',
        otherObservation: 'Unable to locate',
        finalStatus: 'Negative'
      },
      conditionalScenarios: [
        {
          name: 'Valid untraceable form',
          data: {},
          expectedWarning: null
        }
      ]
    }
  }
};

/**
 * Common conditional tests for all form types
 */
const commonConditionalTests = {
  // Test 8: Hold status validation
  holdStatusTest: {
    conditionalScenarios: [
      {
        name: 'Hold status without reason',
        data: { finalStatus: 'Hold' },
        expectedWarning: 'holdReason should be specified when finalStatus is Hold'
      },
      {
        name: 'Hold status with reason',
        data: { finalStatus: 'Hold', holdReason: 'Additional verification required' },
        expectedWarning: null
      }
    ]
  },

  // Test 9: Nameplate conditional validation
  nameplateTest: {
    conditionalScenarios: [
      {
        name: 'Society nameplate sighted but name not provided',
        data: { societyNamePlateStatus: 'Sighted' },
        expectedWarning: 'nameOnSocietyBoard should be specified when societyNamePlateStatus is Sighted'
      },
      {
        name: 'Society nameplate sighted with name',
        data: { societyNamePlateStatus: 'Sighted', nameOnSocietyBoard: 'Green Valley Apartments' },
        expectedWarning: null
      },
      {
        name: 'Door nameplate sighted but name not provided',
        data: { doorNamePlateStatus: 'Sighted' },
        expectedWarning: 'nameOnDoorPlate should be specified when doorNamePlateStatus is Sighted'
      },
      {
        name: 'Door nameplate sighted with name',
        data: { doorNamePlateStatus: 'Sighted', nameOnDoorPlate: 'John Doe' },
        expectedWarning: null
      }
    ]
  }
};

/**
 * Runs conditional logic tests for a specific form type and test scenario
 */
function runConditionalTest(formType: string, testName: string, testData: any): void {
  console.log(`\n🧪 Testing ${formType} - ${testName}:`);
  console.log('='.repeat(60));

  const { baseData, conditionalScenarios } = testData;

  conditionalScenarios.forEach((scenario: any, index: number) => {
    console.log(`\n  📋 Scenario ${index + 1}: ${scenario.name}`);
    
    // Merge base data with scenario-specific data
    const testFormData = { ...baseData, ...scenario.data };
    
    try {
      // Run validation
      const { validationResult } = validateAndPrepareResidenceForm(testFormData, formType);
      
      // Check if expected warning is present
      const hasExpectedWarning = scenario.expectedWarning 
        ? validationResult.warnings.includes(scenario.expectedWarning)
        : validationResult.warnings.length === 0;
      
      if (hasExpectedWarning) {
        console.log(`    ✅ PASS: Conditional logic working correctly`);
        if (scenario.expectedWarning) {
          console.log(`    📝 Expected warning found: "${scenario.expectedWarning}"`);
        }
      } else {
        console.log(`    ❌ FAIL: Conditional logic not working as expected`);
        console.log(`    📝 Expected: ${scenario.expectedWarning || 'No warnings'}`);
        console.log(`    📝 Actual warnings: ${validationResult.warnings.join(', ') || 'None'}`);
      }
      
      // Log validation details
      console.log(`    📊 Validation result:`, {
        isValid: validationResult.isValid,
        warningCount: validationResult.warnings.length,
        missingFieldCount: validationResult.missingFields.length
      });
      
    } catch (error) {
      console.log(`    ❌ ERROR: ${error}`);
    }
  });
}

/**
 * Runs common conditional tests for all form types
 */
function runCommonConditionalTests(formType: string, baseData: any): void {
  Object.entries(commonConditionalTests).forEach(([testName, testData]) => {
    console.log(`\n🧪 Testing ${formType} - Common ${testName}:`);
    console.log('='.repeat(60));

    testData.conditionalScenarios.forEach((scenario: any, index: number) => {
      console.log(`\n  📋 Scenario ${index + 1}: ${scenario.name}`);
      
      // Merge base data with scenario-specific data
      const testFormData = { ...baseData, ...scenario.data };
      
      try {
        // Run validation
        const { validationResult } = validateAndPrepareResidenceForm(testFormData, formType);
        
        // Check if expected warning is present
        const hasExpectedWarning = scenario.expectedWarning 
          ? validationResult.warnings.includes(scenario.expectedWarning)
          : validationResult.warnings.length === 0;
        
        if (hasExpectedWarning) {
          console.log(`    ✅ PASS: Conditional logic working correctly`);
          if (scenario.expectedWarning) {
            console.log(`    📝 Expected warning found: "${scenario.expectedWarning}"`);
          }
        } else {
          console.log(`    ❌ FAIL: Conditional logic not working as expected`);
          console.log(`    📝 Expected: ${scenario.expectedWarning || 'No warnings'}`);
          console.log(`    📝 Actual warnings: ${validationResult.warnings.join(', ') || 'None'}`);
        }
        
      } catch (error) {
        console.log(`    ❌ ERROR: ${error}`);
      }
    });
  });
}

/**
 * Main test function to validate all residence verification conditional logic
 */
export function testResidenceConditionalLogic(): void {
  console.log('🚀 Starting Comprehensive Residence Verification Conditional Logic Tests');
  console.log('='.repeat(100));
  
  // Test form-specific conditional logic
  Object.entries(conditionalTestScenarios).forEach(([formType, tests]) => {
    console.log(`\n🏠 Testing ${formType} Form Type Conditional Logic:`);
    console.log('='.repeat(80));
    
    Object.entries(tests).forEach(([testName, testData]) => {
      runConditionalTest(formType, testName, testData);
    });
    
    // Run common tests for this form type
    const firstTest = Object.values(tests)[0] as any;
    if (firstTest?.baseData) {
      runCommonConditionalTests(formType, firstTest.baseData);
    }
  });
  
  console.log('\n✅ All residence verification conditional logic tests completed!');
}

// Export for use in other modules
export { conditionalTestScenarios, commonConditionalTests, runConditionalTest };

// Run tests if this file is executed directly
if (require.main === module) {
  testResidenceConditionalLogic();
}
