const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const { default: fetch } = require('node-fetch');
require('dotenv').config();

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/api';

async function testAttachmentFlow() {
  try {
    console.log('🧪 TESTING ATTACHMENT FLOW');
    console.log('==========================');
    
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
    console.log('Login response:', JSON.stringify(loginData, null, 2));

    if (!loginData.success) {
      throw new Error(`Login failed: ${loginData.message}`);
    }

    const token = loginData.data.tokens.accessToken;
    console.log('✅ Login successful, token:', token.substring(0, 20) + '...');
    
    // Step 2: Create a test file (PDF format)
    console.log('\n2. 📄 Creating test file...');
    const testFilePath = path.join(__dirname, 'test-attachment.pdf');
    // Create a simple PDF-like content (for testing purposes)
    const pdfContent = '%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n>>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000074 00000 n \n0000000120 00000 n \ntrailer\n<<\n/Size 4\n/Root 1 0 R\n>>\nstartxref\n179\n%%EOF';
    fs.writeFileSync(testFilePath, pdfContent);
    console.log('✅ Test PDF file created');
    
    // Step 3: Create case with attachment
    console.log('\n3. 📎 Creating case with attachment...');
    const formData = new FormData();
    
    // Add case data
    formData.append('customerName', 'Test Customer');
    formData.append('customerPhone', '9999999999');
    formData.append('customerCallingCode', '+91');
    formData.append('clientId', '1');
    formData.append('productId', '1');
    formData.append('verificationTypeId', '1');
    formData.append('address', 'Test Address, Test City');
    formData.append('pincode', '123456');
    formData.append('priority', 'MEDIUM');
    formData.append('trigger', 'Test trigger');
    formData.append('applicantType', 'APPLICANT');
    
    // Add attachment
    formData.append('attachments', fs.createReadStream(testFilePath));
    
    const createCaseResponse = await fetch(`${API_BASE_URL}/cases/with-attachments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        ...formData.getHeaders()
      },
      body: formData
    });
    
    const createCaseData = await createCaseResponse.json();
    console.log('Case creation response:', JSON.stringify(createCaseData, null, 2));
    
    if (!createCaseData.success) {
      throw new Error(`Case creation failed: ${createCaseData.message}`);
    }
    
    const caseId = createCaseData.data.case.caseId;
    const caseUUID = createCaseData.data.case.id;
    console.log(`✅ Case created successfully - ID: ${caseId}, UUID: ${caseUUID}`);
    
    // Step 4: Test web attachment retrieval
    console.log('\n4. 🌐 Testing web attachment retrieval...');
    const webAttachmentsResponse = await fetch(`${API_BASE_URL}/attachments/case/${caseId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      }
    });
    
    const webAttachmentsData = await webAttachmentsResponse.json();
    console.log('Web attachments response:', JSON.stringify(webAttachmentsData, null, 2));
    
    // Step 5: Test mobile attachment retrieval (using UUID)
    console.log('\n5. 📱 Testing mobile attachment retrieval (UUID)...');
    const mobileAttachmentsResponse = await fetch(`${API_BASE_URL}/mobile/cases/${caseUUID}/attachments`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-App-Version': '4.0.0',
        'X-Platform': 'WEB'
      }
    });
    
    const mobileAttachmentsData = await mobileAttachmentsResponse.json();
    console.log('Mobile attachments response (UUID):', JSON.stringify(mobileAttachmentsData, null, 2));
    
    // Step 6: Test mobile attachment retrieval (using case number)
    console.log('\n6. 📱 Testing mobile attachment retrieval (case number)...');
    const mobileAttachmentsResponse2 = await fetch(`${API_BASE_URL}/mobile/cases/${caseId}/attachments`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-App-Version': '4.0.0',
        'X-Platform': 'WEB'
      }
    });
    
    const mobileAttachmentsData2 = await mobileAttachmentsResponse2.json();
    console.log('Mobile attachments response (case number):', JSON.stringify(mobileAttachmentsData2, null, 2));
    
    // Cleanup
    fs.unlinkSync(testFilePath);
    console.log('\n🎯 TEST COMPLETE');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testAttachmentFlow();
