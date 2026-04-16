import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { baseBadgeStyle, formatBadgeLabel } from '@/lib/badgeStyles';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Calculator, Download, Calendar } from 'lucide-react';
import { UnifiedSearchInput } from '@/components/ui/unified-search-input';
import { useUnifiedSearch } from '@/hooks/useUnifiedSearch';
import { commissionManagementApi } from '../../services/commissionManagementApi';
import { CommissionCalculation } from '../../types/commission';
import { logger } from '@/utils/logger';

export const CommissionCalculationsTab: React.FC = () => {
  const [calculations, setCalculations] = useState<CommissionCalculation[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Unified search with 800ms debounce
  const { searchValue, debouncedSearchValue, setSearchValue, clearSearch, isDebouncing } =
    useUnifiedSearch({
      syncWithUrl: true,
    });

  const loadCalculations = useCallback(async () => {
    try {
      setLoading(true);
      const response = await commissionManagementApi.getCommissionCalculations({
        page: currentPage,
        limit: 20, // Standard pagination limit
        search: debouncedSearchValue || undefined,
      });

      setCalculations(response.data || []);
      setTotalPages(response.pagination?.totalPages || 1);
    } catch (error) {
      logger.error('Error loading calculations:', error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, debouncedSearchValue]);

  useEffect(() => {
    loadCalculations();
  }, [loadCalculations]);

  // Format date to "MMM YYYY" format
  const formatMonth = (dateString: string): string => {
    if (!dateString) {
      return 'N/A';
    }
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  // Calculate monthly summary
  const monthlySummary = useMemo(() => {
    const summary: { [key: string]: { total: number; count: number; currency: string } } = {};
    calculations.forEach((calc) => {
      const month = formatMonth(calc.createdAt);
      if (!summary[month]) {
        summary[month] = { total: 0, count: 0, currency: calc.currency };
      }
      summary[month].total += parseFloat(calc.commissionAmount || '0');
      summary[month].count += 1;
    });
    return summary;
  }, [calculations]);

  const exportCalculations = async () => {
    try {
      const blob = await commissionManagementApi.exportCommissionCalculations({});

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `commission-calculations-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      logger.error('Error exporting calculations:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Monthly Summary Cards */}
      {Object.keys(monthlySummary).length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.entries(monthlySummary)
            .slice(0, 3)
            .map(([month, data]) => (
              <Card key={month}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {month}
                      </p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">
                        {data.currency} {data.total.toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">{data.count} commissions</p>
                    </div>
                    <Calculator className="h-10 w-10 text-gray-600" />
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Commission Calculations ({calculations.length})
              </CardTitle>
              <CardDescription>Monthly commission payments for field users</CardDescription>
            </div>
            <Button onClick={exportCalculations}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          {/* Search Section */}
          <div className="mb-6">
            <UnifiedSearchInput
              value={searchValue}
              onChange={setSearchValue}
              onClear={clearSearch}
              isLoading={isDebouncing}
              placeholder="Search by field user, client, product, or task ID..."
            />
          </div>

          {/* Calculations Table */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task ID</TableHead>
                <TableHead>Field User</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Rate Type</TableHead>
                <TableHead className="text-right">Commission</TableHead>
                <TableHead>Month</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {calculations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-64 text-center">
                    <div className="flex flex-col items-center justify-center text-gray-600">
                      <Calculator className="h-12 w-12 mb-4" />
                      <p className="text-lg font-semibold">No commission calculations found</p>
                      <p className="text-sm mt-2">
                        Complete verification tasks to generate commissions
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                calculations.map((calculation) => (
                  <TableRow key={calculation.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium text-gray-900">
                          {calculation.taskNumber || 'N/A'}
                        </div>
                        {calculation.verificationTypeName && (
                          <div className="text-sm text-gray-600">
                            {calculation.verificationTypeName}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium text-gray-900">
                          {calculation.userName || 'N/A'}
                        </div>
                        <div className="text-sm text-gray-600">{calculation.userEmail || ''}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-gray-900">
                        {calculation.clientName || 'N/A'}
                      </div>
                    </TableCell>
                    <TableCell>{calculation.productName || 'N/A'}</TableCell>
                    <TableCell>
                      <Badge className={baseBadgeStyle}>
                        {formatBadgeLabel(calculation.rateTypeName || 'N/A')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div>
                        <div className="font-semibold">
                          {calculation.currency} {Number(calculation.commissionAmount).toFixed(2)}
                        </div>
                        {calculation.baseAmount && (
                          <div className="text-sm text-gray-600">
                            Base: {calculation.currency} {Number(calculation.baseAmount).toFixed(2)}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-gray-600" />
                        <span className="text-sm">{formatMonth(calculation.createdAt)}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t">
              <div className="text-sm text-gray-600">
                Showing <span className="font-medium text-gray-900">{calculations.length}</span>{' '}
                commissions
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">
                  Page {currentPage} of {totalPages}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
