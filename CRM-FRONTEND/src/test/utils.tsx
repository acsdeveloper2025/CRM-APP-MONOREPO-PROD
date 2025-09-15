import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';

// Mock data for testing
export const mockUser = {
  id: '550e8400-e29b-41d4-a716-446655440001',
  name: 'Test User',
  username: 'testuser',
  email: 'test@example.com',
  role: 'ADMIN',
  employeeId: 'EMP001',
  isActive: true,
  lastLogin: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

// Mock case data removed - use empty object for tests
export const mockCase = {};

export const mockClient = {
  id: 1,
  name: 'Test Bank Ltd',
  code: 'TBL001',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

// Mock AuthContext
export const mockAuthContext = {
  user: mockUser,
  login: vi.fn(),
  logout: vi.fn(),
  isAuthenticated: true,
  isLoading: false,
  updateUser: vi.fn()
};

// Mock API responses
export const mockApiResponse = {
  success: true,
  data: {},
  message: 'Success'
};

// Create a test query client
const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      gcTime: 0,
    },
    mutations: {
      retry: false,
    },
  },
});

// Custom render function with providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  queryClient?: QueryClient;
  initialEntries?: string[];
  user?: typeof mockUser;
}

export function renderWithProviders(
  ui: ReactElement,
  {
    queryClient = createTestQueryClient(),
    initialEntries = ['/'],
    user = mockUser,
    ...renderOptions
  }: CustomRenderOptions = {}
) {
  // Mock AuthContext Provider
  const MockAuthProvider = ({ children }: { children: React.ReactNode }) => {
    const contextValue = {
      ...mockAuthContext,
      user
    };
    
    return (
      <div data-testid="mock-auth-provider">
        {React.cloneElement(children as ReactElement, { authContext: contextValue })}
      </div>
    );
  };

  function Wrapper({ children }: { children?: React.ReactNode }) {
    return (
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <MockAuthProvider>
            {children}
          </MockAuthProvider>
        </QueryClientProvider>
      </BrowserRouter>
    );
  }

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    queryClient,
  };
}

// Test wrapper component for simple cases
export function TestWrapper({ 
  children, 
  queryClient = createTestQueryClient() 
}: { 
  children: React.ReactNode;
  queryClient?: QueryClient;
}) {
  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </BrowserRouter>
  );
}

// Mock fetch responses
export function mockFetch(response: any, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(response),
    text: vi.fn().mockResolvedValue(JSON.stringify(response)),
    headers: new Headers(),
  });
}

// Mock API service
export const mockApiService = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
};

// Mock WebSocket
export function mockWebSocket() {
  const mockWs = {
    send: vi.fn(),
    close: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    readyState: 1,
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3,
  };

  return mockWs;
}

// Helper to wait for async operations
export function waitFor(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Mock file for file upload tests
export function createMockFile(
  name = 'test.jpg',
  size = 1024,
  type = 'image/jpeg'
): File {
  const file = new File(['test content'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

// Mock form data
export const mockFormData = {
  customerName: 'John Doe',
  customerPhone: '9876543210',
  address: '123 Test Street',
  clientId: 1,
  verificationType: 'RESIDENCE'
};

// Mock navigation
export const mockNavigate = vi.fn();
export const mockLocation = {
  pathname: '/',
  search: '',
  hash: '',
  state: null,
  key: 'default'
};

// Mock router hooks
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => mockLocation,
  };
});

// Mock toast notifications
export const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
};

// Mock date functions for consistent testing
export function mockDate(date: string | Date) {
  const mockDateValue = new Date(date);
  vi.setSystemTime(mockDateValue);
  return mockDateValue;
}

// Cleanup function for tests
export function cleanupMocks() {
  vi.clearAllMocks();
  vi.clearAllTimers();
  vi.useRealTimers();
}

// Custom matchers for better assertions
export const customMatchers = {
  toBeInTheDocument: expect.any(Function),
  toHaveClass: expect.any(Function),
  toHaveAttribute: expect.any(Function),
  toHaveValue: expect.any(Function),
  toBeVisible: expect.any(Function),
  toBeDisabled: expect.any(Function),
  toBeEnabled: expect.any(Function),
};

// Export everything for easy importing
export * from '@testing-library/react';
export * from '@testing-library/user-event';
export { vi } from 'vitest';
