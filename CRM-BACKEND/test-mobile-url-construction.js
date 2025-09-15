const { default: fetch } = require('node-fetch');
require('dotenv').config();

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/api';

async function testMobileUrlConstruction() {
  try {
    console.log('🧪 TESTING MOBILE URL CONSTRUCTION');
    console.log('==================================');
    
    // Step 1: Login to get token
    console.log('\n1. 🔐 Logging in...');
    const loginResponse = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'admin',
        password: 'CHANGE_ME_PASSWORD'
      })
    });
    
    const loginData = await loginResponse.json();
    if (!loginData.success) {
      throw new Error(`Login failed: ${loginData.message}`);
    }
    
    const token = loginData.data.tokens.accessToken;
    console.log('✅ Login successful');
    
    // Step 2: Get mobile attachments for case #25
    console.log('\n2. 📱 Getting mobile attachments for case #25...');
    const mobileAttachmentsResponse = await fetch(`${API_BASE_URL}/mobile/cases/25/attachments`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-App-Version': '4.0.0',
        'X-Platform': 'MOBILE'
      }
    });
    
    const mobileAttachmentsData = await mobileAttachmentsResponse.json();
    
    if (!mobileAttachmentsData.success) {
      throw new Error(`Failed to get attachments: ${mobileAttachmentsData.message}`);
    }
    
    console.log(`Found ${mobileAttachmentsData.data.length} attachments`);
    
    // Step 3: Test URL construction like mobile app does
    console.log('\n3. 🔗 Testing URL construction...');
    
    // Simulate mobile app URL construction
    const baseUrl = 'http://10.100.100.30:3000/api';
    const staticBaseUrl = baseUrl.replace('/api', '');
    
    console.log(`Base URL: ${baseUrl}`);
    console.log(`Static Base URL: ${staticBaseUrl}`);
    
    for (const attachment of mobileAttachmentsData.data) {
      console.log(`\n📎 Testing attachment: ${attachment.originalName}`);
      console.log(`Backend URL: ${attachment.url}`);
      
      // Mobile app URL construction (current)
      const mobileAppUrl = `${staticBaseUrl}${attachment.url}`;
      console.log(`Mobile App URL: ${mobileAppUrl}`);
      
      // Correct URL construction
      const correctUrl = `http://localhost:3000${attachment.url}`;
      console.log(`Correct URL: ${correctUrl}`);
      
      // Test mobile app URL
      console.log('\n🧪 Testing mobile app URL...');
      try {
        const mobileResponse = await fetch(mobileAppUrl);
        console.log(`Mobile URL Status: ${mobileResponse.status}`);
        if (mobileResponse.ok) {
          console.log('✅ Mobile URL works');
        } else {
          console.log('❌ Mobile URL failed');
        }
      } catch (error) {
        console.log(`❌ Mobile URL error: ${error.message}`);
      }
      
      // Test correct URL
      console.log('\n🧪 Testing correct URL...');
      try {
        const correctResponse = await fetch(correctUrl);
        console.log(`Correct URL Status: ${correctResponse.status}`);
        if (correctResponse.ok) {
          console.log('✅ Correct URL works');
        } else {
          console.log('❌ Correct URL failed');
        }
      } catch (error) {
        console.log(`❌ Correct URL error: ${error.message}`);
      }
      
      // Only test first attachment to avoid spam
      break;
    }
    
    console.log('\n🎯 TEST COMPLETE');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testMobileUrlConstruction();
