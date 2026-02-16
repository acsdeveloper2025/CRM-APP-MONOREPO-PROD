# CRM Frontend

## HTTP Client Policy

**All network requests must go through `src/services/api.ts`.**

Direct usage of `fetch`, `axios.create`, or `new Axios` is prohibited in components and other services.
This ensures:

- Consistent authentication (token refresh)
- Centralized error handling
- Caching and metrics
- Unified retry logic

### Enforcement

- **`axios.create` / `new Axios`**: **Error**. The build will fail if you create new Axios instances.
- **`fetch`**: **Warning**. You will see lint warnings. Please refactor existing usages to `apiService`.
