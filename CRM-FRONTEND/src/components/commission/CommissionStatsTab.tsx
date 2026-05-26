import React, { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Download, TrendingUp, Users } from 'lucide-react';
import { commissionManagementApi } from '@/services/commissionManagementApi';
import { CommissionPivotTable } from './CommissionPivotTable';
import type { CommissionPivotDimKey, CommissionPivotPeriod } from '@/types/commission';
import { logger } from '@/utils/logger';

const PERIOD_OPTIONS: { value: CommissionPivotPeriod; label: string }[] = [
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'quarter', label: 'This Quarter' },
  { value: 'year', label: 'This Year' },
  { value: 'all', label: 'All Time' },
  { value: 'custom', label: 'Custom Range' },
];

const DIM_OPTIONS: { value: CommissionPivotDimKey; label: string }[] = [
  { value: 'user', label: 'Field Executive' },
  { value: 'client', label: 'Client' },
  { value: 'product', label: 'Product' },
  { value: 'rateType', label: 'Rate Type' },
];

const DEFAULT_ROWS: CommissionPivotDimKey = 'user';
const DEFAULT_SUBROWS: CommissionPivotDimKey | 'none' = 'rateType';
const DEFAULT_COLS: CommissionPivotDimKey = 'client';

const isDimKey = (v: string | null): v is CommissionPivotDimKey =>
  v === 'user' || v === 'client' || v === 'product' || v === 'rateType';

const fmtAmount = (n: number) =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n);

export const CommissionStatsTab: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const period = (searchParams.get('period') as CommissionPivotPeriod) || 'month';
  const dateFrom = searchParams.get('dateFrom') || '';
  const dateTo = searchParams.get('dateTo') || '';
  const rawRows = searchParams.get('rows');
  const rawSubRows = searchParams.get('subRows');
  const rawCols = searchParams.get('cols');
  const pivotRows: CommissionPivotDimKey = isDimKey(rawRows) ? rawRows : DEFAULT_ROWS;
  const pivotCols: CommissionPivotDimKey = isDimKey(rawCols) ? rawCols : DEFAULT_COLS;
  const pivotSubRows: CommissionPivotDimKey | 'none' =
    rawSubRows === 'none' ? 'none' : isDimKey(rawSubRows) ? rawSubRows : DEFAULT_SUBROWS;

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    if (key === 'period' && value !== 'custom') {
      next.delete('dateFrom');
      next.delete('dateTo');
    }
    setSearchParams(next);
  };

  const pivotParams = useMemo(
    () => ({
      period,
      ...(period === 'custom' && dateFrom ? { dateFrom } : {}),
      ...(period === 'custom' && dateTo ? { dateTo } : {}),
      rows: pivotRows,
      subRows: pivotSubRows,
      cols: pivotCols,
    }),
    [period, dateFrom, dateTo, pivotRows, pivotSubRows, pivotCols]
  );

  const statsQuery = useQuery({
    queryKey: ['commission-stats'],
    queryFn: () => commissionManagementApi.getCommissionStats(),
  });

  const pivotQuery = useQuery({
    queryKey: ['commission-pivot', pivotParams],
    queryFn: () => commissionManagementApi.getCommissionPivot(pivotParams),
  });

  const stats = statsQuery.data?.data;
  const pivot = pivotQuery.data?.data;

  const handleExport = async () => {
    try {
      const blob = await commissionManagementApi.exportCommissionPivot(pivotParams);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `commission_pivot_${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Pivot exported');
    } catch (error) {
      logger.error('Failed to export commission pivot', error);
      toast.error('Export failed');
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <Label htmlFor="commission-period">Period</Label>
              <Select value={period} onValueChange={(v) => updateParam('period', v)}>
                <SelectTrigger id="commission-period">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIOD_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {period === 'custom' && (
              <>
                <div className="space-y-1">
                  <Label htmlFor="commission-date-from">Date From</Label>
                  <Input
                    id="commission-date-from"
                    type="date"
                    value={dateFrom}
                    onChange={(e) => updateParam('dateFrom', e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="commission-date-to">Date To</Label>
                  <Input
                    id="commission-date-to"
                    type="date"
                    value={dateTo}
                    onChange={(e) => updateParam('dateTo', e.target.value)}
                  />
                </div>
              </>
            )}

            <div className="space-y-1 sm:col-start-4 sm:row-start-1 flex items-end justify-end">
              <Button
                variant="default"
                onClick={handleExport}
                disabled={!pivot || pivotQuery.isLoading}
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stat tiles */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsQuery.isLoading ? '—' : (stats?.activeFieldUsers ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Field execs with an active commission assignment
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Per Task</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹{statsQuery.isLoading ? '—' : fmtAmount(stats?.averageCommissionPerCase ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Average commission across all calculations
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Performance Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Performance Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Top Earner</span>
              <span className="font-medium text-right">
                {stats?.topPerformingUser
                  ? `${stats.topPerformingUser} (₹${fmtAmount(stats.topPerformerAmount ?? 0)})`
                  : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Most Used Rate Type</span>
              <span className="font-medium">{stats?.mostUsedRateType ?? 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Assignments</span>
              <span className="font-medium">{stats?.totalAssignments ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Commission Rate Types</span>
              <span className="font-medium">{stats?.totalRateTypes ?? 0}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pivot Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Commission Pivot:{' '}
            {pivot
              ? `${pivot.dims.rows.label}${pivot.dims.subRows ? ` × ${pivot.dims.subRows.label}` : ''} × ${pivot.dims.cols.label}`
              : 'Field Executive × Rate Type × Client'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="pivot-rows">Rows</Label>
              <Select value={pivotRows} onValueChange={(v) => updateParam('rows', v)}>
                <SelectTrigger id="pivot-rows">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIM_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="pivot-subrows">Sub-rows</Label>
              <Select value={pivotSubRows} onValueChange={(v) => updateParam('subRows', v)}>
                <SelectTrigger id="pivot-subrows">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (flat)</SelectItem>
                  {DIM_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="pivot-cols">Columns</Label>
              <Select value={pivotCols} onValueChange={(v) => updateParam('cols', v)}>
                <SelectTrigger id="pivot-cols">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIM_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {pivotQuery.isLoading ? (
            <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
              Loading pivot…
            </div>
          ) : pivotQuery.isError || !pivot ? (
            <div className="flex items-center justify-center h-32 text-sm text-destructive">
              Failed to load pivot.
            </div>
          ) : (
            <CommissionPivotTable data={pivot} />
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CommissionStatsTab;
