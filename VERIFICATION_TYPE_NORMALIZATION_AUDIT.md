# Verification Type Normalization Audit

## Overview
This document tracks all locations where verification type normalization is required to handle the mismatch between:
- **Database storage**: Full names like "Business Verification", "Residence Verification"
- **Code usage**: Short codes like "BUSINESS", "RESIDENCE"

## Normalization Function

The `normalizeVerificationType()` function converts full verification type names to short codes:

```typescript
function normalizeVerificationType(verificationType: string): string {
  const typeUpper = verificationType.toUpperCase();

  // Check for combined types first
  if (typeUpper.includes('RESIDENCE') && typeUpper.includes('OFFICE')) {
    return 'RESIDENCE_CUM_OFFICE';
  }

  // Check for individual types
  if (typeUpper.includes('RESIDENCE')) return 'RESIDENCE';
  if (typeUpper.includes('OFFICE')) return 'OFFICE';
  if (typeUpper.includes('BUSINESS')) return 'BUSINESS';
  if (typeUpper.includes('BUILDER')) return 'BUILDER';
  if (typeUpper.includes('NOC')) return 'NOC';
  if (typeUpper.includes('DSA') || typeUpper.includes('CONNECTOR')) return 'DSA_CONNECTOR';
  if (typeUpper.includes('PROPERTY') && typeUpper.includes('APF')) return 'PROPERTY_APF';
  if (typeUpper.includes('PROPERTY') && typeUpper.includes('INDIVIDUAL')) return 'PROPERTY_INDIVIDUAL';

  // Default fallback
  return 'RESIDENCE';
}
```

## Locations Where Normalization is Applied

### ✅ 1. Mobile Form Controller (`CRM-BACKEND/src/controllers/mobileFormController.ts`)

**Status**: FIXED ✅

**Locations**:
- Line 384: `createComprehensiveFormSectionsFromReport()` - Normalizes before calling `createComprehensiveFormSections()`
- Line 264: `organizeFormDataIntoSections()` - Normalizes before calling `createComprehensiveFormSections()`
- Line 403-422: `normalizeVerificationType()` helper function defined

**Purpose**: Ensures form sections are created correctly when displaying form submissions

### ✅ 2. Template Reports Controller (`CRM-BACKEND/src/controllers/templateReportsController.ts`)

**Status**: FIXED ✅

**Locations**:
- Line 16-36: `normalizeVerificationType()` helper function defined
- Line 564: Normalizes verification type before passing to template service

**Purpose**: Ensures template report generation finds the correct template for the verification type

### ✅ 3. Template Report Service (`CRM-BACKEND/src/services/TemplateReportService.ts`)

**Status**: USES EXACT MATCHING (Relies on controller normalization) ✅

**Locations**:
- Line 1378-1412: `getTemplate()` method uses exact matching (`verificationType.toUpperCase() === 'RESIDENCE'`)

**Note**: This is OK because the controller now normalizes the type before calling the service

## Locations Using `.includes()` Matching (Already Flexible)

### ✅ 4. Mobile Form Controller - Report Table Selection

**Status**: ALREADY FLEXIBLE ✅

**Location**: `CRM-BACKEND/src/controllers/mobileFormController.ts` lines 1739-1766

**Code Pattern**:
```typescript
const typeUpper = verificationType.toUpperCase();

if (typeUpper.includes('RESIDENCE') && typeUpper.includes('OFFICE')) {
  reportTableName = 'residenceCumOfficeVerificationReports';
} else if (typeUpper.includes('RESIDENCE')) {
  reportTableName = 'residenceVerificationReports';
} else if (typeUpper.includes('BUSINESS')) {
  reportTableName = 'businessVerificationReports';
}
```

**Purpose**: Selects the correct database table for storing verification reports

### ✅ 5. Template Reports Controller - Report Data Retrieval

**Status**: ALREADY FLEXIBLE ✅

**Location**: `CRM-BACKEND/src/controllers/templateReportsController.ts` lines 72-534

**Code Pattern**:
```typescript
const typeUpper = verificationType.toUpperCase();

if (typeUpper.includes('RESIDENCE') && !typeUpper.includes('OFFICE')) {
  // Query residenceVerificationReports
} else if (typeUpper.includes('OFFICE') && !typeUpper.includes('RESIDENCE')) {
  // Query officeVerificationReports
} else if (typeUpper.includes('BUSINESS')) {
  // Query businessVerificationReports
}
```

**Purpose**: Retrieves verification report data from the correct table

## Database Schema Fixes

### ✅ 6. Business Verification Reports - Missing Landmark Columns

**Status**: FIXED ✅

**Migration**: `012_add_landmark_columns_to_business_reports.sql`

**Issue**: The `businessVerificationReports` table was missing `landmark3` and `landmark4` columns required for UNTRACEABLE form types

**Fix**: Added columns:
```sql
ALTER TABLE "businessVerificationReports" 
ADD COLUMN IF NOT EXISTS landmark3 VARCHAR(255),
ADD COLUMN IF NOT EXISTS landmark4 VARCHAR(255);
```

**Verification**:
- ✅ `residenceVerificationReports` has landmark1, landmark2, landmark3, landmark4
- ✅ `officeVerificationReports` has landmark1, landmark2, landmark3, landmark4
- ✅ `businessVerificationReports` has landmark1, landmark2, landmark3, landmark4 (FIXED)
- ✅ `builderVerificationReports` has landmark1, landmark2, landmark3, landmark4
- ✅ `residenceCumOfficeVerificationReports` has landmark1, landmark2, landmark3, landmark4
- ✅ `dsaConnectorVerificationReports` has landmark1, landmark2, landmark3, landmark4
- ✅ `propertyApfVerificationReports` has landmark1, landmark2, landmark3, landmark4
- ✅ `propertyIndividualVerificationReports` has landmark1, landmark2, landmark3, landmark4
- ✅ `nocVerificationReports` has landmark1, landmark2, landmark3, landmark4

## Form Type Specific Fields

Each verification type supports multiple form types with different field requirements:

### Form Types (Common across all verification types):
1. **POSITIVE** - Successful verification with all details
2. **POSITIVE_DOOR_LOCKED** - Successful but premises locked
3. **SHIFTED** - Subject has moved to different location
4. **SHIFTED_DOOR_LOCKED** - Shifted and premises locked
5. **NSP** - Not as per specification
6. **ERT** - Entry Restricted
7. **UNTRACEABLE** - Cannot locate the address

### UNTRACEABLE Form Fields:
- Requires: `landmark1`, `landmark2`, `landmark3`, `landmark4` (4 landmarks for better location description)
- Requires: `callRemark`, `contactPerson`, `locality`, `dominatedArea`, `otherObservation`, `finalStatus`
- Does NOT require: Most verification-specific fields (since premises couldn't be accessed)

## Summary

### Issues Fixed:
1. ✅ Form sections not displaying - Fixed by normalizing verification type in `mobileFormController.ts`
2. ✅ Template report generation failing - Fixed by normalizing verification type in `templateReportsController.ts`
3. ✅ Missing landmark columns - Fixed by adding `landmark3` and `landmark4` to `businessVerificationReports` table

### Current Status:
- All verification type matching is now consistent
- All database tables have the required columns for all form types
- Form data is properly displayed in the frontend
- Template reports can be generated successfully

### No Further Action Needed:
- The `.includes()` matching pattern used in report table selection is already flexible enough
- The template service relies on normalized input from the controller
- All 9 verification report tables now have complete landmark columns

