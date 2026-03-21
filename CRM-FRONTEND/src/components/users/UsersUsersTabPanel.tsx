import React from 'react';
import type { Role } from '@/types/auth';
import { USER_ROLE_OPTIONS } from '@/types/constants';
import { Download, Plus, Upload } from 'lucide-react';
import { Button } from '@/ui/components/button';
import { UsersTable } from '@/components/users/UsersTable';
import { UnifiedSearchFilterLayout, FilterGrid } from '@/ui/components/unified-search-filter-layout';
import { Label } from '@/ui/components/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/components/select';

interface UsersUsersTabPanelProps {
  userSearch: {
    searchValue: string;
    setSearchValue: (value: string) => void;
    clearSearch: () => void;
    isDebouncing: boolean;
  };
  userFilters: {
    filters: { role?: Role; status?: string };
    setFilter: (key: 'role' | 'status', value: Role | string | undefined) => void;
    clearFilters: () => void;
    hasActiveFilters: boolean;
  };
  usersData: {
    data?: unknown[];
    pagination?: { total: number; totalPages: number };
  } | undefined;
  usersLoading: boolean;
  userPage: number;
  setUserPage: React.Dispatch<React.SetStateAction<number>>;
  onBulkImport: () => void;
  onExport: () => void;
  onAddUser: () => void;
}

export const UsersUsersTabPanel = React.memo(function UsersUsersTabPanel({
  userSearch,
  userFilters,
  usersData,
  usersLoading,
  userPage,
  setUserPage,
  onBulkImport,
  onExport,
  onAddUser,
}: UsersUsersTabPanelProps) {
  return (
    <div {...{ className: "space-y-4" }}>
      <UnifiedSearchFilterLayout
        searchValue={userSearch.searchValue}
        onSearchChange={userSearch.setSearchValue}
        onSearchClear={userSearch.clearSearch}
        isSearchLoading={userSearch.isDebouncing}
        searchPlaceholder="Search users by name, email, or phone..."
        hasActiveFilters={userFilters.hasActiveFilters}
        activeFilterCount={Object.keys(userFilters.filters).length}
        onClearFilters={userFilters.clearFilters}
        actions={
          <div {...{ className: "flex items-center gap-2" }}>
            <Button variant="outline" size="sm" onClick={onBulkImport}>
              <Upload {...{ className: "h-4 w-4 mr-2" }} />
              Import
            </Button>
            <Button variant="outline" size="sm" onClick={onExport}>
              <Download {...{ className: "h-4 w-4 mr-2" }} />
              Export
            </Button>
            <Button size="sm" onClick={onAddUser}>
              <Plus {...{ className: "h-4 w-4 mr-2" }} />
              Add User
            </Button>
          </div>
        }
        filterContent={
          <FilterGrid columns={2}>
            <div {...{ className: "space-y-2" }}>
              <Label>Role</Label>
              <Select
                value={userFilters.filters.role || 'all'}
                onValueChange={(value) => userFilters.setFilter('role', value === 'all' ? undefined : (value as Role))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {USER_ROLE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div {...{ className: "space-y-2" }}>
              <Label>Status</Label>
              <Select
                value={userFilters.filters.status || 'all'}
                onValueChange={(value) => userFilters.setFilter('status', value === 'all' ? undefined : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </FilterGrid>
        }
      />

      <UsersTable data={Array.isArray(usersData?.data) ? usersData.data as never[] : []} isLoading={usersLoading} />

      {usersData?.pagination ? (
        <div {...{ className: "flex flex-col sm:flex-row items-center justify-between gap-4 pt-4" }}>
          <div {...{ className: "text-sm text-gray-600" }}>
            Showing {usersData.data?.length || 0} of {usersData.pagination.total} users
          </div>
          <div {...{ className: "flex items-center gap-2" }}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setUserPage((prev) => Math.max(1, prev - 1))}
              disabled={userPage === 1}
            >
              Previous
            </Button>
            <div {...{ className: "text-sm" }}>
              Page {userPage} of {usersData.pagination.totalPages || 1}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setUserPage((prev) => prev + 1)}
              disabled={userPage >= (usersData.pagination.totalPages || 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
});
