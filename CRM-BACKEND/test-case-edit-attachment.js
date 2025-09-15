const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const { default: fetch } = require('node-fetch');
require('dotenv').config();

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/api';

async function testCaseEditAttachment() {
  try {
    console.log('🧪 TESTING CASE EDIT ATTACHMENT FUNCTIONALITY');
    console.log('=============================================');
    
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
    
    // Step 2: Create a test file for case edit
    console.log('\n2. 📄 Creating test file for case edit...');
    const testFilePath = path.join(__dirname, 'test-case-edit-attachment.jpg');
    // Create a simple JPEG-like content (for testing purposes)
    const jpegContent = Buffer.from([
      0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
      0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
      0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
      0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
      0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
      0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
      0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xD9
    ]);
    fs.writeFileSync(testFilePath, jpegContent);
    console.log('✅ Test JPEG file created');
    
    // Step 3: Test case edit attachment upload using /attachments/upload endpoint
    console.log('\n3. 📎 Testing case edit attachment upload (case #25)...');
    const formData = new FormData();
    
    // Add attachment file
    formData.append('files', fs.createReadStream(testFilePath));
    formData.append('caseId', '25');
    formData.append('category', 'DOCUMENT');
    formData.append('description', 'Test attachment added via case edit');
    
    const uploadResponse = await fetch(`${API_BASE_URL}/attachments/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        ...formData.getHeaders()
      },
      body: formData
    });
    
    const uploadData = await uploadResponse.json();
    console.log('Case edit attachment upload response:', JSON.stringify(uploadData, null, 2));
    
    if (!uploadData.success) {
      throw new Error(`Case edit attachment upload failed: ${uploadData.message}`);
    }
    
    console.log('✅ Case edit attachment uploaded successfully');
    
    // Step 4: Verify the attachment appears in mobile API
    console.log('\n4. 📱 Verifying attachment appears in mobile API...');
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second for processing
    
    const mobileAttachmentsResponse = await fetch(`${API_BASE_URL}/mobile/cases/25/attachments`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-App-Version': '4.0.0',
        'X-Platform': 'MOBILE'
      }
    });
    
    const mobileAttachmentsData = await mobileAttachmentsResponse.json();
    console.log('Mobile attachments after case edit:', JSON.stringify(mobileAttachmentsData, null, 2));
    
    // Step 5: Check if the new attachment is in the list
    if (mobileAttachmentsData.success && mobileAttachmentsData.data.length > 0) {
      const newAttachment = mobileAttachmentsData.data.find(att => 
        att.originalName === 'test-case-edit-attachment.jpg'
      );
      
      if (newAttachment) {
        console.log('✅ Case edit attachment successfully synced to mobile API');
        console.log(`📎 New attachment ID: ${newAttachment.id}`);
        console.log(`📁 File: ${newAttachment.originalName}`);
        console.log(`🔗 URL: ${newAttachment.url}`);
      } else {
        console.log('❌ Case edit attachment NOT found in mobile API');
        console.log('Available attachments:');
        mobileAttachmentsData.data.forEach(att => {
          console.log(`- ${att.originalName} (ID: ${att.id})`);
        });
      }
    } else {
      console.log('❌ No attachments found in mobile API response');
    }
    
    // Step 6: Test direct file access for the new attachment
    if (uploadData.data && uploadData.data.length > 0) {
      const newAttachment = uploadData.data[0];
      console.log('\n6. 📁 Testing direct file access for new attachment...');
      const fileUrl = `http://localhost:3000${newAttachment.filePath}`;
      console.log(`Testing file URL: ${fileUrl}`);
      
      try {
        const fileResponse = await fetch(fileUrl, {
          headers: {
            'Authorization': `Bearer ${token}`,
          }
        });
        
        console.log(`File response status: ${fileResponse.status}`);
        
        if (fileResponse.ok) {
          const buffer = await fileResponse.arrayBuffer();
          console.log(`File size: ${buffer.byteLength} bytes`);
          
          // Check if it's a JPEG file (JPEG signature: FF D8 FF)
          const jpegSignature = new Uint8Array(buffer.slice(0, 3));
          const isJPEG = jpegSignature[0] === 0xFF && jpegSignature[1] === 0xD8 && jpegSignature[2] === 0xFF;
          console.log(`Is JPEG file: ${isJPEG}`);
          
          if (isJPEG) {
            console.log('✅ Case edit attachment file is accessible and valid');
          } else {
            console.log('⚠️  File does not have JPEG signature!');
          }
        } else {
          console.log('❌ File not accessible');
        }
      } catch (fileError) {
        console.log('❌ File access error:', fileError.message);
      }
    }
    
    // Cleanup
    fs.unlinkSync(testFilePath);
    console.log('\n🎯 TEST COMPLETE');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testCaseEditAttachment();
