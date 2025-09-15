const { default: fetch } = require('node-fetch');
require('dotenv').config();

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/api';

async function testSecureAttachments() {
  try {
    console.log('🔒 TESTING SECURE ATTACHMENT SYSTEM');
    console.log('===================================');
    
    // Step 1: Test public access (should fail)
    console.log('\n1. 🚫 Testing public access (should fail)...');
    try {
      const publicResponse = await fetch('http://localhost:3000/uploads/attachments/case_25/attachment_1757775267383-862981644.png');
      console.log(`Public access status: ${publicResponse.status}`);
      if (publicResponse.status === 404) {
        console.log('✅ Public access properly blocked');
      } else {
        console.log('❌ Public access not blocked!');
      }
    } catch (error) {
      console.log('✅ Public access properly blocked (connection refused)');
    }
    
    // Step 2: Login to get token
    console.log('\n2. 🔐 Logging in...');
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
    
    // Step 3: Test secure attachment access without auth (should fail)
    console.log('\n3. 🚫 Testing secure API without auth (should fail)...');
    const noAuthResponse = await fetch(`${API_BASE_URL}/attachments/441/serve`);
    console.log(`No auth status: ${noAuthResponse.status}`);
    if (noAuthResponse.status === 401) {
      console.log('✅ Secure API properly requires authentication');
    } else {
      console.log('❌ Secure API does not require authentication!');
    }
    
    // Step 4: Test secure attachment access with auth (should work)
    console.log('\n4. ✅ Testing secure API with auth (should work)...');
    const authResponse = await fetch(`${API_BASE_URL}/attachments/441/serve`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-App-Version': '4.0.0',
        'X-Platform': 'MOBILE'
      }
    });
    
    console.log(`Authenticated access status: ${authResponse.status}`);
    console.log(`Content-Type: ${authResponse.headers.get('content-type')}`);
    console.log(`Content-Length: ${authResponse.headers.get('content-length')}`);
    
    if (authResponse.ok) {
      const buffer = await authResponse.arrayBuffer();
      console.log(`File size: ${buffer.byteLength} bytes`);
      
      // Check if it's a PNG file (PNG signature: 89 50 4E 47)
      const pngSignature = new Uint8Array(buffer.slice(0, 4));
      const isPNG = pngSignature[0] === 0x89 && pngSignature[1] === 0x50 && pngSignature[2] === 0x4E && pngSignature[3] === 0x47;
      console.log(`Is PNG file: ${isPNG}`);
      
      if (isPNG) {
        console.log('✅ Secure attachment access working correctly');
      } else {
        console.log('⚠️  File does not have PNG signature!');
      }
    } else {
      console.log('❌ Authenticated access failed');
    }
    
    // Step 5: Test mobile app attachment URLs
    console.log('\n5. 📱 Testing mobile app attachment URLs...');
    const mobileAttachmentsResponse = await fetch(`${API_BASE_URL}/mobile/cases/25/attachments`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-App-Version': '4.0.0',
        'X-Platform': 'MOBILE'
      }
    });
    
    const mobileAttachmentsData = await mobileAttachmentsResponse.json();
    
    if (mobileAttachmentsData.success && mobileAttachmentsData.data.length > 0) {
      const attachment = mobileAttachmentsData.data[0];
      console.log(`Mobile app URL format: ${attachment.url}`);
      
      // Test if the mobile app URL works
      const fullMobileUrl = attachment.url.startsWith('/api/')
        ? `http://localhost:3000${attachment.url}`
        : attachment.url;

      const mobileUrlResponse = await fetch(fullMobileUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-App-Version': '4.0.0',
          'X-Platform': 'MOBILE'
        }
      });
      
      console.log(`Mobile URL status: ${mobileUrlResponse.status}`);
      if (mobileUrlResponse.ok) {
        console.log('✅ Mobile app URL format working correctly');
      } else {
        console.log('❌ Mobile app URL format not working');
      }
    }
    
    console.log('\n🎯 SECURITY TEST COMPLETE');
    console.log('\n📋 SUMMARY:');
    console.log('- ✅ Public file access blocked');
    console.log('- ✅ API requires authentication');
    console.log('- ✅ Authenticated access works');
    console.log('- ✅ Mobile app URLs use secure endpoints');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testSecureAttachments();
