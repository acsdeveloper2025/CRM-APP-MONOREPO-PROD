#!/usr/bin/env node

/**
 * Mobile App Login Test Script
 * This script simulates the exact behavior of the mobile app to test login functionality
 */

const https = require('https');

// Configuration matching the mobile app
const CONFIG = {
  API_BASE_URL: 'https://crm.allcheckservices.com/api',
  APP_VERSION: '4.0.0',
  PLATFORM: 'ANDROID',
  CLIENT_TYPE: 'mobile',
  DEVICE_ID: 'mobile-app-device',
  USER_AGENT: 'Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36'
};

// Test credentials
const TEST_CREDENTIALS = {
  username: 'nikhil.parab',
  password: 'nikhil123'
};

/**
 * Test network connectivity to the API server
 */
async function testNetworkConnectivity() {
  console.log('🌐 Testing network connectivity...');
  
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'crm.allcheckservices.com',
      port: 443,
      path: '/api/health',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': CONFIG.USER_AGENT
      },
      timeout: 10000
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          console.log('✅ Network connectivity test successful:', result);
          resolve({ success: true, message: 'Network connectivity OK', data: result });
        } catch (error) {
          console.error('❌ Failed to parse health check response:', error);
          resolve({ success: false, message: 'Invalid response format' });
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Network connectivity test error:', error.message);
      resolve({ success: false, message: `Network error: ${error.message}` });
    });

    req.on('timeout', () => {
      console.error('❌ Network connectivity test timeout');
      req.destroy();
      resolve({ success: false, message: 'Request timeout' });
    });

    req.end();
  });
}

/**
 * Test mobile login with exact headers that the mobile app sends
 */
async function testMobileLogin() {
  console.log('🔐 Testing mobile login...');
  
  const headers = {
    'Content-Type': 'application/json',
    'X-App-Version': CONFIG.APP_VERSION,
    'X-Platform': CONFIG.PLATFORM,
    'X-Client-Type': CONFIG.CLIENT_TYPE,
    'X-Device-ID': CONFIG.DEVICE_ID,
    'User-Agent': CONFIG.USER_AGENT
  };

  console.log('🌐 Making login request with headers:', headers);
  console.log('🔗 Login URL:', `${CONFIG.API_BASE_URL}/mobile/auth/login`);

  const requestBody = JSON.stringify({
    username: TEST_CREDENTIALS.username,
    password: TEST_CREDENTIALS.password,
    deviceId: CONFIG.DEVICE_ID
  });

  console.log('📤 Request body:', {
    username: TEST_CREDENTIALS.username,
    password: '***',
    deviceId: CONFIG.DEVICE_ID
  });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'crm.allcheckservices.com',
      port: 443,
      path: '/api/mobile/auth/login',
      method: 'POST',
      headers: {
        ...headers,
        'Content-Length': Buffer.byteLength(requestBody)
      },
      timeout: 30000
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      console.log('📡 Login response status:', res.statusCode, res.statusMessage);
      console.log('📡 Response headers:', res.headers);
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          console.log('📋 Login response data:', {
            success: result.success,
            message: result.message,
            hasUser: !!result.data?.user,
            hasTokens: !!result.data?.tokens
          });
          
          if (result.success) {
            console.log('✅ Login successful!');
            console.log('👤 User:', result.data.user.name, `(${result.data.user.role})`);
            console.log('🔑 Access token length:', result.data.tokens.accessToken.length);
            resolve({ success: true, data: result });
          } else {
            console.error('❌ Login failed:', result.message);
            resolve({ success: false, error: result.message, data: result });
          }
        } catch (error) {
          console.error('❌ Failed to parse login response:', error);
          console.error('Raw response:', data);
          resolve({ success: false, error: 'Invalid response format', rawData: data });
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Login request error:', error.message);
      resolve({ success: false, error: `Network error: ${error.message}` });
    });

    req.on('timeout', () => {
      console.error('❌ Login request timeout');
      req.destroy();
      resolve({ success: false, error: 'Request timeout' });
    });

    req.write(requestBody);
    req.end();
  });
}

