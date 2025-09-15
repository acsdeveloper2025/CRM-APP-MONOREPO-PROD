import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  RotateCcw, 
  Wifi, 
  WifiOff, 
  Zap,
  FileText,
  Camera,
  Upload,
  Database,
  TrendingUp,
  Activity
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface SubmissionProgress {
  id: string;
  caseId: string;
  verificationType: string;
  status: 'PREPARING' | 'UPLOADING' | 'SUBMITTING' | 'COMPLETED' | 'FAILED';
  overallProgress: number;
  currentStep: string;
  steps: Array<{
    id: string;
    name: string;
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
    progress: number;
    error?: string;
  }>;
  startTime: string;
  endTime?: string;
  estimatedTimeRemaining?: number;
  compressionStats?: {
    originalSize: number;
    compressedSize: number;
    compressionRatio: number;
  };
  retryInfo?: {
    requestId: string;
    attempts: number;
    maxAttempts: number;
    nextRetryIn?: number;
  };
}

interface RetryQueueStatus {
  pending: number;
  retrying: number;
  failed: number;
  totalRequests: number;
}

interface EnhancedCaseStatusProps {
  caseId: string;
  currentStatus: string;
  submissionProgress?: SubmissionProgress;
  retryQueueStatus?: RetryQueueStatus;
  onRetrySubmission?: () => void;
  onClearRetryQueue?: () => void;
}

export const EnhancedCaseStatus: React.FC<EnhancedCaseStatusProps> = ({
  caseId,
  currentStatus,
  submissionProgress,
  retryQueueStatus,
  onRetrySubmission,
  onClearRetryQueue
}) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-blue-100 text-blue-800';
      case 'IN_PROGRESS':
        return 'bg-yellow-100 text-yellow-800';
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      case 'FAILED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-muted text-foreground';
    }
  };

  const getStepIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'FAILED':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'IN_PROGRESS':
        return <div className="h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Case Status & Progress
            </CardTitle>
            <CardDescription>Real-time submission status and progress tracking</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={getStatusColor(currentStatus)}>
              {currentStatus.replace('_', ' ')}
            </Badge>
            {isOnline ? (
              <Wifi className="h-4 w-4 text-green-500" />
            ) : (
              <WifiOff className="h-4 w-4 text-red-500" />
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="status" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="status">Status</TabsTrigger>
            <TabsTrigger value="progress">Progress</TabsTrigger>
            <TabsTrigger value="retry">Retry Queue</TabsTrigger>
            <TabsTrigger value="stats">Stats</TabsTrigger>
          </TabsList>

          {/* Status Tab */}
          <TabsContent value="status" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Current Status</h4>
                <Badge className={getStatusColor(currentStatus)}>
                  {currentStatus.replace('_', ' ')}
                </Badge>
              </div>
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Network Status</h4>
                <div className="flex items-center gap-2">
                  {isOnline ? (
                    <>
                      <Wifi className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-green-600">Online</span>
                    </>
                  ) : (
                    <>
                      <WifiOff className="h-4 w-4 text-red-500" />
                      <span className="text-sm text-red-600">Offline</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Progress Tab */}
          <TabsContent value="progress" className="space-y-4">
            {submissionProgress ? (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">Submission Progress</h4>
                    <span className="text-sm text-muted-foreground">{submissionProgress.overallProgress}%</span>
                  </div>
                  <Progress value={submissionProgress.overallProgress} className="w-full" />
                  <p className="text-xs text-muted-foreground">
                    {submissionProgress.verificationType} verification for Case #{caseId}
                  </p>
                </div>

                {submissionProgress.estimatedTimeRemaining && (
                  <div className="text-sm text-muted-foreground">
                    Estimated time remaining: {formatTime(submissionProgress.estimatedTimeRemaining)}
                  </div>
                )}

                <div className="space-y-3">
                  <h5 className="text-sm font-medium">Steps</h5>
                  {submissionProgress.steps.map((step) => (
                    <div key={step.id} className="flex items-center gap-3">
                      {getStepIcon(step.status)}
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">{step.name}</span>
                          {step.status === 'IN_PROGRESS' && (
                            <span className="text-xs text-muted-foreground">{step.progress}%</span>
                          )}
                        </div>
                        {step.status === 'IN_PROGRESS' && (
                          <Progress value={step.progress} className="w-full h-1 mt-1" />
                        )}
                        {step.error && (
                          <p className="text-xs text-red-600 mt-1">{step.error}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No active submission progress</p>
              </div>
            )}
          </TabsContent>

          {/* Retry Queue Tab */}
          <TabsContent value="retry" className="space-y-4">
            {retryQueueStatus && retryQueueStatus.totalRequests > 0 ? (
              <>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="space-y-1">
                    <p className="text-2xl font-bold text-orange-600">{retryQueueStatus.pending}</p>
                    <p className="text-xs text-muted-foreground">Pending</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-2xl font-bold text-blue-600">{retryQueueStatus.retrying}</p>
                    <p className="text-xs text-muted-foreground">Retrying</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-2xl font-bold text-red-600">{retryQueueStatus.failed}</p>
                    <p className="text-xs text-muted-foreground">Failed</p>
                  </div>
                </div>

                {submissionProgress?.retryInfo && (
                  <div className="bg-orange-50 p-3 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <RotateCcw className="h-4 w-4 text-orange-600" />
                      <span className="text-sm font-medium text-orange-800">Retry Information</span>
                    </div>
                    <div className="text-sm text-orange-700 space-y-1">
                      <p>Attempt {submissionProgress.retryInfo.attempts} of {submissionProgress.retryInfo.maxAttempts}</p>
                      {submissionProgress.retryInfo.nextRetryIn && (
                        <p>Next retry in: {formatTime(submissionProgress.retryInfo.nextRetryIn)}</p>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  {onRetrySubmission && (
                    <Button onClick={onRetrySubmission} size="sm" variant="outline">
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Retry Now
                    </Button>
                  )}
                  {onClearRetryQueue && (
                    <Button onClick={onClearRetryQueue} size="sm" variant="outline">
                      Clear Queue
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <RotateCcw className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No pending retries</p>
              </div>
            )}
          </TabsContent>

          {/* Stats Tab */}
          <TabsContent value="stats" className="space-y-4">
            {submissionProgress?.compressionStats ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      Data Compression
                    </h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Original:</span>
                        <span>{formatBytes(submissionProgress.compressionStats.originalSize)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Compressed:</span>
                        <span>{formatBytes(submissionProgress.compressionStats.compressedSize)}</span>
                      </div>
                      <div className="flex justify-between font-medium">
                        <span>Saved:</span>
                        <span className="text-green-600">
                          {Math.round((1 - submissionProgress.compressionStats.compressionRatio) * 100)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Performance
                    </h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Started:</span>
                        <span>{formatDistanceToNow(new Date(submissionProgress.startTime), { addSuffix: true })}</span>
                      </div>
                      {submissionProgress.endTime && (
                        <div className="flex justify-between">
                          <span>Completed:</span>
                          <span>{formatDistanceToNow(new Date(submissionProgress.endTime), { addSuffix: true })}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No compression statistics available</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
