#!/usr/bin/env node

/**
 * Comprehensive Test Case Creation Script
 * Creates 45 test cases (9 verification types × 5 form outcomes each)
 */

const axios = require('axios');

// Configuration
const API_BASE_URL = 'http://172.20.10.8:3000/api';
const BACKEND_USER_CREDENTIALS = {
  username: 'backend_user',
  password: '95f42g8aH7'
};
const FIELD_USER_USERNAME = 'nikhil.parab';
let FIELD_USER_ID = null; // Will be fetched dynamically

// Verification Types (will be fetched from API)
const VERIFICATION_TYPES = [
  { name: 'Residence Verification', code: 'RESIDENCE' },
  { name: 'Residence cum Office Verification', code: 'RESIDENCE_CUM_OFFICE' },
  { name: 'Office Verification', code: 'OFFICE' },
  { name: 'Business Verification', code: 'BUSINESS' },
  { name: 'Builder Verification', code: 'BUILDER' },
  { name: 'NOC Verification', code: 'NOC' },
  { name: 'DSA DST & Connector Verification', code: 'DSA_CONNECTOR' },
  { name: 'Property APF Verification', code: 'PROPERTY_APF' },
  { name: 'Property Individual Verification', code: 'PROPERTY_INDIVIDUAL' }
];

// Form Outcomes for each verification type
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
  { name: 'Vikram Reddy', phone: '9876543214', city: 'Hyderabad', area: 'Banjara Hills' },
  { name: 'Meera Nair', phone: '9876543215', city: 'Bangalore', area: 'Whitefield' },
  { name: 'Ravi Gupta', phone: '9876543216', city: 'Chennai', area: 'T Nagar' },
  { name: 'Kavita Joshi', phone: '9876543217', city: 'Kolkata', area: 'Salt Lake' },
  { name: 'Deepak Agarwal', phone: '9876543218', city: 'Jaipur', area: 'Malviya Nagar' }
];

// Global variables
let authToken = null;
let verificationTypesMap = {};
let clientsMap = {};
let productsMap = {};
let rateTypesMap = {};
let validRateAssignments = [];

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
 * Fetch system data (verification types, clients, products, rate types, users)
 */
async function fetchSystemData() {
  try {
    console.log('📊 Fetching system data...');

    const headers = { Authorization: `Bearer ${authToken}` };

    // Fetch field user ID by username
    try {
      const usersResponse = await axios.get(`${API_BASE_URL}/users`, { headers });
      if (usersResponse.data.success && usersResponse.data.data.length > 0) {
        const fieldUser = usersResponse.data.data.find(user => user.username === FIELD_USER_USERNAME);
        if (fieldUser) {
          FIELD_USER_ID = fieldUser.id;
          console.log(`✅ Found field user: ${FIELD_USER_USERNAME} (ID: ${FIELD_USER_ID})`);
        } else {
          console.error(`❌ Field user ${FIELD_USER_USERNAME} not found`);
          return false;
        }
      } else {
        console.error(`❌ Could not find field user: ${FIELD_USER_USERNAME}`);
        return false;
      }
    } catch (error) {
      console.error(`❌ Error fetching field user: ${error.response?.data?.message || error.message}`);
      return false;
    }

    // Fetch verification types
    const verificationTypesResponse = await axios.get(`${API_BASE_URL}/verification-types`, { headers });
    if (verificationTypesResponse.data.success) {
      verificationTypesResponse.data.data.forEach(vt => {
        verificationTypesMap[vt.code || vt.name] = vt.id;
      });
      console.log(`✅ Loaded ${Object.keys(verificationTypesMap).length} verification types`);
    }

    // Fetch clients
    const clientsResponse = await axios.get(`${API_BASE_URL}/clients`, { headers });
    if (clientsResponse.data.success) {
      clientsResponse.data.data.forEach(client => {
        clientsMap[client.name] = client.id;
      });
      console.log(`✅ Loaded ${Object.keys(clientsMap).length} clients`);
    }

    // Fetch products
    const productsResponse = await axios.get(`${API_BASE_URL}/products`, { headers });
    if (productsResponse.data.success) {
      productsResponse.data.data.forEach(product => {
        productsMap[product.name] = product.id;
      });
      console.log(`✅ Loaded ${Object.keys(productsMap).length} products`);
    }

    // Fetch rate types
    const rateTypesResponse = await axios.get(`${API_BASE_URL}/rate-types`, { headers });
    if (rateTypesResponse.data.success) {
      rateTypesResponse.data.data.forEach(rateType => {
        rateTypesMap[rateType.name] = rateType.id;
      });
      console.log(`✅ Loaded ${Object.keys(rateTypesMap).length} rate types`);
    }

    // Fetch valid rate type assignments
    const assignmentsResponse = await axios.get(`${API_BASE_URL}/rate-type-assignments`, { headers });
    if (assignmentsResponse.data.success) {
      validRateAssignments = assignmentsResponse.data.data;
      console.log(`✅ Loaded ${validRateAssignments.length} valid rate assignments`);
    }

    return true;
  } catch (error) {
    console.error('❌ Error fetching system data:', error.response?.data?.message || error.message);
    return false;
  }
}

