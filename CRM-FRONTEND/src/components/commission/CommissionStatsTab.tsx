import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, TrendingUp, Users, DollarSign, Calendar, Download } from 'lucide-react';
import { commissionManagementApi } from '../../services/commissionManagementApi';
import { CommissionStats } from '../../types/commission';

export const CommissionStatsTab: React.FC = () => {
  const [stats, setStats] = useState<CommissionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('month');

  useEffect(() => {
    loadStats();
  }, [selectedPeriod]);

  const loadStats = async () => {
    try {
      setLoading(true);
      const response = await commissionManagementApi.getCommissionStats();
      setStats(response.data);
    } catch (error) {
      console.error('Error loading commission stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportStats = () => {
    if (!stats) return;

    const csvContent = [
      ['Metric', 'Value'],
      ['Total Commission Paid', `${stats.totalCommissionPaid || 0}`],
      ['Total Commission Pending', `${stats.totalCommissionPending || 0}`],
      ['Active Field Users', `${stats.activeFieldUsers || 0}`],
      ['Total Assignments', `${stats.totalAssignments || 0}`],
      ['Average Commission Per Case', `${stats.averageCommissionPerCase || 0}`],
      ['Top Performing User', `${stats.topPerformingUser || 'N/A'}`],
      ['Most Used Rate Type', `${stats.mostUsedRateType || 'N/A'}`]
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `commission-stats-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
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
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Commission Statistics
            </div>
            <div className="flex gap-2">
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
              >
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="quarter">This Quarter</option>
                <option value="year">This Year</option>
              </select>
              <button
                onClick={exportStats}
                className="flex items-center gap-2 px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
              >
                <Download className="h-4 w-4" />
                Export
              </button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Total Commission Paid */}
            <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm">Total Paid</p>
                  <p className="text-2xl font-bold">₹{stats?.totalCommissionPaid?.toLocaleString() || '0'}</p>
                </div>
                <DollarSign className="h-8 w-8 text-green-200" />
              </div>
            </div>

            {/* Total Commission Pending */}
            <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-lg p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-yellow-100 text-sm">Total Pending</p>
                  <p className="text-2xl font-bold">₹{stats?.totalCommissionPending?.toLocaleString() || '0'}</p>
                </div>
                <Calendar className="h-8 w-8 text-yellow-200" />
              </div>
            </div>

            {/* Active Field Users */}
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm">Active Users</p>
                  <p className="text-2xl font-bold">{stats?.activeFieldUsers || '0'}</p>
                </div>
                <Users className="h-8 w-8 text-blue-200" />
              </div>
            </div>

            {/* Average Commission */}
            <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-sm">Avg Per Case</p>
                  <p className="text-2xl font-bold">₹{stats?.averageCommissionPerCase?.toLocaleString() || '0'}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-purple-200" />
              </div>
            </div>
          </div>

          {/* Additional Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Performance Insights</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Top Performing User:</span>
                    <span className="font-semibold">{stats?.topPerformingUser || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Most Used Rate Type:</span>
                    <span className="font-semibold">{stats?.mostUsedRateType || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Total Assignments:</span>
                    <span className="font-semibold">{stats?.totalAssignments || '0'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Commission Rate Types:</span>
                    <span className="font-semibold">{stats?.totalRateTypes || '0'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Cases Completed Today:</span>
                    <span className="font-semibold">{stats?.casesCompletedToday || '0'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Commission Calculated Today:</span>
                    <span className="font-semibold">₹{stats?.commissionCalculatedToday?.toLocaleString() || '0'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">New Assignments This Week:</span>
                    <span className="font-semibold">{stats?.newAssignmentsThisWeek || '0'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Payment Batches Pending:</span>
                    <span className="font-semibold">{stats?.paymentBatchesPending || '0'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
