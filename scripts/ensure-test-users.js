#!/usr/bin/env node

/**
 * Ensure Test Users Script
 * Creates required backend and field users if they don't exist
 */

const axios = require('axios');

// Configuration
const API_BASE_URL = 'http://172.20.10.8:3000/api';

// Admin credentials for user creation (assuming there's an admin user)
const ADMIN_CREDENTIALS = {
  username: 'admin',
  password: 'admin123'
};

// Users to create
const REQUIRED_USERS = [
  {
    name: 'Backend User',
    username: 'backend_user',
    email: 'backend_user@example.com',
    password: '95f42g8aH7',
    role: 'BACKEND_USER',
    employeeId: 'BU001',
    designation: 'Backend Operator'
  },
  {
    name: 'Nikhil Parab',
    username: 'nikhil.parab',
    email: 'nikhil.parab@example.com',
    password: 'nikhil123',
    role: 'FIELD_AGENT',
    employeeId: 'FA001',
    designation: 'Field Executive'
  }
];

let adminToken = null;

/**
 * Try to authenticate with admin credentials
 */
async function authenticateAdmin() {
  try {
    console.log('🔐 Attempting admin authentication...');
    const response = await axios.post(`${API_BASE_URL}/auth/login`, ADMIN_CREDENTIALS);
    
    if (response.data.success && response.data.data.token) {
      adminToken = response.data.data.token;
      console.log('✅ Admin authentication successful');
      return true;
    } else {
      console.log('❌ Admin authentication failed');
      return false;
    }
  } catch (error) {
    console.log('❌ Admin authentication error:', error.response?.data?.message || error.message);
    return false;
  }
}

/**
 * Try alternative authentication methods
 */
async function tryAlternativeAuth() {
  // Try common admin credentials
  const alternatives = [
    { username: 'admin', password: 'password123' },
    { username: 'admin', password: 'admin' },
    { username: 'superadmin', password: 'superadmin123' },
    { username: 'test@example.com', password: 'password123' }
  ];

  for (const creds of alternatives) {
    try {
      console.log(`🔐 Trying credentials: ${creds.username}`);
      const response = await axios.post(`${API_BASE_URL}/auth/login`, creds);
      
      if (response.data.success && response.data.data.token) {
        adminToken = response.data.data.token;
        console.log(`✅ Authentication successful with: ${creds.username}`);
        return true;
      }
    } catch (error) {
      console.log(`❌ Failed with: ${creds.username}`);
    }
  }
  
  return false;
}

/**
 * Check if a user exists
 */
async function userExists(username) {
  try {
    const headers = { Authorization: `Bearer ${adminToken}` };
    const response = await axios.get(`${API_BASE_URL}/users/search?search=${username}`, { headers });
    
    if (response.data.success && response.data.data.length > 0) {
      const user = response.data.data.find(u => u.username === username);
      return user ? user.id : null;
    }
    return null;
  } catch (error) {
    console.error(`❌ Error checking user ${username}:`, error.response?.data?.message || error.message);
    return null;
  }
}

/**
 * Create a user
 */
async function createUser(userData) {
  try {
    const headers = { 
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    };
    
    const response = await axios.post(`${API_BASE_URL}/users`, userData, { headers });
    
    if (response.data.success) {
      console.log(`✅ Created user: ${userData.username} (ID: ${response.data.data.id})`);
      return response.data.data;
    } else {
      console.error(`❌ Failed to create user ${userData.username}:`, response.data.message);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error creating user ${userData.username}:`, error.response?.data?.message || error.message);
    return null;
  }
}

/**
 * Main execution function
 */
async function main() {
  console.log('🚀 Ensuring Required Test Users Exist');
  console.log('=' .repeat(50));
  
  // Step 1: Authenticate
  let authenticated = await authenticateAdmin();
  
  if (!authenticated) {
    console.log('🔄 Trying alternative authentication methods...');
    authenticated = await tryAlternativeAuth();
  }
  
  if (!authenticated) {
    console.error('❌ Could not authenticate with any admin credentials');
    console.log('\n📝 Manual Steps Required:');
    console.log('1. Ensure an admin user exists in the system');
    console.log('2. Update the ADMIN_CREDENTIALS in this script');
    console.log('3. Or manually create the required users:');
    REQUIRED_USERS.forEach(user => {
      console.log(`   - Username: ${user.username}, Password: ${user.password}, Role: ${user.role}`);
    });
    process.exit(1);
  }
  
  // Step 2: Check and create users
  console.log('\n👥 Checking required users...');
  
  let createdCount = 0;
  let existingCount = 0;
  
  for (const userData of REQUIRED_USERS) {
    console.log(`\n🔍 Checking user: ${userData.username}`);
    
    const existingUserId = await userExists(userData.username);
    
    if (existingUserId) {
      console.log(`✅ User ${userData.username} already exists (ID: ${existingUserId})`);
      existingCount++;
    } else {
      console.log(`➕ Creating user: ${userData.username}`);
      const newUser = await createUser(userData);
      
      if (newUser) {
        createdCount++;
      }
    }
  }
  
  // Step 3: Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 USER CREATION SUMMARY');
  console.log('='.repeat(50));
  console.log(`✅ Existing users: ${existingCount}`);
  console.log(`➕ Created users: ${createdCount}`);
  console.log(`📈 Total users checked: ${REQUIRED_USERS.length}`);
  
  if (existingCount + createdCount === REQUIRED_USERS.length) {
    console.log('\n🎉 All required users are now available!');
    console.log('\n📋 Test User Credentials:');
    REQUIRED_USERS.forEach(user => {
      console.log(`  ${user.role}: ${user.username} / ${user.password}`);
    });
  } else {
    console.log('\n⚠️  Some users could not be created. Please check the logs above.');
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
