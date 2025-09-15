import { configureStore, createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Case } from '../types/case';
import { User } from '../types/user';
import { apiClient } from '../services/apiClient';

// Enterprise-scale state interfaces
interface CaseState {
  items: Case[];
  totalCount: number;
  loading: boolean;
  error: string | null;
  currentPage: number;
  hasMore: boolean;
  filters: CaseFilters;
  searchQuery: string;
  selectedCases: string[];
  bulkOperationStatus: BulkOperationStatus | null;
  cache: {
    [key: string]: {
      data: Case[];
      timestamp: number;
      totalCount: number;
    };
  };
}

interface UserState {
  currentUser: User | null;
  fieldAgents: User[];
  loading: boolean;
  error: string | null;
  workloadData: FieldAgentWorkload[];
}

interface UIState {
  sidebarCollapsed: boolean;
  theme: 'light' | 'dark';
  notifications: Notification[];
  activeModal: string | null;
  bulkAssignmentModal: {
    isOpen: boolean;
    selectedCases: string[];
    assignToUser: string | null;
  };
}

interface CacheState {
  apiCache: {
    [endpoint: string]: {
      data: any;
      timestamp: number;
      ttl: number;
    };
  };
  invalidationPatterns: string[];
}

interface CaseFilters {
  status?: string;
  priority?: string;
  assignedTo?: string;
  dateRange?: {
    from: Date;
    to: Date;
  };
}

interface BulkOperationStatus {
  id: string;
  type: 'assign' | 'update' | 'delete';
  progress: number;
  total: number;
  completed: number;
  failed: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  errors: string[];
}

interface FieldAgentWorkload {
  userId: string;
  userName: string;
  assignedCases: number;
  completedCases: number;
  pendingCases: number;
  workloadPercentage: number;
}

interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  actions?: Array<{
    label: string;
    action: () => void;
  }>;
}

// Async thunks for enterprise operations
export const fetchCases = createAsyncThunk(
  'cases/fetchCases',
  async (params: {
    page?: number;
    limit?: number;
    filters?: CaseFilters;
    search?: string;
    useCache?: boolean;
  }) => {
    const { page = 1, limit = 50, filters = {}, search = '', useCache = true } = params;
    
    const queryParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      search,
      useCache: useCache.toString(),
      ...Object.fromEntries(
        Object.entries(filters).filter(([_, value]) => value !== undefined && value !== '')
      ),
    });

    const response = await apiClient.get(`/api/cases?${queryParams}`);
    return {
      cases: response.data.data,
      totalCount: response.data.pagination.total,
      page,
      hasMore: response.data.pagination.page < response.data.pagination.totalPages,
      metadata: response.data.metadata,
    };
  }
);

export const bulkAssignCases = createAsyncThunk(
  'cases/bulkAssign',
  async (params: { caseIds: string[]; assignToUserId: string }) => {
    const response = await apiClient.post('/api/cases/bulk/assign', {
      caseIds: params.caseIds,
      assignToUserId: params.assignToUserId,
    });
    return response.data;
  }
);

export const fetchBulkOperationStatus = createAsyncThunk(
  'cases/fetchBulkOperationStatus',
  async (batchId: string) => {
    const response = await apiClient.get(`/api/cases/bulk/assign/${batchId}/status`);
    return response.data;
  }
);

export const fetchFieldAgentWorkload = createAsyncThunk(
  'users/fetchFieldAgentWorkload',
  async () => {
    const response = await apiClient.get('/api/cases/analytics/field-agent-workload');
    return response.data.data;
  }
);