/**
 * Test with different User-Agent strings to see if that's the issue
 */
async function testWithDifferentUserAgents() {
  console.log('🔍 Testing with different User-Agent strings...');

  const userAgents = [
    'Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 9; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/91.0.4472.120 Mobile Safari/537.36',
    'CaseFlow-Mobile/4.0.0 (Android 9; Mobile)',
    'Capacitor/4.0.0 (Android 9; Mobile)',
    ''
  ];

  for (let i = 0; i < userAgents.length; i++) {
    const userAgent = userAgents[i];
    console.log(`\n🧪 Test ${i + 1}: User-Agent: "${userAgent}"`);

    const headers = {
      'Content-Type': 'application/json',
      'X-App-Version': CONFIG.APP_VERSION,
      'X-Platform': CONFIG.PLATFORM,
      'X-Client-Type': CONFIG.CLIENT_TYPE,
      'X-Device-ID': CONFIG.DEVICE_ID,
      'User-Agent': userAgent
    };

    const requestBody = JSON.stringify({
      username: TEST_CREDENTIALS.username,
      password: TEST_CREDENTIALS.password,
      deviceId: CONFIG.DEVICE_ID
    });

    const result = await new Promise((resolve) => {
      const options = {
        hostname: 'crm.allcheckservices.com',
        port: 443,
        path: '/api/mobile/auth/login',
        method: 'POST',
        headers: {
          ...headers,
          'Content-Length': Buffer.byteLength(requestBody)
        },
        timeout: 10000
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            console.log(`   Status: ${res.statusCode} - ${result.success ? '✅ SUCCESS' : '❌ FAILED'}`);
            if (!result.success) {
              console.log(`   Error: ${result.message}`);
            }
            resolve({ success: result.success, status: res.statusCode, data: result });
          } catch (error) {
            console.log(`   Status: ${res.statusCode} - ❌ PARSE ERROR`);
            resolve({ success: false, status: res.statusCode, error: 'Parse error' });
          }
        });
      });

      req.on('error', (error) => {
        console.log(`   ❌ REQUEST ERROR: ${error.message}`);
        resolve({ success: false, error: error.message });
      });

      req.on('timeout', () => {
        console.log(`   ❌ TIMEOUT`);
        req.destroy();
        resolve({ success: false, error: 'Timeout' });
      });

      req.write(requestBody);
      req.end();
    });
  }
}

/**
 * Main test function
 */
async function runTests() {
  console.log('🚀 Starting Mobile App Login Tests');
  console.log('=' .repeat(50));
  
  // Test 1: Network Connectivity
  console.log('\n📋 Test 1: Network Connectivity');
  const networkTest = await testNetworkConnectivity();
  
  if (!networkTest.success) {
    console.error('❌ Network connectivity failed. Aborting tests.');
    process.exit(1);
  }
  
  // Test 2: Mobile Login
  console.log('\n📋 Test 2: Mobile Login');
  const loginTest = await testMobileLogin();

  // Test 3: Different User-Agent strings
  console.log('\n📋 Test 3: Different User-Agent Strings');
  await testWithDifferentUserAgents();

  // Summary
  console.log('\n' + '=' .repeat(50));
  console.log('📊 Test Summary:');
  console.log(`🌐 Network Connectivity: ${networkTest.success ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`🔐 Mobile Login: ${loginTest.success ? '✅ PASS' : '❌ FAIL'}`);
  
  if (loginTest.success) {
    console.log('\n🎉 All tests passed! The mobile app should work correctly.');
  } else {
    console.log('\n❌ Login test failed. Issue details:');
    console.log('Error:', loginTest.error);
    if (loginTest.data) {
      console.log('Response data:', loginTest.data);
    }
  }
  
  console.log('\n🔧 This test simulates the exact behavior of the mobile APK.');
  console.log('If this test passes but the APK still fails, the issue is likely:');
  console.log('- Android WebView configuration');
  console.log('- Capacitor network plugin issues');
  console.log('- Device-specific network restrictions');
  console.log('- SSL certificate validation in WebView');
}

// Run the tests
runTests().catch(console.error);
