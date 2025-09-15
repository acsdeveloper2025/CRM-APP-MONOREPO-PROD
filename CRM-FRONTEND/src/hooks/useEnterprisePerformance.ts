import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../store/enterpriseStore';
import { debounce, throttle } from 'lodash';

// Custom hook for debouncing values
export const useDebounce = <T>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

// Custom hook for throttling function calls
export const useThrottle = <T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T => {
  const throttledCallback = useMemo(
    () => throttle(callback, delay),
    [callback, delay]
  );

  useEffect(() => {
    return () => {
      throttledCallback.cancel();
    };
  }, [throttledCallback]);

  return throttledCallback as T;
};

// Custom hook for infinite scrolling with performance optimization
export const useInfiniteScroll = (
  hasMore: boolean,
  loading: boolean,
  onLoadMore: () => void
) => {
  const [isFetching, setIsFetching] = useState(false);

  const handleScroll = useThrottle(() => {
    if (window.innerHeight + document.documentElement.scrollTop !== document.documentElement.offsetHeight || isFetching) {
      return;
    }
    if (hasMore && !loading) {
      setIsFetching(true);
    }
  }, 200);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  useEffect(() => {
    if (!isFetching) return;
    onLoadMore();
    setIsFetching(false);
  }, [isFetching, onLoadMore]);

  return { isFetching };
};

// Custom hook for optimistic updates
export const useOptimisticUpdate = <T>(
  initialData: T,
  updateFunction: (data: T, optimisticUpdate: Partial<T>) => T,
  revertFunction: (data: T, originalData: T) => T
) => {
  const [data, setData] = useState<T>(initialData);
  const [originalData, setOriginalData] = useState<T>(initialData);
  const [isOptimistic, setIsOptimistic] = useState(false);

  const applyOptimisticUpdate = useCallback((update: Partial<T>) => {
    setOriginalData(data);
    setData(prev => updateFunction(prev, update));
    setIsOptimistic(true);
  }, [data, updateFunction]);

  const confirmUpdate = useCallback((confirmedData: T) => {
    setData(confirmedData);
    setIsOptimistic(false);
  }, []);

  const revertUpdate = useCallback(() => {
    setData(prev => revertFunction(prev, originalData));
    setIsOptimistic(false);
  }, [originalData, revertFunction]);

  return {
    data,
    isOptimistic,
    applyOptimisticUpdate,
    confirmUpdate,
    revertUpdate,
  };
};

// Custom hook for batch operations with progress tracking
export const useBatchOperation = () => {
  const [operations, setOperations] = useState<Map<string, {
    id: string;
    type: string;
    progress: number;
    total: number;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    errors: string[];
  }>>(new Map());

  const startBatchOperation = useCallback((
    id: string,
    type: string,
    total: number
  ) => {
    setOperations(prev => new Map(prev).set(id, {
      id,
      type,
      progress: 0,
      total,
      status: 'pending',
      errors: [],
    }));
  }, []);

  const updateBatchProgress = useCallback((
    id: string,
    progress: number,
    errors: string[] = []
  ) => {
    setOperations(prev => {
      const newMap = new Map(prev);
      const operation = newMap.get(id);
      if (operation) {
        newMap.set(id, {
          ...operation,
          progress,
          status: progress >= operation.total ? 'completed' : 'processing',
          errors: [...operation.errors, ...errors],
        });
      }
      return newMap;
    });
  }, []);

  const failBatchOperation = useCallback((id: string, error: string) => {
    setOperations(prev => {
      const newMap = new Map(prev);
      const operation = newMap.get(id);
      if (operation) {
        newMap.set(id, {
          ...operation,
          status: 'failed',
          errors: [...operation.errors, error],
        });
      }
      return newMap;
    });
  }, []);

  const removeBatchOperation = useCallback((id: string) => {
    setOperations(prev => {
      const newMap = new Map(prev);
      newMap.delete(id);
      return newMap;
    });
  }, []);

  return {
    operations: Array.from(operations.values()),
    startBatchOperation,
    updateBatchProgress,
    failBatchOperation,
    removeBatchOperation,
  };
};