// Cases slice
const casesSlice = createSlice({
  name: 'cases',
  initialState: {
    items: [],
    totalCount: 0,
    loading: false,
    error: null,
    currentPage: 1,
    hasMore: true,
    filters: {},
    searchQuery: '',
    selectedCases: [],
    bulkOperationStatus: null,
    cache: {},
  } as CaseState,
  reducers: {
    setFilters: (state, action: PayloadAction<CaseFilters>) => {
      state.filters = action.payload;
      state.currentPage = 1;
      state.items = [];
      state.hasMore = true;
    },
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
      state.currentPage = 1;
      state.items = [];
      state.hasMore = true;
    },
    toggleCaseSelection: (state, action: PayloadAction<string>) => {
      const caseId = action.payload;
      const index = state.selectedCases.indexOf(caseId);
      if (index > -1) {
        state.selectedCases.splice(index, 1);
      } else {
        state.selectedCases.push(caseId);
      }
    },
    selectAllCases: (state) => {
      state.selectedCases = state.items.map(case_ => case_.id);
    },
    clearCaseSelection: (state) => {
      state.selectedCases = [];
    },
    updateCaseInList: (state, action: PayloadAction<Case>) => {
      const index = state.items.findIndex(case_ => case_.id === action.payload.id);
      if (index > -1) {
        state.items[index] = action.payload;
      }
    },
    invalidateCache: (state, action: PayloadAction<string[]>) => {
      action.payload.forEach(pattern => {
        Object.keys(state.cache).forEach(key => {
          if (key.includes(pattern)) {
            delete state.cache[key];
          }
        });
      });
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCases.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCases.fulfilled, (state, action) => {
        state.loading = false;
        const { cases, totalCount, page, hasMore, metadata } = action.payload;
        
        if (page === 1) {
          state.items = cases;
        } else {
          // Append for pagination
          state.items = [...state.items, ...cases];
        }
        
        state.totalCount = totalCount;
        state.currentPage = page;
        state.hasMore = hasMore;
        
        // Cache the results
        const cacheKey = `${page}-${JSON.stringify(state.filters)}-${state.searchQuery}`;
        state.cache[cacheKey] = {
          data: cases,
          timestamp: Date.now(),
          totalCount,
        };
      })
      .addCase(fetchCases.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch cases';
      })
      .addCase(bulkAssignCases.pending, (state) => {
        state.bulkOperationStatus = {
          id: 'temp',
          type: 'assign',
          progress: 0,
          total: state.selectedCases.length,
          completed: 0,
          failed: 0,
          status: 'pending',
          errors: [],
        };
      })
      .addCase(bulkAssignCases.fulfilled, (state, action) => {
        state.bulkOperationStatus = {
          id: action.payload.batchId,
          type: 'assign',
          progress: 0,
          total: state.selectedCases.length,
          completed: 0,
          failed: 0,
          status: 'processing',
          errors: [],
        };
        // Clear selection after successful submission
        state.selectedCases = [];
      })
      .addCase(fetchBulkOperationStatus.fulfilled, (state, action) => {
        state.bulkOperationStatus = action.payload;
      });
  },
});

// Users slice
const usersSlice = createSlice({
  name: 'users',
  initialState: {
    currentUser: null,
    fieldAgents: [],
    loading: false,
    error: null,
    workloadData: [],
  } as UserState,
  reducers: {
    setCurrentUser: (state, action: PayloadAction<User>) => {
      state.currentUser = action.payload;
    },
    clearCurrentUser: (state) => {
      state.currentUser = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchFieldAgentWorkload.fulfilled, (state, action) => {
        state.workloadData = action.payload;
      });
  },
});

