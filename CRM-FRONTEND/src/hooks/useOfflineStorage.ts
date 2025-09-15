import { useState, useEffect } from 'react';

interface OfflineReport {
  id: string;
  name: string;
  type: 'performance' | 'submissions' | 'analytics';
  size: number;
  downloadedAt: string;
  lastAccessed?: string;
  expiresAt: string;
  isExpired: boolean;
  syncStatus: 'synced' | 'pending' | 'failed';
  data: any;
}

interface OfflineStorageHook {
  offlineReports: OfflineReport[];
  storageUsed: number;
  storageLimit: number;
  downloadReport: (reportType: string) => Promise<void>;
  deleteReport: (reportId: string) => Promise<void>;
  syncPendingData: (progressCallback?: (progress: number, currentItem?: string) => void) => Promise<void>;
  clearExpiredReports: () => Promise<void>;
  getReport: (reportId: string) => OfflineReport | null;
  updateLastAccessed: (reportId: string) => Promise<void>;
}

const STORAGE_KEY = 'crm_offline_reports';
const STORAGE_LIMIT = 50 * 1024 * 1024; // 50MB limit

export const useOfflineStorage = (): OfflineStorageHook => {
  const [offlineReports, setOfflineReports] = useState<OfflineReport[]>([]);
  const [storageUsed, setStorageUsed] = useState<number>(0);

  useEffect(() => {
    loadOfflineReports();
    calculateStorageUsed();
  }, []);

  const loadOfflineReports = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const reports: OfflineReport[] = JSON.parse(stored);
        
        // Update expired status
        const updatedReports = reports.map(report => ({
          ...report,
          isExpired: new Date(report.expiresAt) < new Date()
        }));
        
        setOfflineReports(updatedReports);
      }
    } catch (error) {
      console.error('Error loading offline reports:', error);
    }
  };

  const saveOfflineReports = (reports: OfflineReport[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
      setOfflineReports(reports);
      calculateStorageUsed();
    } catch (error) {
      console.error('Error saving offline reports:', error);
      throw new Error('Storage quota exceeded');
    }
  };

  const calculateStorageUsed = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const size = stored ? new Blob([stored]).size : 0;
      setStorageUsed(size);
    } catch (error) {
      console.error('Error calculating storage:', error);
    }
  };

  const downloadReport = async (reportType: string): Promise<void> => {
    try {
      // Simulate API call to download report data
      const mockData = await fetchReportData(reportType);
      
      const newReport: OfflineReport = {
        id: `${reportType}_${Date.now()}`,
        name: getReportName(reportType),
        type: reportType as 'performance' | 'submissions' | 'analytics',
        size: JSON.stringify(mockData).length,
        downloadedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
        isExpired: false,
        syncStatus: 'synced',
        data: mockData
      };

      // Check storage limit
      const newSize = storageUsed + newReport.size;
      if (newSize > STORAGE_LIMIT) {
        throw new Error('Storage limit exceeded. Please delete some reports first.');
      }

      const updatedReports = [...offlineReports, newReport];
      saveOfflineReports(updatedReports);
    } catch (error) {
      console.error('Error downloading report:', error);
      throw error;
    }
  };

  const deleteReport = async (reportId: string): Promise<void> => {
    try {
      const updatedReports = offlineReports.filter(report => report.id !== reportId);
      saveOfflineReports(updatedReports);
    } catch (error) {
      console.error('Error deleting report:', error);
      throw error;
    }
  };

  const syncPendingData = async (
    progressCallback?: (progress: number, currentItem?: string) => void
  ): Promise<void> => {
    try {
      const pendingReports = offlineReports.filter(report => report.syncStatus === 'pending');
      
      for (let i = 0; i < pendingReports.length; i++) {
        const report = pendingReports[i];
        const progress = ((i + 1) / pendingReports.length) * 100;
        
        progressCallback?.(progress, report.name);
        
        // Simulate sync operation
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Update sync status
        const updatedReports = offlineReports.map(r => 
          r.id === report.id ? { ...r, syncStatus: 'synced' as const } : r
        );
        
        setOfflineReports(updatedReports);
      }
      
      // Save final state
      const finalReports = offlineReports.map(report => 
        pendingReports.some(p => p.id === report.id) 
          ? { ...report, syncStatus: 'synced' as const }
          : report
      );
      
      saveOfflineReports(finalReports);
    } catch (error) {
      console.error('Error syncing data:', error);
      
      // Mark failed reports
      const failedReports = offlineReports.map(report => 
        report.syncStatus === 'pending' 
          ? { ...report, syncStatus: 'failed' as const }
          : report
      );
      
      saveOfflineReports(failedReports);
      throw error;
    }
  };

  const clearExpiredReports = async (): Promise<void> => {
    try {
      const activeReports = offlineReports.filter(report => !report.isExpired);
      saveOfflineReports(activeReports);
    } catch (error) {
      console.error('Error clearing expired reports:', error);
      throw error;
    }
  };

  const getReport = (reportId: string): OfflineReport | null => {
    return offlineReports.find(report => report.id === reportId) || null;
  };

  const updateLastAccessed = async (reportId: string): Promise<void> => {
    try {
      const updatedReports = offlineReports.map(report => 
        report.id === reportId 
          ? { ...report, lastAccessed: new Date().toISOString() }
          : report
      );
      saveOfflineReports(updatedReports);
    } catch (error) {
      console.error('Error updating last accessed:', error);
      throw error;
    }
  };

  // Helper functions
  const fetchReportData = async (reportType: string): Promise<any> => {
    // Mock data generation based on report type
    switch (reportType) {
      case 'performance':
        return {
          qualityScore: 89,
          completionRate: 94,
          avgResponseTime: 24,
          submissions: 156,
          trends: [
            { date: '2024-01-08', score: 85 },
            { date: '2024-01-09', score: 88 },
            { date: '2024-01-10', score: 92 },
            { date: '2024-01-11', score: 87 },
            { date: '2024-01-12', score: 90 }
          ]
        };
      
      case 'submissions':
        return {
          total: 156,
          recent: [
            { id: '1', customer: 'John Doe', type: 'RESIDENCE', status: 'VALID' },
            { id: '2', customer: 'Jane Smith', type: 'OFFICE', status: 'PENDING' },
            { id: '3', customer: 'Mike Johnson', type: 'BUSINESS', status: 'VALID' }
          ],
          byType: {
            RESIDENCE: 95,
            OFFICE: 38,
            BUSINESS: 23
          }
        };
      
      case 'analytics':
        return {
          overview: {
            totalForms: 156,
            validationRate: 94,
            avgQuality: 89
          },
          charts: {
            daily: [
              { date: '2024-01-08', submissions: 8 },
              { date: '2024-01-09', submissions: 12 },
              { date: '2024-01-10', submissions: 6 }
            ],
            quality: [
              { metric: 'Accuracy', value: 92 },
              { metric: 'Completeness', value: 94 },
              { metric: 'Timeliness', value: 87 }
            ]
          }
        };
      
      default:
        return { message: 'Unknown report type' };
    }
  };

  const getReportName = (reportType: string): string => {
    switch (reportType) {
      case 'performance':
        return 'My Performance Report';
      case 'submissions':
        return 'Recent Submissions';
      case 'analytics':
        return 'Analytics Dashboard';
      default:
        return 'Unknown Report';
    }
  };

  return {
    offlineReports,
    storageUsed,
    storageLimit: STORAGE_LIMIT,
    downloadReport,
    deleteReport,
    syncPendingData,
    clearExpiredReports,
    getReport,
    updateLastAccessed
  };
};
