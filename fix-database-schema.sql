-- Fix database schema to match backend controller expectations
-- Run this as postgres user

-- Add missing columns to cases table
ALTER TABLE cases ADD COLUMN IF NOT EXISTS "clientId" INTEGER REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS "productId" INTEGER REFERENCES products(id) ON DELETE SET NULL;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS "verificationTypeId" INTEGER REFERENCES "verificationTypes"(id) ON DELETE SET NULL;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS "createdByBackendUser" UUID REFERENCES users(id) ON DELETE SET NULL;

-- Add missing code column to clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS code VARCHAR(50) UNIQUE;

-- Update existing client with a code
UPDATE clients SET code = 'HDFC' WHERE name = 'HDFC BANK LTD' AND code IS NULL;

-- Create some sample cases for testing
INSERT INTO cases (
    "customerName", 
    "customerPhone", 
    "customerEmail",
    address, 
    pincode, 
    "verificationType",
    "applicantType",
    product,
    client,
    "clientId",
    "productId", 
    "verificationTypeId",
    priority, 
    status,
    "createdBy",
    "createdByBackendUser"
) VALUES 
(
    'John Doe',
    '9876543210', 
    'john.doe@email.com',
    '123 Main Street, Andheri West, Mumbai',
    '400001',
    'RESIDENCE',
    'APPLICANT',
    'Personal Loan',
    'HDFC BANK LTD',
    1, -- clientId
    1, -- productId (Personal Loan)
    1, -- verificationTypeId (RESIDENCE)
    'MEDIUM',
    'PENDING',
    (SELECT id FROM users WHERE username = 'admin'),
    (SELECT id FROM users WHERE username = 'admin')
),
(
    'Jane Smith',
    '9876543211',
    'jane.smith@email.com', 
    '456 Business Park, Bandra, Mumbai',
    '400002',
    'OFFICE',
    'APPLICANT',
    'Home Loan',
    'HDFC BANK LTD',
    1, -- clientId
    2, -- productId (Home Loan)
    2, -- verificationTypeId (OFFICE)
    'HIGH',
    'PENDING',
    (SELECT id FROM users WHERE username = 'admin'),
    (SELECT id FROM users WHERE username = 'admin')
),
(
    'Bob Johnson',
    '9876543212',
    'bob.johnson@email.com',
    '789 Commercial Street, Pune',
    '411001', 
    'BUSINESS',
    'APPLICANT',
    'Credit Card',
    'HDFC BANK LTD',
    1, -- clientId
    3, -- productId (Credit Card)
    3, -- verificationTypeId (BUSINESS)
    'LOW',
    'ASSIGNED',
    (SELECT id FROM users WHERE username = 'admin'),
    (SELECT id FROM users WHERE username = 'admin')
);

-- Update the assigned case to be assigned to admin user
UPDATE cases SET "assignedTo" = (SELECT id FROM users WHERE username = 'admin'), "assignedAt" = NOW() WHERE status = 'ASSIGNED';

-- Verify the changes
SELECT 'Cases created:' as info, COUNT(*) as count FROM cases;
SELECT 'Clients with codes:' as info, COUNT(*) as count FROM clients WHERE code IS NOT NULL;
