import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  clearBrowserStorage, 
  clearReactQueryCache, 
  clearServiceWorkerCache,
  clearCaseCache,
  clearFormCache,
  clearAttachmentCache,
  clearUserCache,
  clearAllAppData
} from '@/utils/clearCache';
import { 
  Trash2, 
  RefreshCw, 
  Database, 
  Users, 
  FileText, 
  Paperclip, 
  FolderOpen,
  AlertTriangle,
  CheckCircle,
  XCircle
} from 'lucide-react';

interface ClearResult {
  success: boolean;
  timestamp: string;
}

interface ClearResults {
  browser?: ClearResult;
  reactQuery?: ClearResult;
  serviceWorker?: ClearResult;
  cases?: ClearResult;
  forms?: ClearResult;
  attachments?: ClearResult;
  users?: ClearResult;
  all?: ClearResult;
}

export const CacheClearer: React.FC = () => {
  const queryClient = useQueryClient();
  const [isClearing, setIsClearing] = useState(false);
  const [results, setResults] = useState<ClearResults>({});
  const [lastCleared, setLastCleared] = useState<string | null>(null);

  const createResult = (success: boolean): ClearResult => ({
    success,
    timestamp: new Date().toLocaleTimeString()
  });

  const handleClearSpecific = async (type: 'browser' | 'reactQuery' | 'serviceWorker' | 'cases' | 'forms' | 'attachments' | 'users') => {
    setIsClearing(true);
    
    try {
      let result = false;
      
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
      }
      
      setResults(prev => ({
        ...prev,
        [type]: createResult(result)
      }));
      
      setLastCleared(new Date().toLocaleTimeString());
      
    } catch (error) {
      console.error(`Error clearing ${type}:`, error);
      setResults(prev => ({
        ...prev,
        [type]: createResult(false)
      }));
    } finally {
      setIsClearing(false);
    }
  };

  const handleClearAll = async () => {
    setIsClearing(true);
    
    try {
      // This will clear everything and reload the page
      await clearAllAppData(queryClient);
      
      setResults(prev => ({
        ...prev,
        all: createResult(true)
      }));
      
    } catch (error) {
      console.error('Error clearing all data:', error);
      setResults(prev => ({
        ...prev,
        all: createResult(false)
      }));
    } finally {
      setIsClearing(false);
    }
  };

  const ResultIcon: React.FC<{ result?: ClearResult }> = ({ result }) => {
    if (!result) {return null;}
    
    return result.success ? (
      <CheckCircle className="h-4 w-4 text-green-500" />
    ) : (
      <XCircle className="h-4 w-4 text-red-500" />
    );
  };

  const cacheTypes = [
    {
      key: 'browser' as const,
      title: 'Browser Storage',
      description: 'Clear localStorage, sessionStorage, and IndexedDB',
      icon: Database,
      color: 'bg-green-500'
    },
    {
      key: 'reactQuery' as const,
      title: 'React Query Cache',
      description: 'Clear all cached API responses',
      icon: RefreshCw,
      color: 'bg-green-500'
    },
    {
      key: 'serviceWorker' as const,
      title: 'Service Worker Cache',
      description: 'Clear PWA and offline caches',
      icon: Database,
      color: 'bg-green-500'
    },
    {
      key: 'cases' as const,
      title: 'Cases Cache',
      description: 'Clear case-related cached data',
      icon: FolderOpen,
      color: 'bg-yellow-500'
    },
    {
      key: 'forms' as const,
      title: 'Forms Cache',
      description: 'Clear form submissions and templates',
      icon: FileText,
      color: 'bg-cyan-500'
    },
    {
      key: 'attachments' as const,
      title: 'Attachments Cache',
      description: 'Clear attachment metadata cache',
      icon: Paperclip,
      color: 'bg-pink-500'
    },
    {
      key: 'users' as const,
      title: 'Users Cache',
      description: 'Clear user and authentication data',
      icon: Users,
      color: 'bg-indigo-500'
    }
  ];

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trash2 className="h-5 w-5" />
          Cache Management
        </CardTitle>
        <p className="text-sm text-gray-600">
          Clear various types of cached data to resolve issues or free up storage space.
        </p>
        {lastCleared && (
          <Badge variant="outline" className="w-fit">
            Last cleared: {lastCleared}
          </Badge>
        )}
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Individual Cache Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cacheTypes.map((cache) => {
            const Icon = cache.icon;
            const result = results[cache.key];
            
            return (
              <div key={cache.key} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${cache.color} text-white`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="font-medium">{cache.title}</h4>
                    <p className="text-sm text-gray-600">{cache.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ResultIcon result={result} />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleClearSpecific(cache.key)}
                    disabled={isClearing}
                  >
                    Clear
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <Separator />

        {/* Clear All Section */}
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium text-red-900">Clear All Data</h4>
              <p className="text-sm text-red-700 mt-1">
                This will clear ALL cached data and reload the page. Use with caution in production.
              </p>
              <div className="flex items-center gap-2 mt-3">
                <ResultIcon result={results.all} />
                <Button
                  variant="destructive"
                  onClick={handleClearAll}
                  disabled={isClearing}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {isClearing ? 'Clearing...' : 'Clear All & Reload'}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Results Summary */}
        {Object.keys(results).length > 0 && (
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium mb-2">Recent Operations</h4>
            <div className="space-y-1">
              {Object.entries(results).map(([key, result]) => (
                <div key={key} className="flex items-center justify-between text-sm">
                  <span className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                  <div className="flex items-center gap-2">
                    <ResultIcon result={result} />
                    <span className="text-gray-600">{result.timestamp}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
