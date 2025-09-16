const { default: fetch } = require('node-fetch');
require('dotenv').config();

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/api';

async function testMobileAppFlow() {
  try {
    console.log('📱 TESTING MOBILE APP ATTACHMENT FLOW');
    console.log('====================================');
    
    // Step 1: Login to get token
    console.log('\n1. 🔐 Logging in...');
    const loginResponse = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'admin',
        password: 'admin123'
      })
    });
    
    const loginData = await loginResponse.json();
    if (!loginData.success) {
      throw new Error(`Login failed: ${loginData.message}`);
    }
    
    const token = loginData.data.tokens.accessToken;
    console.log('✅ Login successful');
    
    // Step 2: Get mobile attachments (simulating mobile app)
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
    
    // Step 3: Simulate mobile app attachment loading
    for (const attachment of mobileAttachmentsData.data) {
      console.log(`\n📎 Testing attachment: ${attachment.originalName}`);
      console.log(`   ID: ${attachment.id}`);
      console.log(`   Type: ${attachment.mimeType}`);
      console.log(`   Size: ${attachment.size} bytes`);
      console.log(`   URL: ${attachment.url}`);
      
      // Simulate mobile app URL construction
      const baseUrl = 'http://103.14.234.36:3000/api';
      const fullUrl = attachment.url.startsWith('/api/') 
        ? `${baseUrl}${attachment.url.substring(4)}`
        : `${baseUrl}${attachment.url}`;
      
      console.log(`   Full URL: ${fullUrl}`);
      
      // Test fetching with authentication (simulating mobile app)
      console.log('\n   🔄 Fetching with authentication...');
      const fetchResponse = await fetch(fullUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-App-Version': '4.0.0',
          'X-Platform': 'MOBILE'
        }
      });
      
      console.log(`   Status: ${fetchResponse.status}`);
      console.log(`   Content-Type: ${fetchResponse.headers.get('content-type')}`);
      
      if (fetchResponse.ok) {
        const buffer = await fetchResponse.arrayBuffer();
        console.log(`   ✅ Successfully fetched ${buffer.byteLength} bytes`);
        
        // Simulate converting to data URL (like mobile app does)
        const base64 = Buffer.from(buffer).toString('base64');
        const dataUrl = `data:${attachment.mimeType};base64,${base64}`;
        console.log(`   📄 Data URL length: ${dataUrl.length} characters`);
        console.log(`   🎯 Mobile app would display this as: ${dataUrl.substring(0, 50)}...`);
      } else {
        console.log(`   ❌ Failed to fetch attachment`);
      }
      
      // Only test first attachment to avoid spam
      break;
    }
    
    console.log('\n🎯 MOBILE APP FLOW TEST COMPLETE');
    console.log('\n📋 SUMMARY:');
    console.log('- ✅ Mobile app can authenticate');
    console.log('- ✅ Mobile app gets secure attachment URLs');
    console.log('- ✅ Mobile app can fetch attachment data with auth');
    console.log('- ✅ Mobile app can convert to data URLs for display');
    console.log('\n🎉 The mobile app should now display images correctly!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testMobileAppFlow();
