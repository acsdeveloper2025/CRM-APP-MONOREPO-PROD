import React, { useEffect, useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch, fetchCases, fetchFieldAgentWorkload } from '../store/enterpriseStore';
import { VirtualizedCaseList } from './VirtualizedCaseList';
import { usePerformanceMonitor, useMemoryMonitor, useEnterpriseList } from '../hooks/useEnterprisePerformance';
import { 
  Users, 
  FileText, 
  Clock, 
  TrendingUp, 
  Activity, 
  Zap,
  Database,
  Cpu,
  MemoryStick,
  Wifi,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';

interface DashboardMetrics {
  totalCases: number;
  activeCases: number;
  completedToday: number;
  averageResponseTime: number;
  systemLoad: number;
  cacheHitRate: number;
  activeUsers: number;
  queueSize: number;
}

interface PerformanceMetrics {
  renderTime: number;
  memoryUsage: number;
  apiLatency: number;
  cacheEfficiency: number;
}

export const EnterpriseDashboard: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { getPerformanceStats } = usePerformanceMonitor('EnterpriseDashboard');
  const { memoryInfo, getMemoryUsagePercentage } = useMemoryMonitor();
  
  const {
    items: cases,
    totalCount,
    loading,
    error,
    filters,
    searchQuery,
    selectedCases,
    hasMore,
  } = useSelector((state: RootState) => state.cases);

  const {
    workloadData,
    currentUser,
  } = useSelector((state: RootState) => state.users);

  const {
    notifications,
    sidebarCollapsed,
  } = useSelector((state: RootState) => state.ui);

  const [dashboardMetrics, setDashboardMetrics] = useState<DashboardMetrics>({
    totalCases: 0,
    activeCases: 0,
    completedToday: 0,
    averageResponseTime: 0,
    systemLoad: 0,
    cacheHitRate: 0,
    activeUsers: 0,
    queueSize: 0,
  });

  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics>({
    renderTime: 0,
    memoryUsage: 0,
    apiLatency: 0,
    cacheEfficiency: 0,
  });

  // Fetch initial data
  useEffect(() => {
    dispatch(fetchCases({ page: 1, limit: 50 }));
    dispatch(fetchFieldAgentWorkload());
  }, [dispatch]);

  // Update performance metrics
  useEffect(() => {
    const interval = setInterval(() => {
      const perfStats = getPerformanceStats();
      setPerformanceMetrics(prev => ({
        ...prev,
        renderTime: perfStats.lastRenderTime,
        memoryUsage: getMemoryUsagePercentage(),
      }));
    }, 5000);

    return () => clearInterval(interval);
  }, [getPerformanceStats, getMemoryUsagePercentage]);

  // Calculate dashboard metrics
  const calculatedMetrics = useMemo(() => {
    const activeCases = cases.filter(c => c.status === 'IN_PROGRESS' || c.status === 'PENDING').length;
    const completedToday = cases.filter(c => {
      const today = new Date().toDateString();
      return c.status === 'COMPLETED' && new Date(c.updatedAt).toDateString() === today;
    }).length;

    return {
      totalCases: totalCount,
      activeCases,
      completedToday,
      averageResponseTime: 145, // Mock data - would come from API
      systemLoad: 65, // Mock data
      cacheHitRate: 89, // Mock data
      activeUsers: 234, // Mock data
      queueSize: 12, // Mock data
    };
  }, [cases, totalCount]);

  useEffect(() => {
    setDashboardMetrics(calculatedMetrics);
  }, [calculatedMetrics]);

  const handleCaseSelect = (caseItem: any) => {
    // Navigate to case details
    // TODO: Implement navigation to case details
  };

  const handleLoadMore = () => {
    // Load more cases for infinite scroll
    dispatch(fetchCases({ 
      page: Math.floor(cases.length / 50) + 1, 
      limit: 50,
      filters,
      search: searchQuery,
    }));
  };

  const handleRefresh = () => {
    dispatch(fetchCases({ page: 1, limit: 50, useCache: false }));
  };

  const handleSearch = (query: string) => {
    dispatch(fetchCases({ page: 1, limit: 50, search: query }));
  };

  const handleFilter = (newFilters: any) => {
    dispatch(fetchCases({ page: 1, limit: 50, filters: newFilters }));
  };

  // Performance status indicators
  const getPerformanceStatus = (value: number, thresholds: { good: number; warning: number }) => {
    if (value <= thresholds.good) return { status: 'good', color: 'text-green-600' };
    if (value <= thresholds.warning) return { status: 'warning', color: 'text-yellow-600' };
    return { status: 'critical', color: 'text-red-600' };
  };

  const renderTimeStatus = getPerformanceStatus(performanceMetrics.renderTime, { good: 16, warning: 32 });
  const memoryStatus = getPerformanceStatus(performanceMetrics.memoryUsage, { good: 70, warning: 85 });
  const systemLoadStatus = getPerformanceStatus(dashboardMetrics.systemLoad, { good: 60, warning: 80 });

  return (
    <div className="min-h-screen bg-muted">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-border">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Enterprise Dashboard</h1>
              <p className="text-muted-foreground">Real-time system monitoring and case management</p>
            </div>
            <div className="flex items-center space-x-4">
              {/* Performance indicators */}
              <div className="flex items-center space-x-2 text-sm">
                <Cpu className={`h-4 w-4 ${renderTimeStatus.color}`} />
                <span className={renderTimeStatus.color}>
                  {performanceMetrics.renderTime.toFixed(1)}ms
                </span>
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <MemoryStick className={`h-4 w-4 ${memoryStatus.color}`} />
                <span className={memoryStatus.color}>
                  {performanceMetrics.memoryUsage.toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <Activity className={`h-4 w-4 ${systemLoadStatus.color}`} />
                <span className={systemLoadStatus.color}>
                  {dashboardMetrics.systemLoad}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar with metrics */}
        <aside className={`${sidebarCollapsed ? 'w-16' : 'w-80'} bg-white shadow-sm transition-all duration-300`}>
          <div className="p-6">
            {!sidebarCollapsed && (
              <>
                <h2 className="text-lg font-semibold text-foreground mb-4">System Metrics</h2>
                
                {/* Key Performance Indicators */}
                <div className="grid grid-cols-1 gap-4 mb-6">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="flex items-center">
                      <FileText className="h-8 w-8 text-blue-600" />
                      <div className="ml-3">
                        <p className="text-sm font-medium text-blue-900">Total Cases</p>
                        <p className="text-2xl font-bold text-blue-600">
                          {dashboardMetrics.totalCases.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="flex items-center">
                      <Clock className="h-8 w-8 text-green-600" />
                      <div className="ml-3">
                        <p className="text-sm font-medium text-green-900">Active Cases</p>
                        <p className="text-2xl font-bold text-green-600">
                          {dashboardMetrics.activeCases.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-purple-50 p-4 rounded-lg">
                    <div className="flex items-center">
                      <Users className="h-8 w-8 text-purple-600" />
                      <div className="ml-3">
                        <p className="text-sm font-medium text-purple-900">Active Users</p>
                        <p className="text-2xl font-bold text-purple-600">
                          {dashboardMetrics.activeUsers}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-orange-50 p-4 rounded-lg">
                    <div className="flex items-center">
                      <TrendingUp className="h-8 w-8 text-orange-600" />
                      <div className="ml-3">
                        <p className="text-sm font-medium text-orange-900">Completed Today</p>
                        <p className="text-2xl font-bold text-orange-600">
                          {dashboardMetrics.completedToday}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* System Health */}
                <div className="mb-6">
                  <h3 className="text-md font-semibold text-foreground mb-3">System Health</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Database className="h-4 w-4 text-muted-foreground mr-2" />
                        <span className="text-sm text-foreground">Cache Hit Rate</span>
                      </div>
                      <span className="text-sm font-medium text-green-600">
                        {dashboardMetrics.cacheHitRate}%
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Zap className="h-4 w-4 text-muted-foreground mr-2" />
                        <span className="text-sm text-foreground">Avg Response</span>
                      </div>
                      <span className="text-sm font-medium text-blue-600">
                        {dashboardMetrics.averageResponseTime}ms
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Wifi className="h-4 w-4 text-muted-foreground mr-2" />
                        <span className="text-sm text-foreground">Queue Size</span>
                      </div>
                      <span className="text-sm font-medium text-muted-foreground">
                        {dashboardMetrics.queueSize}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Field Agent Workload */}
                {workloadData.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-md font-semibold text-foreground mb-3">Top Field Agents</h3>
                    <div className="space-y-2">
                      {workloadData.slice(0, 5).map((agent) => (
                        <div key={agent.userId} className="flex items-center justify-between text-sm">
                          <span className="text-foreground truncate">{agent.userName}</span>
                          <span className="text-muted-foreground">{agent.assignedCases}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent Notifications */}
                {notifications.length > 0 && (
                  <div>
                    <h3 className="text-md font-semibold text-foreground mb-3">Recent Alerts</h3>
                    <div className="space-y-2">
                      {notifications.slice(0, 3).map((notification) => (
                        <div key={notification.id} className="flex items-start space-x-2 text-sm">
                          {notification.type === 'error' ? (
                            <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5" />
                          ) : (
                            <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                          )}
                          <div className="flex-1">
                            <p className="text-foreground truncate">{notification.title}</p>
                            <p className="text-muted-foreground text-xs">
                              {new Date(notification.timestamp).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-hidden">
          <div className="h-full">
            <VirtualizedCaseList
              cases={cases}
              loading={loading}
              onCaseSelect={handleCaseSelect}
              onLoadMore={handleLoadMore}
              hasMore={hasMore}
              totalCount={totalCount}
              onRefresh={handleRefresh}
              onSearch={handleSearch}
              onFilter={handleFilter}
              currentFilters={filters}
            />
          </div>
        </main>
      </div>
    </div>
  );
};
