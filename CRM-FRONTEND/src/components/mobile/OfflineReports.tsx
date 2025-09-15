import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Download, 
  Upload, 
  Wifi, 
  WifiOff,
  HardDrive,
  Clock,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Trash2,
  Eye,
  Calendar,
  FileText,
  Database
} from 'lucide-react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useOfflineStorage } from '@/hooks/useOfflineStorage';

interface OfflineReport {
  id: string;
  name: string;
  type: 'performance' | 'submissions' | 'analytics';
  size: number; // bytes
  downloadedAt: string;
  lastAccessed?: string;
  expiresAt: string;
  isExpired: boolean;
  syncStatus: 'synced' | 'pending' | 'failed';
}

interface SyncStatus {
  isActive: boolean;
  progress: number;
  currentItem?: string;
  totalItems: number;
  completedItems: number;
}

export const OfflineReports: React.FC = () => {
  const { isOnline, connectionQuality } = useNetworkStatus();
  const { 
    offlineReports, 
    storageUsed, 
    storageLimit, 
    downloadReport, 
    deleteReport,
    syncPendingData,
    clearExpiredReports
  } = useOfflineStorage();
  
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isActive: false,
    progress: 0,
    totalItems: 0,
    completedItems: 0
  });
  const [selectedReports, setSelectedReports] = useState<string[]>([]);

  useEffect(() => {
    // Auto-sync when coming online
    if (isOnline && connectionQuality !== 'poor') {
      handleAutoSync();
    }
  }, [isOnline, connectionQuality]);

  const handleAutoSync = async () => {
    const pendingReports = offlineReports.filter(report => report.syncStatus === 'pending');
    if (pendingReports.length > 0) {
      await handleSyncData();
    }
  };

  const handleDownloadReport = async (reportType: string) => {
    try {
      setSyncStatus(prev => ({ ...prev, isActive: true, progress: 0 }));
      
      // Simulate download progress
      for (let i = 0; i <= 100; i += 10) {
        setSyncStatus(prev => ({ ...prev, progress: i }));
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      await downloadReport(reportType);
      
      setSyncStatus(prev => ({ ...prev, isActive: false, progress: 100 }));
    } catch (error) {
      console.error('Error downloading report:', error);
      setSyncStatus(prev => ({ ...prev, isActive: false }));
    }
  };

  const handleSyncData = async () => {
    try {
      setSyncStatus({
        isActive: true,
        progress: 0,
        totalItems: offlineReports.filter(r => r.syncStatus === 'pending').length,
        completedItems: 0
      });

      await syncPendingData((progress, currentItem) => {
        setSyncStatus(prev => ({
          ...prev,
          progress,
          currentItem,
          completedItems: Math.floor((progress / 100) * prev.totalItems)
        }));
      });

      setSyncStatus(prev => ({ ...prev, isActive: false, progress: 100 }));
    } catch (error) {
      console.error('Error syncing data:', error);
      setSyncStatus(prev => ({ ...prev, isActive: false }));
    }
  };

  const handleDeleteSelected = async () => {
    for (const reportId of selectedReports) {
      await deleteReport(reportId);
    }
    setSelectedReports([]);
  };

  const handleClearExpired = async () => {
    await clearExpiredReports();
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStoragePercentage = (): number => {
    return (storageUsed / storageLimit) * 100;
  };

  const getReportIcon = (type: string) => {
    switch (type) {
      case 'performance':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'submissions':
        return <FileText className="h-4 w-4 text-blue-600" />;
      case 'analytics':
        return <Database className="h-4 w-4 text-purple-600" />;
      default:
        return <FileText className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getSyncStatusIcon = (status: string) => {
    switch (status) {
      case 'synced':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getSyncStatusBadge = (status: string) => {
    switch (status) {
      case 'synced':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-4">
      {/* Connection Status */}
      <Card className={`border-l-4 ${isOnline ? 'border-l-green-500' : 'border-l-red-500'}`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {isOnline ? (
                <Wifi className="h-5 w-5 text-green-600" />
              ) : (
                <WifiOff className="h-5 w-5 text-red-600" />
              )}
              <div>
                <p className="font-medium text-sm">
                  {isOnline ? 'Online' : 'Offline Mode'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isOnline 
                    ? `Connection: ${connectionQuality?.toUpperCase()}`
                    : 'Working with cached data'
                  }
                </p>
              </div>
            </div>
            {isOnline && (
              <Button 
                size="sm" 
                onClick={handleSyncData}
                disabled={syncStatus.isActive}
              >
                <Upload className="h-4 w-4 mr-1" />
                Sync
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Storage Usage */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center">
            <HardDrive className="h-5 w-5 mr-2" />
            Storage Usage
          </CardTitle>
          <CardDescription>
            {formatFileSize(storageUsed)} of {formatFileSize(storageLimit)} used
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Progress value={getStoragePercentage()} className="mb-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{getStoragePercentage().toFixed(1)}% used</span>
            <span>{formatFileSize(storageLimit - storageUsed)} available</span>
          </div>
        </CardContent>
      </Card>

      {/* Sync Status */}
      {syncStatus.isActive && (
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3 mb-3">
              <RefreshCw className="h-5 w-5 text-blue-600 animate-spin" />
              <div>
                <p className="font-medium text-sm">
                  {syncStatus.currentItem ? 'Syncing Data...' : 'Downloading...'}
                </p>
                {syncStatus.currentItem && (
                  <p className="text-xs text-muted-foreground">{syncStatus.currentItem}</p>
                )}
              </div>
            </div>
            <Progress value={syncStatus.progress} className="mb-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{syncStatus.progress.toFixed(0)}% complete</span>
              {syncStatus.totalItems > 0 && (
                <span>{syncStatus.completedItems} of {syncStatus.totalItems} items</span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Download Actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Quick Downloads</CardTitle>
          <CardDescription>Download reports for offline viewing</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button 
            className="w-full justify-start" 
            variant="outline"
            onClick={() => handleDownloadReport('performance')}
            disabled={!isOnline || syncStatus.isActive}
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            My Performance Report
          </Button>
          <Button 
            className="w-full justify-start" 
            variant="outline"
            onClick={() => handleDownloadReport('submissions')}
            disabled={!isOnline || syncStatus.isActive}
          >
            <FileText className="h-4 w-4 mr-2" />
            Recent Submissions
          </Button>
          <Button 
            className="w-full justify-start" 
            variant="outline"
            onClick={() => handleDownloadReport('analytics')}
            disabled={!isOnline || syncStatus.isActive}
          >
            <Database className="h-4 w-4 mr-2" />
            Analytics Dashboard
          </Button>
        </CardContent>
      </Card>

      {/* Downloaded Reports */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Downloaded Reports</CardTitle>
              <CardDescription>{offlineReports.length} reports available offline</CardDescription>
            </div>
            {selectedReports.length > 0 && (
              <Button 
                size="sm" 
                variant="destructive"
                onClick={handleDeleteSelected}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete ({selectedReports.length})
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {offlineReports.length === 0 ? (
            <div className="text-center py-8">
              <Download className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No offline reports</h3>
              <p className="text-muted-foreground">Download reports to view them offline</p>
            </div>
          ) : (
            offlineReports.map((report) => (
              <div 
                key={report.id}
                className={`p-3 border rounded-lg ${
                  report.isExpired ? 'bg-red-50 border-red-200' : 'bg-white'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1">
                    <input
                      type="checkbox"
                      checked={selectedReports.includes(report.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedReports([...selectedReports, report.id]);
                        } else {
                          setSelectedReports(selectedReports.filter(id => id !== report.id));
                        }
                      }}
                      className="mt-1"
                    />
                    {getReportIcon(report.type)}
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <h4 className="font-medium text-sm">{report.name}</h4>
                        <Badge className={getSyncStatusBadge(report.syncStatus)} variant="secondary">
                          {report.syncStatus}
                        </Badge>
                        {report.isExpired && (
                          <Badge className="bg-red-100 text-red-800" variant="secondary">
                            Expired
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                        <span>{formatFileSize(report.size)}</span>
                        <span>Downloaded: {new Date(report.downloadedAt).toLocaleDateString()}</span>
                        {report.lastAccessed && (
                          <span>Accessed: {new Date(report.lastAccessed).toLocaleDateString()}</span>
                        )}
                      </div>
                      <div className="flex items-center space-x-1 mt-1">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          Expires: {new Date(report.expiresAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {getSyncStatusIcon(report.syncStatus)}
                    <Button variant="ghost" size="sm">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Maintenance Actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Maintenance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button 
            className="w-full justify-start" 
            variant="outline"
            onClick={handleClearExpired}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear Expired Reports ({offlineReports.filter(r => r.isExpired).length})
          </Button>
          <Button 
            className="w-full justify-start" 
            variant="outline"
            onClick={() => setSelectedReports(offlineReports.map(r => r.id))}
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Select All Reports
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
