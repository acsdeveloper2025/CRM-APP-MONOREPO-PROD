import React from 'react';
import { UserSessionsTable } from '@/components/users/UserSessionsTable';
import { UnifiedSearchFilterLayout } from '@/ui/components/UnifiedSearchFilterLayout';

interface UsersSessionsTabPanelProps {
  sessSearch: {
    searchValue: string;
    setSearchValue: (value: string) => void;
    clearSearch: () => void;
    isDebouncing: boolean;
  };
  sessionsData: { data?: unknown[] } | undefined;
  sessionsLoading: boolean;
}

export const UsersSessionsTabPanel = React.memo(function UsersSessionsTabPanel({
  sessSearch,
  sessionsData,
  sessionsLoading,
}: UsersSessionsTabPanelProps) {
  return (
    <div {...{ className: "space-y-4" }}>
      <UnifiedSearchFilterLayout
        searchValue={sessSearch.searchValue}
        onSearchChange={sessSearch.setSearchValue}
        onSearchClear={sessSearch.clearSearch}
        isSearchLoading={sessSearch.isDebouncing}
        searchPlaceholder="Filter sessions by user or IP..."
        showFilters={false}
      />

      <UserSessionsTable
        data={Array.isArray(sessionsData?.data) ? sessionsData.data as never[] : []}
        isLoading={sessionsLoading}
      />
    </div>
  );
});
