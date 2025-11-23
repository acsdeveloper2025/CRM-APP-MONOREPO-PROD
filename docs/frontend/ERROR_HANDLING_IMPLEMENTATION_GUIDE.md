# Standardized Error Handling Implementation Guide

## Overview
This guide provides step-by-step instructions for implementing standardized error handling across the CRM frontend application.

---

## Quick Start

### For Mutations (Create, Update, Delete)

**Before (Old Pattern):**
```typescript
const deleteUserMutation = useMutation({
  mutationFn: (id: string) => usersService.deleteUser(id),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['users'] });
    toast.success('User deleted successfully');
  },
  onError: (error: any) => {
    toast.error(error.response?.data?.message || 'Failed to delete user');
  },
});
```

**After (New Pattern - Option 1: Most Convenient):**
```typescript
import { useCRUDMutation } from '@/hooks/useStandardizedMutation';

const deleteUserMutation = useCRUDMutation({
  mutationFn: (id: string) => usersService.deleteUser(id),
  queryKey: ['users'],
  resourceName: 'User',
  operation: 'delete',
  additionalInvalidateKeys: [['dashboard']], // Optional
});
```

**After (New Pattern - Option 2: More Control):**
```typescript
import { useMutationWithInvalidation } from '@/hooks/useStandardizedMutation';

const deleteUserMutation = useMutationWithInvalidation({
  mutationFn: (id: string) => usersService.deleteUser(id),
  invalidateKeys: [['users'], ['dashboard']],
  successMessage: 'User deleted successfully',
  errorContext: 'User Deletion',
  errorFallbackMessage: 'Failed to delete user',
  onSuccess: (data, variables) => {
    // Custom success logic
  },
});
```

---

### For Queries (Fetch Data)

**Before (Old Pattern - No Error Handling):**
```typescript
const { data, isLoading } = useQuery({
  queryKey: ['users'],
  queryFn: () => usersService.getUsers(),
});
```

**After (New Pattern):**
```typescript
import { useStandardizedQuery } from '@/hooks/useStandardizedQuery';

const { data, isLoading } = useStandardizedQuery({
  queryKey: ['users'],
  queryFn: () => usersService.getUsers(),
  errorContext: 'Loading Users',
  errorFallbackMessage: 'Failed to load users',
});
```

---

## Detailed Examples

### 1. CRUD Operations

#### Create Operation
```typescript
import { useCRUDMutation } from '@/hooks/useStandardizedMutation';

const createUserMutation = useCRUDMutation({
  mutationFn: (data: CreateUserData) => usersService.createUser(data),
  queryKey: ['users'],
  resourceName: 'User',
  operation: 'create',
  additionalInvalidateKeys: [['dashboard'], ['user-stats']],
  onSuccess: (data, variables) => {
    // Close dialog, reset form, etc.
    setOpen(false);
  },
});

// Usage
createUserMutation.mutate(formData);
```

#### Update Operation
```typescript
const updateUserMutation = useCRUDMutation({
  mutationFn: ({ id, data }: { id: string; data: UpdateUserData }) => 
    usersService.updateUser(id, data),
  queryKey: ['users'],
  resourceName: 'User',
  operation: 'update',
  onSuccess: () => {
    setEditDialogOpen(false);
  },
});

// Usage
updateUserMutation.mutate({ id: userId, data: formData });
```

#### Delete Operation
```typescript
const deleteUserMutation = useCRUDMutation({
  mutationFn: (id: string) => usersService.deleteUser(id),
  queryKey: ['users'],
  resourceName: 'User',
  operation: 'delete',
});

// Usage
deleteUserMutation.mutate(userId);
```

---

### 2. Complex Mutations with Custom Logic

```typescript
import { useStandardizedMutation } from '@/hooks/useStandardizedMutation';

const assignTaskMutation = useStandardizedMutation({
  mutationFn: (data: AssignTaskData) => tasksService.assignTask(data),
  successMessage: 'Task assigned successfully',
  errorContext: 'Task Assignment',
  errorFallbackMessage: 'Failed to assign task',
  onSuccess: (data, variables) => {
    // Custom success logic
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    queryClient.invalidateQueries({ queryKey: ['user-tasks', variables.userId] });
    setAssignDialogOpen(false);
  },
  onErrorCallback: (error) => {
    // Custom error handling after standardized error handling
    console.error('Assignment failed:', error);
  },
});
```

---

### 3. Queries with Error Handling

#### Basic Query
```typescript
import { useStandardizedQuery } from '@/hooks/useStandardizedQuery';

const { data: users, isLoading, error } = useStandardizedQuery({
  queryKey: ['users'],
  queryFn: () => usersService.getUsers(),
  errorContext: 'Loading Users',
  errorFallbackMessage: 'Failed to load users',
});
```

#### Query with Retry Logic
```typescript
import { useQueryWithRetry } from '@/hooks/useStandardizedQuery';

const { data, isLoading } = useQueryWithRetry({
  queryKey: ['critical-data'],
  queryFn: () => api.getCriticalData(),
  errorContext: 'Loading Critical Data',
  retryCount: 5,
  retryDelay: 2000,
});
```

#### Paginated Query
```typescript
import { usePaginatedQuery } from '@/hooks/useStandardizedQuery';

const { data, isLoading } = usePaginatedQuery({
  queryKey: ['users', page, limit],
  queryFn: () => usersService.getUsers({ page, limit }),
  errorContext: 'Loading Users',
  page,
  limit,
});
```

