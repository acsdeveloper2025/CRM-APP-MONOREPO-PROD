import React from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { UserActivitiesTable } from '@/components/users/UserActivitiesTable';
import { UnifiedSearchFilterLayout, FilterGrid } from '@/ui/components/UnifiedSearchFilterLayout';
import { Label } from '@/ui/components/Label';
import { Button } from '@/ui/components/Button';
import { Calendar } from '@/ui/components/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/components/popover';
import { cn } from '@/lib/utils';

interface UsersActivitiesTabPanelProps {
  actSearch: {
    searchValue: string;
    setSearchValue: (value: string) => void;
    clearSearch: () => void;
    isDebouncing: boolean;
  };
  actFilters: {
    filters: { fromDate?: string; toDate?: string };
    setFilter: (key: 'fromDate' | 'toDate', value: string | undefined) => void;
    clearFilters: () => void;
    hasActiveFilters: boolean;
  };
  activitiesData: {
    data?: unknown[];
    pagination?: { total: number; totalPages: number };
  } | undefined;
  activitiesLoading: boolean;
  actPage: number;
  setActPage: React.Dispatch<React.SetStateAction<number>>;
}

export const UsersActivitiesTabPanel = React.memo(function UsersActivitiesTabPanel({
  actSearch,
  actFilters,
  activitiesData,
  activitiesLoading,
  actPage,
  setActPage,
}: UsersActivitiesTabPanelProps) {
  return (
    <div {...{ className: "space-y-4" }}>
      <UnifiedSearchFilterLayout
        searchValue={actSearch.searchValue}
        onSearchChange={actSearch.setSearchValue}
        onSearchClear={actSearch.clearSearch}
        isSearchLoading={actSearch.isDebouncing}
        searchPlaceholder="Search activities by action or details..."
        hasActiveFilters={actFilters.hasActiveFilters}
        onClearFilters={actFilters.clearFilters}
        filterContent={
          <FilterGrid columns={2}>
            <div {...{ className: "space-y-2" }}>
              <Label>From Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    {...{
                      className: cn(
                        'w-full justify-start text-left font-normal',
                        !actFilters.filters.fromDate && 'text-muted-foreground'
                      ),
                    }}
                  >
                    <CalendarIcon {...{ className: "mr-2 h-4 w-4" }} />
                    {actFilters.filters.fromDate ? format(new Date(actFilters.filters.fromDate), 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent {...{ className: "w-auto p-0" }}>
                  <Calendar
                    mode="single"
                    selected={actFilters.filters.fromDate ? new Date(actFilters.filters.fromDate) : undefined}
                    onSelect={(date) => actFilters.setFilter('fromDate', date ? date.toISOString() : undefined)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div {...{ className: "space-y-2" }}>
              <Label>To Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    {...{
                      className: cn(
                        'w-full justify-start text-left font-normal',
                        !actFilters.filters.toDate && 'text-muted-foreground'
                      ),
                    }}
                  >
                    <CalendarIcon {...{ className: "mr-2 h-4 w-4" }} />
                    {actFilters.filters.toDate ? format(new Date(actFilters.filters.toDate), 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent {...{ className: "w-auto p-0" }}>
                  <Calendar
                    mode="single"
                    selected={actFilters.filters.toDate ? new Date(actFilters.filters.toDate) : undefined}
                    onSelect={(date) => actFilters.setFilter('toDate', date ? date.toISOString() : undefined)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </FilterGrid>
        }
      />

      <UserActivitiesTable
        data={Array.isArray(activitiesData?.data) ? activitiesData.data as never[] : []}
        isLoading={activitiesLoading}
      />

      {activitiesData?.pagination ? (
        <div {...{ className: "flex flex-col sm:flex-row items-center justify-between gap-4 pt-4" }}>
          <div {...{ className: "text-sm text-gray-600" }}>
            Showing {activitiesData.data?.length || 0} of {activitiesData.pagination.total} activities
          </div>
          <div {...{ className: "flex items-center gap-2" }}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActPage((prev) => Math.max(1, prev - 1))}
              disabled={actPage === 1}
            >
              Previous
            </Button>
            <div {...{ className: "text-sm" }}>
              Page {actPage} of {activitiesData.pagination.totalPages || 1}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActPage((prev) => prev + 1)}
              disabled={actPage >= (activitiesData.pagination.totalPages || 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
});
