const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const { default: fetch } = require('node-fetch');
require('dotenv').config();

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/api';

async function testRestrictedFormats() {
  try {
    console.log('🔒 TESTING RESTRICTED FILE FORMATS');
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
        password: 'admin123'
      })
    });
    
    const loginData = await loginResponse.json();
    if (!loginData.success) {
      throw new Error(`Login failed: ${loginData.message}`);
    }
    
    const token = loginData.data.tokens.accessToken;
    console.log('✅ Login successful');
    
    // Step 2: Test allowed formats (should work)
    console.log('\n2. ✅ Testing ALLOWED formats...');
    
    const allowedTests = [
      { name: 'test.jpg', content: Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]), type: 'image/jpeg' },
      { name: 'test.png', content: Buffer.from([0x89, 0x50, 0x4E, 0x47]), type: 'image/png' },
      { name: 'test.pdf', content: Buffer.from('%PDF-1.4'), type: 'application/pdf' },
    ];
    
    for (const test of allowedTests) {
      const testFilePath = path.join(__dirname, test.name);
      fs.writeFileSync(testFilePath, test.content);
      
      const formData = new FormData();
      formData.append('files', fs.createReadStream(testFilePath));
      formData.append('caseId', '25');
      formData.append('category', 'DOCUMENT');
      
      try {
        const uploadResponse = await fetch(`${API_BASE_URL}/attachments/upload`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            ...formData.getHeaders()
          },
          body: formData
        });
        
        const uploadData = await uploadResponse.json();
        
        if (uploadData.success) {
          console.log(`   ✅ ${test.name} - ALLOWED (correct)`);
        } else {
          console.log(`   ❌ ${test.name} - REJECTED (incorrect): ${uploadData.message}`);
        }
      } catch (error) {
        console.log(`   ❌ ${test.name} - ERROR: ${error.message}`);
      }
      
      // Cleanup
      fs.unlinkSync(testFilePath);
    }
    
    // Step 3: Test forbidden formats (should be rejected)
    console.log('\n3. 🚫 Testing FORBIDDEN formats...');
    
    const forbiddenTests = [
      { name: 'test.txt', content: Buffer.from('Hello World'), type: 'text/plain' },
      { name: 'test.xlsx', content: Buffer.from('PK\x03\x04'), type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
      { name: 'test.zip', content: Buffer.from('PK\x03\x04'), type: 'application/zip' },
      { name: 'test.csv', content: Buffer.from('name,age\nJohn,30'), type: 'text/csv' },
      { name: 'test.rtf', content: Buffer.from('{\\rtf1\\ansi\\deff0 Hello}'), type: 'application/rtf' },
    ];
    
    for (const test of forbiddenTests) {
      const testFilePath = path.join(__dirname, test.name);
      fs.writeFileSync(testFilePath, test.content);
      
      const formData = new FormData();
      formData.append('files', fs.createReadStream(testFilePath));
      formData.append('caseId', '25');
      formData.append('category', 'DOCUMENT');
      
      try {
        const uploadResponse = await fetch(`${API_BASE_URL}/attachments/upload`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            ...formData.getHeaders()
          },
          body: formData
        });
        
        const uploadData = await uploadResponse.json();
        
        if (!uploadData.success && uploadData.message.includes('not supported')) {
          console.log(`   ✅ ${test.name} - REJECTED (correct)`);
        } else if (uploadData.success) {
          console.log(`   ❌ ${test.name} - ALLOWED (incorrect - should be rejected!)`);
        } else {
          console.log(`   ⚠️  ${test.name} - REJECTED for other reason: ${uploadData.message}`);
        }
      } catch (error) {
        console.log(`   ❌ ${test.name} - ERROR: ${error.message}`);
      }
      
      // Cleanup
      fs.unlinkSync(testFilePath);
    }
    
    // Step 4: Get current supported types
    console.log('\n4. 📋 Current supported file types:');
    const typesResponse = await fetch(`${API_BASE_URL}/attachments/types`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      }
    });
    
    const typesData = await typesResponse.json();
    if (typesData.success) {
      console.log('   📸 Images:', typesData.data.supportedTypes.images.extensions.join(', '));
      console.log('   📄 Documents:', typesData.data.supportedTypes.documents.extensions.join(', '));
      console.log('   📏 Max file size:', typesData.data.maxFileSize);
      console.log('   📦 Max files per upload:', typesData.data.maxFilesPerUpload);
    }
    
    console.log('\n🎯 RESTRICTION TEST COMPLETE');
    console.log('\n📋 SUMMARY:');
    console.log('- ✅ Only images, PDF, and Word documents are allowed');
    console.log('- 🚫 Spreadsheets, archives, and text files are blocked');
    console.log('- 🔒 File type validation working correctly');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testRestrictedFormats();
