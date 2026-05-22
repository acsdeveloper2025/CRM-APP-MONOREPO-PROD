import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UnifiedSearchFilterLayout } from '@/components/ui/unified-search-filter-layout';
import { UserSessionsTable } from '@/components/users/UserSessionsTable';
import { useUnifiedSearch } from '@/hooks/useUnifiedSearch';
import { useUserSessions } from '@/hooks/useUserSessions';
import { usePermissionContext } from '@/contexts/PermissionContext';

export function UserSessionsPage() {
  const { hasPermissionCode } = usePermissionContext();
  const canManageRbac = hasPermissionCode('permission.manage') || hasPermissionCode('role.manage');

  const [page, setPage] = useState(1);
  const search = useUnifiedSearch({ syncWithUrl: true, urlParamName: 'sessSearch' });

  useEffect(() => {
    setPage(1);
  }, [search.debouncedSearchValue]);

  const { data, isLoading } = useUserSessions(
    {
      userId: undefined,
      search: search.debouncedSearchValue || undefined,
      page,
      limit: 20,
    },
    { enabled: canManageRbac }
  );

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">User Sessions</h1>
          <p className="text-muted-foreground">Active sessions across all devices</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Sessions</CardTitle>
          <CardDescription>Search by user or IP to find a specific session</CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 space-y-4">
          <UnifiedSearchFilterLayout
            searchValue={search.searchValue}
            onSearchChange={search.setSearchValue}
            onSearchClear={search.clearSearch}
            isSearchLoading={search.isDebouncing}
            searchPlaceholder="Filter sessions by user or IP..."
            showFilters={false}
          />

          <UserSessionsTable
            data={Array.isArray(data?.data) ? data.data : []}
            isLoading={isLoading}
          />
        </CardContent>
      </Card>
    </div>
  );
}
