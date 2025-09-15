import React, { useState } from 'react';
import { Shield, Smartphone, Monitor, Palette, AlertTriangle, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useTheme } from '@/contexts/ThemeContext';
import { useResponsive } from '@/hooks/useResponsive';
import { useErrorHandling } from '@/hooks/useErrorHandling';
import { LoadingSpinner, LoadingOverlay, LoadingCard, LoadingSkeleton, LoadingButton } from '@/components/ui/loading';
import { SecurityUtils } from '@/utils/security';
import toast from 'react-hot-toast';

export function SecurityUXPage() {
  const { theme, actualTheme, setTheme, toggleTheme } = useTheme();
  const { currentBreakpoint, isMobile, isTablet, isDesktop, windowSize } = useResponsive();
  const { errors, isLoading, handleError, handleAsyncOperation, clearErrors } = useErrorHandling();
  
  const [demoLoading, setDemoLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [testInput, setTestInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');

  // Demo functions
  const simulateError = () => {
    const error = new Error('This is a simulated error for demonstration');
    handleError(error, { context: 'Demo Error Simulation' });
  };

  const simulateAsyncOperation = async () => {
    await handleAsyncOperation(async () => {
      await new Promise(resolve => setTimeout(resolve, 2000));
      throw new Error('Async operation failed');
    }, { context: 'Async Demo' });
  };

  const simulateLoading = () => {
    setDemoLoading(true);
    setTimeout(() => {
      setDemoLoading(false);
      toast.success('Loading completed!');
    }, 3000);
  };

  const testSecurity = () => {
    const results = {
      isValidEmail: SecurityUtils.isValidEmail(testInput),
      isValidUrl: SecurityUtils.isValidUrl(testInput),
      containsSuspicious: SecurityUtils.containsSuspiciousContent(testInput),
      sanitized: SecurityUtils.escapeHtml(testInput),
    };
    
    toast.info('Security test completed', {
      description: `Valid email: ${results.isValidEmail}, Valid URL: ${results.isValidUrl}`,
    });
  };

  const testPasswordStrength = () => {
    const result = SecurityUtils.validatePasswordStrength(passwordInput);
    toast.info(`Password strength: ${result.score}/5`, {
      description: result.feedback.join(', ') || 'Strong password!',
    });
  };

  const browserSecurity = SecurityUtils.checkBrowserSecurity();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Security & UX Enhancements</h1>
          <p className="text-muted-foreground">
            Comprehensive security features, error handling, and user experience improvements
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="outline">
            {currentBreakpoint.toUpperCase()}
          </Badge>
          <Badge variant={actualTheme === 'dark' ? 'default' : 'secondary'}>
            {actualTheme} theme
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="theme" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="theme">
            <Palette className="h-4 w-4 mr-2" />
            Theme
          </TabsTrigger>
          <TabsTrigger value="responsive">
            <Monitor className="h-4 w-4 mr-2" />
            Responsive
          </TabsTrigger>
          <TabsTrigger value="loading">
            <RefreshCw className="h-4 w-4 mr-2" />
            Loading
          </TabsTrigger>
          <TabsTrigger value="errors">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Errors
          </TabsTrigger>
          <TabsTrigger value="security">
            <Shield className="h-4 w-4 mr-2" />
            Security
          </TabsTrigger>
        </TabsList>

        {/* Theme Management */}
        <TabsContent value="theme" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Theme Controls</CardTitle>
                <CardDescription>
                  Manage application theme and appearance
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Current Theme:</span>
                  <Badge variant="outline">{theme}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Actual Theme:</span>
                  <Badge variant={actualTheme === 'dark' ? 'default' : 'secondary'}>
                    {actualTheme}
                  </Badge>
                </div>
                
                <div className="space-y-2">
                  <Button onClick={() => setTheme('light')} variant="outline" className="w-full">
                    Light Theme
                  </Button>
                  <Button onClick={() => setTheme('dark')} variant="outline" className="w-full">
                    Dark Theme
                  </Button>
                  <Button onClick={() => setTheme('system')} variant="outline" className="w-full">
                    System Theme
                  </Button>
                  <Button onClick={toggleTheme} className="w-full">
                    Toggle Theme
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Theme Preview</CardTitle>
                <CardDescription>
                  See how different components look in current theme
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">Sample Content</h4>
                  <p className="text-muted-foreground mb-3">
                    This is how text appears in the current theme.
                  </p>
                  <div className="flex space-x-2">
                    <Button size="sm">Primary</Button>
                    <Button size="sm" variant="outline">Outline</Button>
                    <Button size="sm" variant="secondary">Secondary</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Responsive Design */}
        <TabsContent value="responsive" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Responsive Information</CardTitle>
                <CardDescription>
                  Current device and breakpoint information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Breakpoint:</span>
                    <Badge variant="outline" className="ml-2">{currentBreakpoint}</Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Device:</span>
                    <Badge variant="outline" className="ml-2">
                      {isMobile ? 'Mobile' : isTablet ? 'Tablet' : 'Desktop'}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Width:</span>
                    <span className="ml-2 font-mono">{windowSize.width}px</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Height:</span>
                    <span className="ml-2 font-mono">{windowSize.height}px</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Responsive Grid</CardTitle>
                <CardDescription>
                  Grid that adapts to screen size
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                    <div key={i} className="h-16 bg-muted rounded-lg flex items-center justify-center">
                      {i}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Loading States */}
        <TabsContent value="loading" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Loading Components</CardTitle>
                <CardDescription>
                  Various loading states and spinners
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center space-x-4">
                    <LoadingSpinner size="sm" />
                    <span>Small spinner</span>
                  </div>
                  <div className="flex items-center space-x-4">
                    <LoadingSpinner size="md" variant="dots" />
                    <span>Dots variant</span>
                  </div>
                  <div className="flex items-center space-x-4">
                    <LoadingSpinner size="lg" variant="pulse" />
                    <span>Pulse variant</span>
                  </div>
                </div>
                
                <LoadingButton
                  isLoading={demoLoading}
                  onClick={simulateLoading}
                  loadingText="Processing..."
                >
                  Start Loading Demo
                </LoadingButton>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Loading Skeletons</CardTitle>
                <CardDescription>
                  Skeleton loaders for better UX
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <LoadingSkeleton variant="text" lines={3} />
                <div className="flex items-center space-x-3">
                  <LoadingSkeleton variant="circular" width="40px" height="40px" />
                  <LoadingSkeleton variant="text" lines={2} />
                </div>
                <LoadingSkeleton variant="rectangular" height="100px" />
              </CardContent>
            </Card>
          </div>

          <LoadingOverlay isLoading={demoLoading} loadingText="Demo in progress...">
            <LoadingCard title="Sample Loading Card" description="This shows how loading states work" />
          </LoadingOverlay>
        </TabsContent>

        {/* Error Handling */}
        <TabsContent value="errors" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Error Simulation</CardTitle>
                <CardDescription>
                  Test error handling and display
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button onClick={simulateError} variant="destructive" className="w-full">
                  Simulate Error
                </Button>
                <Button onClick={simulateAsyncOperation} variant="outline" className="w-full">
                  Simulate Async Error
                </Button>
                <Button onClick={clearErrors} variant="secondary" className="w-full">
                  Clear Errors
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Errors</CardTitle>
                <CardDescription>
                  {errors.length} error(s) logged
                </CardDescription>
              </CardHeader>
              <CardContent>
                {errors.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No errors logged</p>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {errors.slice(0, 3).map((error) => (
                      <div key={error.timestamp} className="p-2 bg-destructive/10 rounded text-sm">
                        <div className="font-medium">{error.code}</div>
                        <div className="text-muted-foreground">{error.message}</div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Security Features */}
        <TabsContent value="security" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Input Validation</CardTitle>
                <CardDescription>
                  Test security validation features
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Input
                    placeholder="Test email, URL, or suspicious content"
                    value={testInput}
                    onChange={(e) => setTestInput(e.target.value)}
                  />
                  <Button onClick={testSecurity} className="w-full">
                    Test Security Validation
                  </Button>
                </div>
                
                <div className="space-y-2">
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Test password strength"
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <Button onClick={testPasswordStrength} className="w-full">
                    Test Password Strength
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Browser Security</CardTitle>
                <CardDescription>
                  Current browser security capabilities
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  {Object.entries(browserSecurity).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between">
                      <span className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
                      <Badge variant={value ? 'default' : 'destructive'}>
                        {value ? 'Yes' : 'No'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