// Custom hook for performance monitoring
export const usePerformanceMonitor = (componentName: string) => {
  const renderCount = useRef(0);
  const renderTimes = useRef<number[]>([]);
  const startTime = useRef<number>(0);

  useEffect(() => {
    startTime.current = performance.now();
    renderCount.current += 1;

    return () => {
      const endTime = performance.now();
      const renderTime = endTime - startTime.current;
      renderTimes.current.push(renderTime);

      // Keep only last 100 render times
      if (renderTimes.current.length > 100) {
        renderTimes.current = renderTimes.current.slice(-100);
      }

      // Log performance warnings in development
      if (process.env.NODE_ENV === 'development') {
        if (renderTime > 16) { // 60fps threshold
          console.warn(`${componentName} render took ${renderTime.toFixed(2)}ms (>16ms)`);
        }

        if (renderCount.current % 50 === 0) {
          const avgRenderTime = renderTimes.current.reduce((a, b) => a + b, 0) / renderTimes.current.length;
          console.log(`${componentName} performance stats:`, {
            renders: renderCount.current,
            avgRenderTime: avgRenderTime.toFixed(2),
            lastRenderTime: renderTime.toFixed(2),
          });
        }
      }
    };
  });

  const getPerformanceStats = useCallback(() => ({
    renderCount: renderCount.current,
    avgRenderTime: renderTimes.current.length > 0 
      ? renderTimes.current.reduce((a, b) => a + b, 0) / renderTimes.current.length 
      : 0,
    lastRenderTime: renderTimes.current[renderTimes.current.length - 1] || 0,
  }), []);

  return { getPerformanceStats };
};

// Custom hook for memory usage monitoring
export const useMemoryMonitor = () => {
  const [memoryInfo, setMemoryInfo] = useState<{
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  } | null>(null);

  useEffect(() => {
    const updateMemoryInfo = () => {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        setMemoryInfo({
          usedJSHeapSize: memory.usedJSHeapSize,
          totalJSHeapSize: memory.totalJSHeapSize,
          jsHeapSizeLimit: memory.jsHeapSizeLimit,
        });
      }
    };

    updateMemoryInfo();
    const interval = setInterval(updateMemoryInfo, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, []);

  const getMemoryUsagePercentage = useCallback(() => {
    if (!memoryInfo) return 0;
    return (memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit) * 100;
  }, [memoryInfo]);

  return {
    memoryInfo,
    getMemoryUsagePercentage,
  };
};

// Custom hook for API caching with TTL
export const useApiCache = <T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = 300000 // 5 minutes default
) => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cache = useRef<Map<string, { data: T; timestamp: number }>>(new Map());

  const fetchData = useCallback(async (forceRefresh = false) => {
    const cached = cache.current.get(key);
    const now = Date.now();

    // Return cached data if valid and not forcing refresh
    if (!forceRefresh && cached && (now - cached.timestamp) < ttl) {
      setData(cached.data);
      return cached.data;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await fetcher();
      cache.current.set(key, { data: result, timestamp: now });
      setData(result);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [key, fetcher, ttl]);

  const invalidateCache = useCallback(() => {
    cache.current.delete(key);
  }, [key]);

  const clearAllCache = useCallback(() => {
    cache.current.clear();
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
    invalidateCache,
    clearAllCache,
  };
};

// Custom hook for enterprise-scale list management
export const useEnterpriseList = <T extends { id: string }>(
  initialItems: T[] = [],
  pageSize: number = 50
) => {
  const [items, setItems] = useState<T[]>(initialItems);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{
    key: keyof T;
    direction: 'asc' | 'desc';
  } | null>(null);

  // Memoized sorted and paginated items
  const processedItems = useMemo(() => {
    let sortedItems = [...items];

    // Apply sorting
    if (sortConfig) {
      sortedItems.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    return sortedItems;
  }, [items, sortConfig]);

  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return processedItems.slice(startIndex, startIndex + pageSize);
  }, [processedItems, currentPage, pageSize]);

  const totalPages = Math.ceil(processedItems.length / pageSize);

  const toggleSelection = useCallback((id: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedItems(new Set(paginatedItems.map(item => item.id)));
  }, [paginatedItems]);

  const clearSelection = useCallback(() => {
    setSelectedItems(new Set());
  }, []);

  const updateItem = useCallback((id: string, updates: Partial<T>) => {
    setItems(prev => prev.map(item => 
      item.id === id ? { ...item, ...updates } : item
    ));
  }, []);

  const removeItems = useCallback((ids: string[]) => {
    setItems(prev => prev.filter(item => !ids.includes(item.id)));
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      ids.forEach(id => newSet.delete(id));
      return newSet;
    });
  }, []);

  const sort = useCallback((key: keyof T, direction?: 'asc' | 'desc') => {
    setSortConfig(prev => ({
      key,
      direction: direction || (prev?.key === key && prev.direction === 'asc' ? 'desc' : 'asc'),
    }));
    setCurrentPage(1); // Reset to first page when sorting
  }, []);

  return {
    items: paginatedItems,
    allItems: processedItems,
    selectedItems: Array.from(selectedItems),
    selectedCount: selectedItems.size,
    currentPage,
    totalPages,
    totalItems: processedItems.length,
    sortConfig,
    setItems,
    setCurrentPage,
    toggleSelection,
    selectAll,
    clearSelection,
    updateItem,
    removeItems,
    sort,
  };
};

// Export all hooks
export {
  useInfiniteScroll,
  useOptimisticUpdate,
  useBatchOperation,
  usePerformanceMonitor,
  useMemoryMonitor,
  useApiCache,
  useEnterpriseList,
};
