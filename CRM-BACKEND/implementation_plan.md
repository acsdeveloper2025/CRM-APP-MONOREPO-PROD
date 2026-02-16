# Fix API 500 Error: Cases Search by Address

The `/api/cases` endpoint is failing with a 500 Internal Server Error when a search term is provided. The backend logs indicate that `column c.address does not exist`.

## Bug Origin

The `cases` table does not contain an `address` column; addresses are stored at the `verification_tasks` level. However, the `getCases` controller in `crm-backend/src/controllers/casesController.ts` attempts to search against `c.address` directly.

## Proposed Changes

### [Component] CRM Backend - Controllers

#### [MODIFY] [casesController.ts](file:///Users/mayurkulkarni/Downloads/CRM-APP-MONOREPO-PROD/crm-backend/src/controllers/casesController.ts)

- Update the search filter logic to search across all addresses associated with a case's tasks.
- Modify the `SELECT` query to include a representative address for each case to satisfy frontend display requirements.

```typescript
// Proposed search filter update
if (search) {
  conditions.push(`(
    COALESCE(c."customerName", '') ILIKE $${paramIndex} OR
    COALESCE(c."caseId"::text, '') ILIKE $${paramIndex} OR
    EXISTS (
      SELECT 1 FROM verification_tasks vt 
      WHERE vt.case_id = c.id AND vt.address ILIKE $${paramIndex}
    ) OR
    COALESCE(c."customerPhone", '') ILIKE $${paramIndex} OR
    COALESCE(c.trigger, '') ILIKE $${paramIndex} OR
    COALESCE(c."applicantType", '') ILIKE $${paramIndex}
  )`);
  // ...
}
```

- Update the `casesQuery` to include `address`:

```sql
SELECT
  c.*,
  (SELECT address FROM verification_tasks WHERE case_id = c.id LIMIT 1) as address,
  -- ... remaining fields
```

## Verification Plan

### Automated Verification

- Observe the backend logs while making a request with `search=new` to ensure no 500 errors occur and results are returned correctly.
- Use `curl` to verify the response structure:

```bash
curl "http://localhost:3000/api/cases?page=1&limit=20&sortBy=caseId&sortOrder=desc&search=new" -H "Authorization: Bearer <token>"
```

### Manual Verification

- Verify in the frontend that searching for a case by address (or part of it) returns the expected results.
