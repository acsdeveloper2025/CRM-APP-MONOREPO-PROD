#!/usr/bin/env node

/**
 * Simple Test Case Creation Script
 * Creates test cases using valid rate type assignments
 */

const axios = require('axios');

// Configuration
const API_BASE_URL = 'http://172.20.10.8:3000/api';
const BACKEND_USER_CREDENTIALS = {
  username: 'backend_user',
  password: '95f42g8aH7'
};
const FIELD_USER_ID = '66ed9c1b-e02e-4769-b7d5-903bcc0a3ba9'; // nikhil.parab

// Valid combinations from the rate type assignments (as strings for backend compatibility)
const VALID_COMBINATIONS = [
  {
    clientId: '4',
    productId: '4',
    verificationTypeId: '4',
    rateTypeId: '1',
    clientName: 'HDFC BANK LTD',
    productName: 'Business Loan',
    verificationTypeName: 'Business Verification',
    rateTypeName: 'Local'
  },
  {
    clientId: '4',
    productId: '4',
    verificationTypeId: '4',
    rateTypeId: '4',
    clientName: 'HDFC BANK LTD',
    productName: 'Business Loan',
    verificationTypeName: 'Business Verification',
    rateTypeName: 'OGL'
  },
  {
    clientId: '4',
    productId: '4',
    verificationTypeId: '4',
    rateTypeId: '7',
    clientName: 'HDFC BANK LTD',
    productName: 'Business Loan',
    verificationTypeName: 'Business Verification',
    rateTypeName: 'Outstation'
  },
  {
    clientId: '4',
    productId: '3',
    verificationTypeId: '2',
    rateTypeId: '1',
    clientName: 'HDFC BANK LTD',
    productName: 'Credit Card',
    verificationTypeName: 'Office Verification',
    rateTypeName: 'Local'
  },
  {
    clientId: '4',
    productId: '3',
    verificationTypeId: '2',
    rateTypeId: '4',
    clientName: 'HDFC BANK LTD',
    productName: 'Credit Card',
    verificationTypeName: 'Office Verification',
    rateTypeName: 'OGL'
  }
];

// Form outcomes for each verification type
const FORM_OUTCOMES = [
  'Positive & Door Locked',
  'Shifted & Door Locked',
  'NSP & Door Locked',
  'ERT',
  'Untraceable'
];

// Sample customer data templates
const CUSTOMER_TEMPLATES = [
  { name: 'Rajesh Kumar', phone: '9876543210', city: 'Mumbai', area: 'Andheri' },
  { name: 'Priya Sharma', phone: '9876543211', city: 'Delhi', area: 'Connaught Place' },
  { name: 'Amit Patel', phone: '9876543212', city: 'Ahmedabad', area: 'Satellite' },
  { name: 'Sunita Singh', phone: '9876543213', city: 'Pune', area: 'Koregaon Park' },
  { name: 'Vikram Reddy', phone: '9876543214', city: 'Hyderabad', area: 'Banjara Hills' }
];

// Global variables
let authToken = null;

/**
 * Authenticate and get access token
 */
async function authenticate() {
  try {
    console.log('🔐 Authenticating...');
    const response = await axios.post(`${API_BASE_URL}/auth/login`, BACKEND_USER_CREDENTIALS);
    
    if (response.data.success && response.data.data.tokens && response.data.data.tokens.accessToken) {
      authToken = response.data.data.tokens.accessToken;
      console.log('✅ Authentication successful');
      return true;
    } else {
      console.error('❌ Authentication failed:', response.data.message);
      return false;
    }
  } catch (error) {
    console.error('❌ Authentication error:', error.response?.data?.message || error.message);
    return false;
  }
}

/**
 * Generate test case data
 */
function generateTestCaseData(combination, formOutcome, customerIndex) {
  const customer = CUSTOMER_TEMPLATES[customerIndex % CUSTOMER_TEMPLATES.length];
  
  return {
    customerName: customer.name,
    customerPhone: customer.phone,
    customerCallingCode: '+91',
    clientId: combination.clientId,
    productId: combination.productId,
    verificationTypeId: combination.verificationTypeId,
    rateTypeId: combination.rateTypeId,
    address: `${Math.floor(Math.random() * 999) + 1}, ${customer.area}, ${customer.city}`,
    pincode: `${Math.floor(Math.random() * 900000) + 100000}`,
    priority: ['LOW', 'MEDIUM', 'HIGH'][Math.floor(Math.random() * 3)],
    applicantType: 'APPLICANT',
    trigger: `Test case for ${combination.verificationTypeName} - ${formOutcome} - ${combination.rateTypeName}`,
    backendContactNumber: customer.phone,
    assignedToId: FIELD_USER_ID
  };
}

/**
 * Create a single test case
 */
async function createTestCase(caseData, description, caseNumber) {
  try {
    const headers = { 
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    };
    
    const response = await axios.post(`${API_BASE_URL}/cases`, caseData, { headers });
    
    if (response.data.success) {
      console.log(`✅ Case ${caseNumber}: ${description} (ID: ${response.data.data.caseId})`);
      return response.data.data;
    } else {
      console.error(`❌ Failed to create case ${caseNumber}:`, response.data.message);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error creating case ${caseNumber}:`, error.response?.data?.message || error.message);
    return null;
  }
}

/**
 * Main execution function
 */
async function main() {
  console.log('🚀 Starting Simple Test Case Creation');
  console.log('=' .repeat(60));
  
  // Step 1: Authenticate
  if (!(await authenticate())) {
    process.exit(1);
  }
  
  // Step 2: Create test cases
  console.log('\n📝 Creating test cases...');
  console.log(`Target: ${VALID_COMBINATIONS.length * FORM_OUTCOMES.length} cases`);
  console.log('-'.repeat(60));
  
  let caseNumber = 1;
  let successCount = 0;
  let failureCount = 0;
  
  for (const combination of VALID_COMBINATIONS) {
    console.log(`\n📋 Creating cases for: ${combination.verificationTypeName} (${combination.rateTypeName})`);
    
    for (const formOutcome of FORM_OUTCOMES) {
      const caseData = generateTestCaseData(combination, formOutcome, caseNumber - 1);
      const description = `${combination.verificationTypeName} - ${formOutcome} - ${combination.rateTypeName}`;
      const result = await createTestCase(caseData, description, caseNumber);
      
      if (result) {
        successCount++;
      } else {
        failureCount++;
      }
      
      caseNumber++;
      
      // Small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  // Step 3: Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 CREATION SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Successfully created: ${successCount} cases`);
  console.log(`❌ Failed to create: ${failureCount} cases`);
  console.log(`📈 Total attempted: ${successCount + failureCount} cases`);
  console.log(`🎯 Success rate: ${((successCount / (successCount + failureCount)) * 100).toFixed(1)}%`);
  
  if (successCount > 0) {
    console.log('\n🎉 Test case creation completed!');
    console.log('📋 Cases are assigned to field user: nikhil.parab');
    console.log('🔍 You can now verify the Area and Rate Type columns in the case management tables');
    console.log('\n📊 Created cases for:');
    VALID_COMBINATIONS.forEach(combo => {
      console.log(`  • ${combo.verificationTypeName} with ${combo.rateTypeName} rate type`);
    });
  }
}

// Execute the script
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Script execution failed:', error);
    process.exit(1);
  });
}

module.exports = { main };
