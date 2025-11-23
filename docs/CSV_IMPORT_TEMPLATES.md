# CSV Import Templates for CRM Location Data

This document describes the CSV format required for bulk importing location data into the CRM system.

## Table of Contents
1. [Countries Import](#countries-import)
2. [States Import](#states-import)
3. [Cities Import](#cities-import)
4. [Pincodes Import](#pincodes-import)
5. [Important Notes](#important-notes)

---

## Countries Import

**Endpoint:** `POST /api/countries/bulk-import`

**Required CSV Columns:**
- `name` - Country name (e.g., "India", "United States")
- `code` - 3-letter country code (e.g., "IND", "USA")
- `continent` - Continent name (must be one of the valid continents listed below)

**Valid Continents:**
- Africa
- Antarctica
- Asia
- Europe
- North America
- Oceania
- South America

**Example CSV:**
```csv
name,code,continent
India,IND,Asia
United States,USA,North America
United Kingdom,GBR,Europe
Australia,AUS,Oceania
Brazil,BRA,South America
```

**Behavior:**
- If a country with the same code or name exists, it will be **updated**
- If it doesn't exist, a new country will be **created**

---

## States Import

**Endpoint:** `POST /api/states/bulk-import`

**Required CSV Columns:**
- `name` - State name (e.g., "Maharashtra", "California")
- `code` - 2-3 letter state code (e.g., "MH", "CA")
- `country` - Country name (must match existing country or will be auto-created)

**Example CSV:**
```csv
name,code,country
Maharashtra,MH,India
Gujarat,GJ,India
California,CA,United States
Texas,TX,United States
```

**Behavior:**
- If the country doesn't exist, it will be **auto-created** with:
  - Code: First 3 letters of country name (uppercase)
  - Continent: "Asia" (default)
- If a state with the same code and country exists, it will be **updated**
- If it doesn't exist, a new state will be **created**

---

## Cities Import

**Endpoint:** `POST /api/cities/bulk-import`

**Required CSV Columns:**
- `name` - City name (e.g., "Mumbai", "New York")
- `state` - State name (must match existing state or will be auto-created)
- `country` - Country name (must match existing country or will be auto-created)

**Example CSV:**
```csv
name,state,country
Mumbai,Maharashtra,India
Pune,Maharashtra,India
Ahmedabad,Gujarat,India
New York,New York,United States
Los Angeles,California,United States
```

**Behavior:**
- If the country doesn't exist, it will be **auto-created** with:
  - Code: First 3 letters of country name (uppercase)
  - Continent: "Asia" (default)
- If the state doesn't exist, it will be **auto-created** with:
  - Code: First 3 letters of state name (uppercase)
- If a city with the same name and state exists, it will be **updated**
- If it doesn't exist, a new city will be **created**

---

## Pincodes Import

**Endpoint:** `POST /api/pincodes/bulk-import`

**Required CSV Columns:**
- `code` - Pincode/ZIP code (e.g., "400001", "10001")
- `area` - Area/locality name (e.g., "Andheri", "Manhattan")
- `cityName` - City name (must match existing city or will be auto-created)
- `state` - State name (must match existing state or will be auto-created)
- `country` - Country name (optional, defaults to "India")

**Example CSV:**
```csv
code,area,cityName,state,country
400029,A I Staff Colony S.O,Mumbai,MAHARASHTRA,India
400065,Aareymilk Colony S.O,Mumbai,MAHARASHTRA,India
400011,Agripada S.O,Mumbai,MAHARASHTRA,India
10001,Manhattan,New York,New York,United States
90001,Downtown,Los Angeles,California,United States
```

**Behavior:**
- If the country doesn't exist, it will be **auto-created** with:
  - Code: First 3 letters of country name (uppercase)
  - Continent: Determined by `getContinent()` helper function (supports India, China, Japan, USA, UK, Germany, France, Australia, Brazil, Canada, Mexico, South Africa, Egypt, Nigeria; defaults to "Asia")
- If the state doesn't exist, it will be **auto-created** with:
  - Code: First 3 letters of state name (uppercase)
- If the city doesn't exist, it will be **auto-created**
- If the area doesn't exist, it will be **auto-created**
- If a pincode with the same code exists:
  - The pincode will be **updated** with the new city
  - If the area is not already associated with this pincode, it will be **added** to the pincode's areas
- If the pincode doesn't exist, a new pincode will be **created** with the area associated

**Special Notes:**
- Pincodes can have **multiple areas** (many-to-many relationship via `pincodeAreas` table)
- Each area association has a `displayOrder` field (auto-incremented)
- Areas are created as standalone entities and can be reused across multiple pincodes

---

## Important Notes

### General Guidelines

1. **CSV Format:**
   - Use UTF-8 encoding
   - First row must contain column headers (case-sensitive)
   - Use commas (`,`) as delimiters
   - Enclose values containing commas in double quotes

2. **Case Sensitivity:**
   - Column names are **case-sensitive** (must match exactly)
   - Data values are **case-insensitive** for matching (e.g., "MAHARASHTRA" matches "Maharashtra")

3. **Required Fields:**
   - All required columns must be present in the CSV
   - Empty values in required fields will cause the row to fail

4. **Auto-Creation:**
   - States, Cities, and Pincodes imports will auto-create parent entities (countries, states, cities, areas) if they don't exist
   - Auto-created entities use default values (e.g., continent defaults to "Asia")

5. **Error Handling:**
   - The import process continues even if individual rows fail
   - Failed rows are reported in the response with error details
   - Successful rows are still imported

6. **Response Format:**
   ```json
   {
     "success": true,
     "message": "Bulk import completed: X created, Y updated, Z failed",
     "data": {
       "total": 100,
       "created": 80,
       "updated": 15,
       "failed": 5,
       "errors": [
         {
           "row": 10,
           "code": "400001",
           "error": "Missing required fields"
         }
       ]
     }
   }
   ```

### Database Schema Notes

**Tables without `isActive` column:**
- `countries` - Has: id, name, code, continent, createdAt, updatedAt
- `states` - Has: id, name, code, countryId, createdAt, updatedAt
- `cities` - Has: id, name, stateId, countryId, createdAt, updatedAt
- `areas` - Has: id, name, createdAt, updatedAt
- `pincodes` - Has: id, code, cityId, createdAt, updatedAt

**Junction Tables:**
- `pincodeAreas` - Links pincodes to areas (many-to-many)
  - Fields: pincodeId, areaId, displayOrder

### Best Practices

1. **Start with Countries:** Import countries first if you need specific continent values
2. **Then States:** Import states to ensure proper state codes
3. **Then Cities:** Import cities to link them to the correct states
4. **Finally Pincodes:** Import pincodes with all parent entities in place

5. **For Quick Import:** You can directly import pincodes - the system will auto-create all parent entities

6. **Data Validation:** Validate your CSV data before import to minimize errors

7. **Backup:** Always backup your database before performing bulk imports

---

## Example: Complete Pincode Import Workflow

**Step 1:** Prepare your CSV file (e.g., `pincodes.csv`)
```csv
code,area,cityName,state,country
400001,Fort,Mumbai,Maharashtra,India
400002,Andheri,Mumbai,Maharashtra,India
110001,Connaught Place,New Delhi,Delhi,India
```

**Step 2:** Upload via API
```bash
curl -X POST http://localhost:3000/api/pincodes/bulk-import \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@pincodes.csv"
```

**Step 3:** Check the response
```json
{
  "success": true,
  "message": "Bulk import completed: 3 created, 0 updated, 0 failed",
  "data": {
    "total": 3,
    "created": 3,
    "updated": 0,
    "failed": 0,
    "errors": []
  }
}
```

**Step 4:** Verify in database
- 1 country created: India
- 2 states created: Maharashtra, Delhi
- 2 cities created: Mumbai, New Delhi
- 3 areas created: Fort, Andheri, Connaught Place
- 3 pincodes created: 400001, 400002, 110001

---

## Troubleshooting

### Common Errors

1. **"Missing required fields"**
   - Check that all required columns are present in your CSV
   - Verify column names match exactly (case-sensitive)

2. **"column 'isActive' does not exist"**
   - This error should not occur after the latest fixes
   - If it does, restart the backend server to load the latest code

3. **"Invalid continent"**
   - For countries import, use one of the valid continent names
   - Check spelling and capitalization

4. **"No file uploaded"**
   - Ensure you're sending the file with the correct form field name: `file`
   - Use `multipart/form-data` content type

### Getting Help

If you encounter issues:
1. Check the backend logs for detailed error messages
2. Verify your CSV format matches the examples above
3. Test with a small sample CSV first (2-3 rows)
4. Check database constraints and foreign key relationships

