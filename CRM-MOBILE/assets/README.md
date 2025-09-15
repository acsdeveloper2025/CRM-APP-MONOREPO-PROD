# Assets Directory

This directory contains static assets for the Digital ID Card feature.

## Required Images

Please add the following image files to this directory:

### 1. company-logo.png
- Company/organization logo
- Recommended size: 80x80 pixels
- Format: PNG with transparent background
- Used in: ID card header

### 2. authorized-signature.png
- Authorized person's signature
- Recommended size: 120x40 pixels
- Format: PNG with transparent background
- Used in: ID card footer for authorization

### 3. official-stamp.png
- Official company stamp/seal
- Recommended size: 80x80 pixels
- Format: PNG with transparent background
- Used in: ID card footer for authenticity

## Usage

These assets are automatically loaded by the DigitalIdCard component:

```typescript
// Default asset paths
companyLogo = require('../assets/company-logo.png')
authorizedSignature = require('../assets/authorized-signature.png')
officialStamp = require('../assets/official-stamp.png')
```

## Customization

You can override these assets by passing custom paths to the DigitalIdCard component:

```typescript
<DigitalIdCard
  userProfile={userProfile}
  companyLogo={require('./custom-logo.png')}
  authorizedSignature={require('./custom-signature.png')}
  officialStamp={require('./custom-stamp.png')}
/>
```