// UI slice
const uiSlice = createSlice({
  name: 'ui',
  initialState: {
    sidebarCollapsed: false,
    theme: 'light',
    notifications: [],
    activeModal: null,
    bulkAssignmentModal: {
      isOpen: false,
      selectedCases: [],
      assignToUser: null,
    },
  } as UIState,
  reducers: {
    toggleSidebar: (state) => {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    },
    setTheme: (state, action: PayloadAction<'light' | 'dark'>) => {
      state.theme = action.payload;
    },
    addNotification: (state, action: PayloadAction<Omit<Notification, 'id' | 'timestamp'>>) => {
      const notification: Notification = {
        ...action.payload,
        id: Date.now().toString(),
        timestamp: Date.now(),
        read: false,
      };
      state.notifications.unshift(notification);
      
      // Keep only last 50 notifications
      if (state.notifications.length > 50) {
        state.notifications = state.notifications.slice(0, 50);
      }
    },
    markNotificationAsRead: (state, action: PayloadAction<string>) => {
      const notification = state.notifications.find(n => n.id === action.payload);
      if (notification) {
        notification.read = true;
      }
    },
    removeNotification: (state, action: PayloadAction<string>) => {
      state.notifications = state.notifications.filter(n => n.id !== action.payload);
    },
    openModal: (state, action: PayloadAction<string>) => {
      state.activeModal = action.payload;
    },
    closeModal: (state) => {
      state.activeModal = null;
    },
    openBulkAssignmentModal: (state, action: PayloadAction<{ selectedCases: string[] }>) => {
      state.bulkAssignmentModal = {
        isOpen: true,
        selectedCases: action.payload.selectedCases,
        assignToUser: null,
      };
    },
    closeBulkAssignmentModal: (state) => {
      state.bulkAssignmentModal = {
        isOpen: false,
        selectedCases: [],
        assignToUser: null,
      };
    },
    setBulkAssignmentUser: (state, action: PayloadAction<string>) => {
      state.bulkAssignmentModal.assignToUser = action.payload;
    },
  },
});

// Cache slice for API response caching
const cacheSlice = createSlice({
  name: 'cache',
  initialState: {
    apiCache: {},
    invalidationPatterns: [],
  } as CacheState,
  reducers: {
    setCacheData: (state, action: PayloadAction<{
      endpoint: string;
      data: any;
      ttl: number;
    }>) => {
      const { endpoint, data, ttl } = action.payload;
      state.apiCache[endpoint] = {
        data,
        timestamp: Date.now(),
        ttl,
      };
    },
    invalidateCache: (state, action: PayloadAction<string[]>) => {
      action.payload.forEach(pattern => {
        Object.keys(state.apiCache).forEach(endpoint => {
          if (endpoint.includes(pattern)) {
            delete state.apiCache[endpoint];
          }
        });
      });
    },
    clearExpiredCache: (state) => {
      const now = Date.now();
      Object.keys(state.apiCache).forEach(endpoint => {
        const cached = state.apiCache[endpoint];
        if (now - cached.timestamp > cached.ttl) {
          delete state.apiCache[endpoint];
        }
      });
    },
  },
});

// Configure enterprise store
export const enterpriseStore = configureStore({
  reducer: {
    cases: casesSlice.reducer,
    users: usersSlice.reducer,
    ui: uiSlice.reducer,
    cache: cacheSlice.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['ui/addNotification'],
        ignoredPaths: ['ui.notifications.actions'],
      },
    }),
  devTools: process.env.NODE_ENV !== 'production',
});

export type RootState = ReturnType<typeof enterpriseStore.getState>;
export type AppDispatch = typeof enterpriseStore.dispatch;

// Export actions
export const {
  setFilters,
  setSearchQuery,
  toggleCaseSelection,
  selectAllCases,
  clearCaseSelection,
  updateCaseInList,
  invalidateCache: invalidateCasesCache,
} = casesSlice.actions;

export const {
  setCurrentUser,
  clearCurrentUser,
} = usersSlice.actions;

export const {
  toggleSidebar,
  setTheme,
  addNotification,
  markNotificationAsRead,
  removeNotification,
  openModal,
  closeModal,
  openBulkAssignmentModal,
  closeBulkAssignmentModal,
  setBulkAssignmentUser,
} = uiSlice.actions;

export const {
  setCacheData,
  invalidateCache,
  clearExpiredCache,
} = cacheSlice.actions;
