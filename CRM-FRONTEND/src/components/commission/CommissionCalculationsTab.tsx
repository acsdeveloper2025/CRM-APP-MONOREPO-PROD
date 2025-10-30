import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calculator, Search, Download, Eye, CheckCircle, XCircle, Calendar, Filter } from 'lucide-react';
import { commissionManagementApi } from '../../services/commissionManagementApi';
import { CommissionCalculation } from '../../types/commission';

export const CommissionCalculationsTab: React.FC = () => {
  const [calculations, setCalculations] = useState<CommissionCalculation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: ''
  });

  useEffect(() => {
    loadCalculations();
  }, [currentPage, searchTerm, filterStatus, dateRange]);

  const loadCalculations = async () => {
    try {
      setLoading(true);
      const response = await commissionManagementApi.getCommissionCalculations({
        page: currentPage,
        limit: 50, // Increased for better monthly view
        search: searchTerm,
        status: filterStatus || undefined,
        startDate: dateRange.startDate || undefined,
        endDate: dateRange.endDate || undefined
      });

      setCalculations(response.data);
      setTotalPages(response.pagination?.totalPages || 1);
    } catch (error) {
      console.error('Error loading calculations:', error);
    } finally {
      setLoading(false);
    }
  };

  // Format date to "MMM YYYY" format
  const formatMonth = (dateString: string): string => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  // Get unique months from calculations for filter
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    calculations.forEach(calc => {
      if (calc.created_at) {
        months.add(formatMonth(calc.created_at));
      }
    });
    return Array.from(months).sort((a, b) => {
      const dateA = new Date(a);
      const dateB = new Date(b);
      return dateB.getTime() - dateA.getTime();
    });
  }, [calculations]);

  // Filter calculations by selected month
  const filteredCalculations = useMemo(() => {
    if (!filterMonth) return calculations;
    return calculations.filter(calc => formatMonth(calc.created_at) === filterMonth);
  }, [calculations, filterMonth]);

  // Calculate monthly summary
  const monthlySummary = useMemo(() => {
    const summary: { [key: string]: { total: number; count: number; currency: string } } = {};
    filteredCalculations.forEach(calc => {
      const month = formatMonth(calc.created_at);
      if (!summary[month]) {
        summary[month] = { total: 0, count: 0, currency: calc.currency };
      }
      summary[month].total += parseFloat(calc.commission_amount || '0');
      summary[month].count += 1;
    });
    return summary;
  }, [filteredCalculations]);

  const exportCalculations = async () => {
    try {
      const blob = await commissionManagementApi.exportCommissionCalculations({
        status: filterStatus || undefined,
        startDate: dateRange.startDate || undefined,
        endDate: dateRange.endDate || undefined
      });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `commission-calculations-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting calculations:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'CALCULATED': { color: 'bg-blue-100 text-blue-800 border-blue-200', icon: Calculator },
      'APPROVED': { color: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle },
      'PAID': { color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: CheckCircle },
      'REJECTED': { color: 'bg-red-100 text-red-800 border-red-200', icon: XCircle },
      'PENDING': { color: 'bg-amber-100 text-amber-800 border-amber-200', icon: Calculator }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig['PENDING'];
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md border ${config.color}`}>
        <Icon className="h-3 w-3" />
        {status}
      </span>
    );
  };

  const getRateTypeBadge = (rateType: string) => {
    const colors: { [key: string]: string } = {
      'Local': 'bg-blue-50 text-blue-700 border-blue-200',
      'OGL': 'bg-purple-50 text-purple-700 border-purple-200',
      'Out of Geolocation': 'bg-purple-50 text-purple-700 border-purple-200'
    };

    return (
      <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-md border ${colors[rateType] || 'bg-gray-50 text-gray-700 border-gray-200'}`}>
        {rateType}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Monthly Summary Cards */}
      {Object.keys(monthlySummary).length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.entries(monthlySummary).slice(0, 3).map(([month, data]) => (
            <Card key={month} className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
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
                    <p className="text-xs text-gray-500 mt-1">{data.count} commissions</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                    <Calculator className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader className="border-b bg-gradient-to-r from-gray-50 to-gray-100">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Calculator className="h-6 w-6 text-blue-600" />
              Monthly Commission Payments
            </CardTitle>
            <button
              onClick={exportCalculations}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm"
            >
              <Download className="h-4 w-4" />
              Export to CSV
            </button>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by task, user, client..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
            </div>

            <div className="relative min-w-[150px]">
              <Filter className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <select
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white transition-all"
              >
                <option value="">All Months</option>
                {availableMonths.map(month => (
                  <option key={month} value={month}>{month}</option>
                ))}
              </select>
            </div>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white transition-all min-w-[140px]"
            >
              <option value="">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="PAID">Paid</option>
              <option value="REJECTED">Rejected</option>
            </select>

            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
              className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              placeholder="Start Date"
            />

            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
              className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              placeholder="End Date"
            />
          </div>

          {/* Calculations Table */}
          <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                <tr>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Task ID
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Field User
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Client
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Rate Type
                  </th>
                  <th className="px-4 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Commission
                  </th>
                  <th className="px-4 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Month
                  </th>
                  <th className="px-4 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {filteredCalculations.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center justify-center text-gray-500">
                        <Calculator className="h-12 w-12 text-gray-300 mb-3" />
                        <p className="text-lg font-medium">No commission calculations found</p>
                        <p className="text-sm mt-1">Try adjusting your filters or date range</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredCalculations.map((calculation, index) => (
                    <tr
                      key={calculation.id}
                      className={`hover:bg-blue-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                    >
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-blue-600">
                            {calculation.task_number || 'N/A'}
                          </span>
                          {calculation.verification_type_name && (
                            <span className="text-xs text-gray-500 mt-0.5">
                              {calculation.verification_type_name}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-900">
                            {calculation.user_name || 'N/A'}
                          </span>
                          <span className="text-xs text-gray-500">
                            {calculation.user_email || ''}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-gray-900">
                          {calculation.client_name || 'N/A'}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-700">
                          {calculation.product_name || 'N/A'}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        {getRateTypeBadge(calculation.rate_type_name || 'N/A')}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right">
                        <div className="flex flex-col items-end">
                          <span className="text-sm font-bold text-gray-900">
                            {calculation.currency} {Number(calculation.commission_amount).toFixed(2)}
                          </span>
                          {calculation.base_amount && (
                            <span className="text-xs text-gray-500 mt-0.5">
                              Base: {calculation.currency} {Number(calculation.base_amount).toFixed(2)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Calendar className="h-3.5 w-3.5 text-gray-400" />
                          <span className="text-sm font-medium text-gray-700">
                            {formatMonth(calculation.created_at)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-center">
                        {getStatusBadge(calculation.status)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => {
                            console.log('View calculation:', calculation.id);
                          }}
                          className="inline-flex items-center justify-center p-2 text-blue-600 hover:text-blue-900 hover:bg-blue-100 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Summary and Pagination */}
          <div className="flex flex-col sm:flex-row justify-between items-center mt-6 pt-4 border-t border-gray-200 gap-4">
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-600">
                Showing <span className="font-semibold text-gray-900">{filteredCalculations.length}</span> of{' '}
                <span className="font-semibold text-gray-900">{calculations.length}</span> commissions
              </div>
              {filterMonth && (
                <div className="text-sm text-gray-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
                  Filtered by: <span className="font-semibold text-blue-700">{filterMonth}</span>
                </div>
              )}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600">
                  Page <span className="font-semibold">{currentPage}</span> of <span className="font-semibold">{totalPages}</span>
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors font-medium text-sm"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors font-medium text-sm"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
