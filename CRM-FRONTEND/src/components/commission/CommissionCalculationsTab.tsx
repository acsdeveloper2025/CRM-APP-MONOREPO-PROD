import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calculator, Search, Download, Eye, CheckCircle, XCircle } from 'lucide-react';
import { commissionManagementApi } from '../../services/commissionManagementApi';
import { CommissionCalculation } from '../../types/commission';

export const CommissionCalculationsTab: React.FC = () => {
  const [calculations, setCalculations] = useState<CommissionCalculation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
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
        limit: 20,
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
      'CALCULATED': { color: 'bg-blue-100 text-blue-800', icon: Calculator },
      'APPROVED': { color: 'bg-green-100 text-green-800', icon: CheckCircle },
      'PAID': { color: 'bg-green-100 text-green-800', icon: CheckCircle },
      'REJECTED': { color: 'bg-red-100 text-red-800', icon: XCircle },
      'PENDING': { color: 'bg-yellow-100 text-yellow-800', icon: Calculator }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig['PENDING'];
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full ${config.color}`}>
        <Icon className="h-3 w-3" />
        {status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Commission Calculations
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search calculations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Statuses</option>
              <option value="CALCULATED">Calculated</option>
              <option value="APPROVED">Approved</option>
              <option value="PAID">Paid</option>
              <option value="REJECTED">Rejected</option>
              <option value="PENDING">Pending</option>
            </select>

            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Start Date"
            />

            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="End Date"
            />

            <button
              onClick={exportCalculations}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
          </div>

          {/* Calculations Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Case ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Field User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rate Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Commission</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Calculated Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {calculations.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      No commission calculations found
                    </td>
                  </tr>
                ) : (
                  calculations.map((calculation) => (
                    <tr key={calculation.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {calculation.case_id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{calculation.user_name || 'N/A'}</div>
                          <div className="text-sm text-gray-500">{calculation.user_email || ''}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {calculation.rate_type_name || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div>
                          <div className="font-medium">{calculation.currency} {calculation.commission_amount}</div>
                          {calculation.base_amount && (
                            <div className="text-xs text-gray-500">Base: {calculation.currency} {calculation.base_amount}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(calculation.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {calculation.calculated_at ? new Date(calculation.calculated_at).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => {
                            // View calculation details
                            console.log('View calculation:', calculation.id);
                          }}
                          className="text-blue-600 hover:text-blue-900"
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center mt-6">
              <div className="text-sm text-gray-700">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