/**
 * Generate test case data
 */
function generateTestCaseData(verificationTypeCode, formOutcome, customerIndex) {
  const customer = CUSTOMER_TEMPLATES[customerIndex % CUSTOMER_TEMPLATES.length];
  const verificationTypeId = verificationTypesMap[verificationTypeCode];

  // Find a valid rate assignment for this verification type
  const validAssignment = validRateAssignments.find(assignment =>
    assignment.verificationTypeId === verificationTypeId
  );

  if (!validAssignment) {
    console.error(`❌ No valid rate assignment found for verification type: ${verificationTypeCode}`);
    return null;
  }

  return {
    customerName: customer.name,
    customerPhone: customer.phone,
    customerCallingCode: '+91',
    clientId: validAssignment.clientId,
    productId: validAssignment.productId,
    verificationTypeId: validAssignment.verificationTypeId,
    rateTypeId: validAssignment.rateTypeId,
    address: `${Math.floor(Math.random() * 999) + 1}, ${customer.area}, ${customer.city}`,
    pincode: `${Math.floor(Math.random() * 900000) + 100000}`,
    priority: ['LOW', 'MEDIUM', 'HIGH'][Math.floor(Math.random() * 3)],
    applicantType: 'APPLICANT',
    trigger: `Test case for ${verificationTypeCode} - ${formOutcome}`,
    backendContactNumber: customer.phone,
    assignedToId: FIELD_USER_ID
  };
}

/**
 * Create a single test case
 */
async function createTestCase(caseData, verificationTypeCode, formOutcome, caseNumber) {
  try {
    const headers = { 
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    };
    
    const response = await axios.post(`${API_BASE_URL}/cases`, caseData, { headers });
    
    if (response.data.success) {
      console.log(`✅ Case ${caseNumber}: ${verificationTypeCode} - ${formOutcome} (ID: ${response.data.data.caseId})`);
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
  console.log('🚀 Starting Comprehensive Test Case Creation');
  console.log('=' .repeat(60));
  
  // Step 1: Authenticate
  if (!(await authenticate())) {
    process.exit(1);
  }
  
  // Step 2: Fetch system data
  if (!(await fetchSystemData())) {
    process.exit(1);
  }
  
  // Step 3: Create test cases
  console.log('\n📝 Creating test cases...');
  console.log('Target: 45 cases (9 verification types × 5 form outcomes)');
  console.log('-'.repeat(60));
  
  let caseNumber = 1;
  let successCount = 0;
  let failureCount = 0;
  
  for (const verificationType of VERIFICATION_TYPES) {
    console.log(`\n📋 Creating cases for: ${verificationType.name}`);
    
    for (const formOutcome of FORM_OUTCOMES) {
      const caseData = generateTestCaseData(verificationType.code, formOutcome, caseNumber - 1);

      if (caseData) {
        const result = await createTestCase(caseData, verificationType.code, formOutcome, caseNumber);

        if (result) {
          successCount++;
        } else {
          failureCount++;
        }
      } else {
        console.log(`⚠️  Skipping case ${caseNumber}: No valid rate assignment for ${verificationType.code}`);
        failureCount++;
      }

      caseNumber++;

      // Small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  // Step 4: Summary
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