#### Dependent Query
```typescript
import { useDependentQuery } from '@/hooks/useStandardizedQuery';

const { data: user } = useQuery({ queryKey: ['user'], queryFn: getUser });

const { data: userDetails } = useDependentQuery({
  queryKey: ['user-details', user?.id],
  queryFn: () => getUserDetails(user!.id),
  dependsOn: user,
  errorContext: 'Loading User Details',
});
```

---

### 4. Handling Detailed Backend Errors

The standardized error handling automatically detects and displays detailed error information from the backend:

**Backend Response:**
```json
{
  "success": false,
  "message": "Cannot delete user: user has related records",
  "error": {
    "code": "USER_HAS_DEPENDENCIES",
    "details": "This user has 4 task assignment history record(s) that must be reassigned or removed before deletion.",
    "blockingRecords": ["4 task assignment history record(s)"],
    "cascadeWarnings": [],
    "relatedRecordCounts": { ... }
  }
}
```

**Frontend Display:**
- **Toast Title:** "Cannot delete user: user has related records"
- **Toast Description:** "This user has 4 task assignment history record(s) that must be reassigned or removed before deletion."
- **Duration:** 10 seconds (automatic for detailed errors)

**No Code Changes Required!** The standardized hooks automatically handle this.

---

## Migration Checklist

### For Each Component:

1. **Identify Mutations:**
   - [ ] Find all `useMutation` calls
   - [ ] Note the mutation function, success message, and error handling
   - [ ] Identify query keys that need invalidation

2. **Replace with Standardized Hook:**
   - [ ] Import appropriate hook (`useCRUDMutation`, `useMutationWithInvalidation`, or `useStandardizedMutation`)
   - [ ] Replace `useMutation` with standardized hook
   - [ ] Remove manual `toast.success()` and `toast.error()` calls
   - [ ] Remove manual `queryClient.invalidateQueries()` calls (if using `useMutationWithInvalidation` or `useCRUDMutation`)

3. **Identify Queries:**
   - [ ] Find all `useQuery` calls
   - [ ] Check if they have error handling
   - [ ] Note any special requirements (retry, pagination, dependencies)

4. **Replace with Standardized Hook:**
   - [ ] Import appropriate hook (`useStandardizedQuery`, `useQueryWithRetry`, `usePaginatedQuery`, or `useDependentQuery`)
   - [ ] Replace `useQuery` with standardized hook
   - [ ] Add `errorContext` and `errorFallbackMessage`

5. **Test:**
   - [ ] Test success scenarios
   - [ ] Test error scenarios (network errors, validation errors, server errors)
   - [ ] Verify toast notifications show correct messages
   - [ ] Verify detailed errors show descriptions
   - [ ] Verify query invalidation works correctly

---

## Common Patterns

### Pattern 1: Dialog with Create/Update Mutation
```typescript
function CreateUserDialog({ open, onOpenChange }: DialogProps) {
  const createUserMutation = useCRUDMutation({
    mutationFn: (data: CreateUserData) => usersService.createUser(data),
    queryKey: ['users'],
    resourceName: 'User',
    operation: 'create',
    onSuccess: () => {
      onOpenChange(false);
      form.reset();
    },
  });

  const handleSubmit = (data: CreateUserData) => {
    createUserMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Dialog content */}
      <Button 
        onClick={() => handleSubmit(formData)}
        disabled={createUserMutation.isPending}
      >
        {createUserMutation.isPending ? 'Creating...' : 'Create User'}
      </Button>
    </Dialog>
  );
}
```

### Pattern 2: Table with Delete Action
```typescript
function UsersTable() {
  const deleteUserMutation = useCRUDMutation({
    mutationFn: (id: string) => usersService.deleteUser(id),
    queryKey: ['users'],
    resourceName: 'User',
    operation: 'delete',
  });

  const handleDelete = (userId: string) => {
    deleteUserMutation.mutate(userId);
  };

  return (
    <Table>
      {/* Table content */}
      <Button onClick={() => handleDelete(user.id)}>Delete</Button>
    </Table>
  );
}
```

### Pattern 3: Page with Data Fetching
```typescript
function UsersPage() {
  const { data: users, isLoading } = useStandardizedQuery({
    queryKey: ['users'],
    queryFn: () => usersService.getUsers(),
    errorContext: 'Loading Users',
    errorFallbackMessage: 'Failed to load users',
  });

  if (isLoading) return <LoadingState />;

  return (
    <div>
      {/* Render users */}
    </div>
  );
}
```

---

## Benefits

✅ **Consistent Error Messages:** All errors follow the same format and styling  
✅ **Detailed Error Information:** Automatically shows backend error details  
✅ **Automatic Toast Duration:** 10 seconds for detailed errors, default for simple errors  
✅ **Reduced Boilerplate:** Less code to write and maintain  
✅ **Type Safety:** Full TypeScript support  
✅ **Error Logging:** Automatic error logging to monitoring services  
✅ **Better UX:** Users see actionable error messages  
✅ **Easier Testing:** Standardized patterns are easier to test  

---

## Next Steps

1. Start with **Priority 1: User Management Components**
2. Update one component at a time
3. Test thoroughly before moving to the next component
4. Follow the migration checklist for each component
5. Refer to this guide for examples and patterns

---

## Support

If you encounter any issues or have questions:
1. Check the examples in this guide
2. Review the reference implementation in `UsersTable.tsx`
3. Check the hook documentation in the source files
4. Consult the audit report in `ERROR_HANDLING_AUDIT.md`

