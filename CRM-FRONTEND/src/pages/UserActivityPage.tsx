import { useEffect, useState } from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  UnifiedSearchFilterLayout,
  FilterGrid,
} from '@/components/ui/unified-search-filter-layout';
import { UserActivitiesTable } from '@/components/users/UserActivitiesTable';
import { useUnifiedSearch, useUnifiedFilters } from '@/hooks/useUnifiedSearch';
import { useUserActivities } from '@/hooks/useUserActivities';
import { usePermissionContext } from '@/contexts/PermissionContext';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export function UserActivityPage() {
  const { hasPermissionCode } = usePermissionContext();
  const canManageRbac = hasPermissionCode('permission.manage') || hasPermissionCode('role.manage');

  const [page, setPage] = useState(1);
  const search = useUnifiedSearch({ syncWithUrl: true, urlParamName: 'actSearch' });
  const filters = useUnifiedFilters<{ fromDate?: string; toDate?: string; userId?: string }>({
    syncWithUrl: true,
    urlParamPrefix: 'act',
  });

  useEffect(() => {
    setPage(1);
  }, [search.debouncedSearchValue, filters.filters]);

  const { data, isLoading } = useUserActivities(
    {
      page,
      limit: 20,
      search: search.debouncedSearchValue || undefined,
      fromDate: filters.filters.fromDate,
      toDate: filters.filters.toDate,
      userId: filters.filters.userId,
    },
    { enabled: canManageRbac }
  );

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">User Activity</h1>
          <p className="text-muted-foreground">Audit trail of user actions across the system</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Activity Log</CardTitle>
          <CardDescription>Filter activities by date range or search keyword</CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 space-y-4">
          <UnifiedSearchFilterLayout
            searchValue={search.searchValue}
            onSearchChange={search.setSearchValue}
            onSearchClear={search.clearSearch}
            isSearchLoading={search.isDebouncing}
            searchPlaceholder="Search activities by action or details..."
            hasActiveFilters={filters.hasActiveFilters}
            onClearFilters={filters.clearFilters}
            filterContent={
              <FilterGrid columns={2}>
                <div className="space-y-2">
                  <Label>Date From</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !filters.filters.fromDate && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {filters.filters.fromDate
                          ? format(new Date(filters.filters.fromDate), 'PPP')
                          : 'Pick a date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={
                          filters.filters.fromDate ? new Date(filters.filters.fromDate) : undefined
                        }
                        onSelect={(date) =>
                          filters.setFilter('fromDate', date ? date.toISOString() : undefined)
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>Date To</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !filters.filters.toDate && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {filters.filters.toDate
                          ? format(new Date(filters.filters.toDate), 'PPP')
                          : 'Pick a date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={
                          filters.filters.toDate ? new Date(filters.filters.toDate) : undefined
                        }
                        onSelect={(date) =>
                          filters.setFilter('toDate', date ? date.toISOString() : undefined)
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </FilterGrid>
            }
          />

          <UserActivitiesTable
            data={Array.isArray(data?.data) ? data.data : []}
            isLoading={isLoading}
          />

          {data?.pagination && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
              <div className="text-sm text-muted-foreground">
                Showing {data.data?.length || 0} of {data.pagination.total} activities
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <div className="text-sm">
                  Page {page} of {data.pagination.totalPages || 1}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((prev) => prev + 1)}
                  disabled={page >= (data.pagination.totalPages || 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
