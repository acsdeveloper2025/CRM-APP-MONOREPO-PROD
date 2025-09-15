import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useQueryClient } from '@tanstack/react-query';
import { 
  clearBrowserStorage, 
  clearReactQueryCache, 
  clearServiceWorkerCache,
  clearCaseCache,
  clearFormCache,
  clearAttachmentCache,
  clearUserCache
} from '@/utils/clearCache';
import { 
  Trash2, 
  Database, 
  HardDrive, 
  Wifi, 
  RefreshCw, 
  AlertTriangle,
  CheckCircle,
  Clock
} from 'lucide-react';

export const CacheClearer: React.FC = () => {
  const queryClient = useQueryClient();
  const [isClearing, setIsClearing] = useState(false);
  const [lastCleared, setLastCleared] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, boolean>>({});

  const clearSpecificCache = async (type: string) => {
    setIsClearing(true);
    let result = false;
    
    try {
      switch (type) {
        case 'browser':
          result = clearBrowserStorage();
          break;
        case 'reactQuery':
          result = clearReactQueryCache(queryClient);
          break;
        case 'serviceWorker':
          result = await clearServiceWorkerCache();
          break;
        case 'cases':
          clearCaseCache(queryClient);
          result = true;
          break;
        case 'forms':
          clearFormCache(queryClient);
          result = true;
          break;
        case 'attachments':
          clearAttachmentCache(queryClient);
          result = true;
          break;
        case 'users':
          clearUserCache(queryClient);
          result = true;
          break;
        default:
          result = false;
      }
      
      setResults(prev => ({ ...prev, [type]: result }));
      setLastCleared(new Date().toLocaleTimeString());
    } catch (error) {
      console.error(`Error clearing ${type} cache:`, error);
      setResults(prev => ({ ...prev, [type]: false }));
    } finally {
      setIsClearing(false);
    }
  };

  const clearAllCaches = async () => {
    setIsClearing(true);
    const allResults: Record<string, boolean> = {};
    
    try {
      // Clear browser storage
      allResults.browser = clearBrowserStorage();
      
      // Clear React Query cache
      allResults.reactQuery = clearReactQueryCache(queryClient);
      
      // Clear Service Worker cache
      allResults.serviceWorker = await clearServiceWorkerCache();
      
      // Clear specific caches
      clearCaseCache(queryClient);
      allResults.cases = true;
      
      clearFormCache(queryClient);
      allResults.forms = true;
      
      clearAttachmentCache(queryClient);
      allResults.attachments = true;
      
      clearUserCache(queryClient);
      allResults.users = true;
      
      setResults(allResults);
      setLastCleared(new Date().toLocaleTimeString());
      
      // Show success message
      console.log('🎉 All caches cleared successfully!');
      
    } catch (error) {
      console.error('Error clearing caches:', error);
    } finally {
      setIsClearing(false);
    }
  };

  const getResultIcon = (type: string) => {
    if (!(type in results)) return null;
    return results[type] ? (
      <CheckCircle className="h-4 w-4 text-green-600" />
    ) : (
      <AlertTriangle className="h-4 w-4 text-red-600" />
    );
  };

  const cacheTypes = [
    { 
      key: 'browser', 
      label: 'Browser Storage', 
      description: 'localStorage, sessionStorage, IndexedDB',
      icon: <HardDrive className="h-4 w-4" />
    },
    { 
      key: 'reactQuery', 
      label: 'React Query Cache', 
      description: 'All cached API responses',
      icon: <Database className="h-4 w-4" />
    },
    { 
      key: 'serviceWorker', 
      label: 'Service Worker Cache', 
      description: 'PWA and offline caches',
      icon: <Wifi className="h-4 w-4" />
    },
    { 
      key: 'cases', 
      label: 'Cases Cache', 
      description: 'Case-related queries only',
      icon: <Database className="h-4 w-4" />
    },
    { 
      key: 'forms', 
      label: 'Forms Cache', 
      description: 'Form submissions and templates',
      icon: <Database className="h-4 w-4" />
    },
    { 
      key: 'attachments', 
      label: 'Attachments Cache', 
      description: 'File and attachment queries',
      icon: <Database className="h-4 w-4" />
    },
    { 
      key: 'users', 
      label: 'Users Cache', 
      description: 'User and authentication queries',
      icon: <Database className="h-4 w-4" />
    },
  ];

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Trash2 className="h-5 w-5" />
          <span>Cache Management</span>
          <Badge variant="destructive">Development Only</Badge>
        </CardTitle>
        {lastCleared && (
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>Last cleared: {lastCleared}</span>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Warning */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            <span className="font-medium text-yellow-800">Warning</span>
          </div>
          <p className="mt-1 text-sm text-yellow-700">
            Clearing caches will remove all stored data and force fresh API calls. 
            Use this when testing new data or troubleshooting cache issues.
          </p>
        </div>

        {/* Clear All Button */}
        <div className="flex justify-center">
          <Button
            onClick={clearAllCaches}
            disabled={isClearing}
            size="lg"
            variant="destructive"
            className="flex items-center space-x-2"
          >
            {isClearing ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            <span>Clear All Caches</span>
          </Button>
        </div>

        {/* Individual Cache Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cacheTypes.map((cache) => (
            <div key={cache.key} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {cache.icon}
                  <span className="font-medium">{cache.label}</span>
                  {getResultIcon(cache.key)}
                </div>
              </div>
              
              <p className="text-sm text-muted-foreground">{cache.description}</p>
              
              <Button
                onClick={() => clearSpecificCache(cache.key)}
                disabled={isClearing}
                size="sm"
                variant="outline"
                className="w-full"
              >
                {isClearing ? (
                  <RefreshCw className="h-3 w-3 animate-spin mr-2" />
                ) : (
                  <Trash2 className="h-3 w-3 mr-2" />
                )}
                Clear {cache.label}
              </Button>
            </div>
          ))}
        </div>

        {/* Results Summary */}
        {Object.keys(results).length > 0 && (
          <div className="bg-muted rounded-lg p-4">
            <h4 className="font-medium mb-2">Last Operation Results:</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
              {Object.entries(results).map(([type, success]) => (
                <div key={type} className="flex items-center space-x-2">
                  {success ? (
                    <CheckCircle className="h-3 w-3 text-green-600" />
                  ) : (
                    <AlertTriangle className="h-3 w-3 text-red-600" />
                  )}
                  <span className={success ? 'text-green-700' : 'text-red-700'}>
                    {type}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p><strong>Tip:</strong> After clearing caches, refresh the page to see changes.</p>
          <p><strong>Note:</strong> This component should only be used in development environments.</p>
        </div>
      </CardContent>
    </Card>
  );
};
