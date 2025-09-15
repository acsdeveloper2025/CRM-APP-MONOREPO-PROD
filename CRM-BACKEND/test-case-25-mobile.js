const { default: fetch } = require('node-fetch');
require('dotenv').config();

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/api';

async function testCase25Mobile() {
  try {
    console.log('🧪 TESTING CASE #25 MOBILE API');
    console.log('==============================');
    
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
    
    // Step 2: Test mobile attachment retrieval for case #25 (using case number)
    console.log('\n2. 📱 Testing mobile attachment retrieval (case number 25)...');
    const mobileAttachmentsResponse = await fetch(`${API_BASE_URL}/mobile/cases/25/attachments`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-App-Version': '4.0.0',
        'X-Platform': 'MOBILE'
      }
    });
    
    const mobileAttachmentsData = await mobileAttachmentsResponse.json();
    console.log('Mobile attachments response (case number):', JSON.stringify(mobileAttachmentsData, null, 2));
    
    // Step 3: Test mobile attachment retrieval for case #25 (using UUID)
    console.log('\n3. 📱 Testing mobile attachment retrieval (UUID)...');
    const caseUUID = '6d9f6bbf-e4e8-4a41-a1fb-083ce63b6fa9';
    const mobileAttachmentsResponse2 = await fetch(`${API_BASE_URL}/mobile/cases/${caseUUID}/attachments`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-App-Version': '4.0.0',
        'X-Platform': 'MOBILE'
      }
    });
    
    const mobileAttachmentsData2 = await mobileAttachmentsResponse2.json();
    console.log('Mobile attachments response (UUID):', JSON.stringify(mobileAttachmentsData2, null, 2));
    
    // Step 4: Test web attachment retrieval for case #25
    console.log('\n4. 🌐 Testing web attachment retrieval...');
    const webAttachmentsResponse = await fetch(`${API_BASE_URL}/attachments/case/25`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      }
    });
    
    const webAttachmentsData = await webAttachmentsResponse.json();
    console.log('Web attachments response:', JSON.stringify(webAttachmentsData, null, 2));
    
    // Step 5: Test direct file access
    console.log('\n5. 📁 Testing direct file access...');
    if (mobileAttachmentsData.success && mobileAttachmentsData.data.length > 0) {
      const attachment = mobileAttachmentsData.data[0];
      const fileUrl = `http://localhost:3000${attachment.url}`;
      console.log(`Testing file URL: ${fileUrl}`);
      
      try {
        const fileResponse = await fetch(fileUrl, {
          headers: {
            'Authorization': `Bearer ${token}`,
          }
        });
        
        console.log(`File response status: ${fileResponse.status}`);
        console.log(`File response headers:`, Object.fromEntries(fileResponse.headers.entries()));
        
        if (fileResponse.ok) {
          const buffer = await fileResponse.buffer();
          console.log(`File size: ${buffer.length} bytes`);
          console.log(`First 20 bytes: ${buffer.slice(0, 20).toString('hex')}`);
          
          // Check if it's a PNG file (PNG signature: 89 50 4E 47)
          const pngSignature = buffer.slice(0, 4);
          const isPNG = pngSignature[0] === 0x89 && pngSignature[1] === 0x50 && pngSignature[2] === 0x4E && pngSignature[3] === 0x47;
          console.log(`Is PNG file: ${isPNG}`);
          
          if (!isPNG) {
            console.log('⚠️  File does not have PNG signature!');
          }
        } else {
          console.log('❌ File not accessible');
        }
      } catch (fileError) {
        console.log('❌ File access error:', fileError.message);
      }
    }
    
    console.log('\n🎯 TEST COMPLETE');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testCase25Mobile();
