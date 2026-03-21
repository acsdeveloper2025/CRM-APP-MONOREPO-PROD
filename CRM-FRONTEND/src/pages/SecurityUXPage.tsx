import { useState } from 'react';
import { Shield, Monitor, Palette, AlertTriangle, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader } from '@/ui/components/Card';
import { Button } from '@/ui/components/Button';
import { Input } from '@/ui/components/Input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/components/Tabs';
import { Badge } from '@/ui/components/Badge';
import { useTheme } from '@/hooks/useTheme';
import { useResponsive } from '@/hooks/useResponsive';
import { useErrorHandling } from '@/hooks/useErrorHandling';
import { LoadingSpinner, LoadingOverlay, LoadingCard, LoadingSkeleton, LoadingButton } from '@/ui/components/Loading';
import { SecurityUtils } from '@/utils/security';
import { toast } from 'sonner';
import { MetricCardGrid } from '@/components/shared/MetricCardGrid';
import { Page } from '@/ui/layout/Page';
import { Section } from '@/ui/layout/Section';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';

export function SecurityUXPage() {
  const { theme, actualTheme, setTheme, toggleTheme } = useTheme();
  const { isMobile, isTablet, isDesktop: _isDesktop, windowSize } = useResponsive();
  const { errors, isLoading: _isLoading, handleError, handleAsyncOperation, clearErrors } = useErrorHandling();

  const currentBreakpoint = isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop';

  const [demoLoading, setDemoLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [testInput, setTestInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');

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
    <Page
      title="Security & UX Enhancements"
      subtitle="Security demos, error handling, and user-experience resilience checks in one workspace."
      shell
    >
      <Section>
        <MetricCardGrid
          items={[
            { title: 'Breakpoint', value: currentBreakpoint.toUpperCase(), detail: `${windowSize.width}px × ${windowSize.height}px`, icon: Monitor, tone: 'accent' },
            { title: 'Theme', value: actualTheme, detail: `Preference: ${theme}`, icon: Palette, tone: 'neutral' },
            { title: 'Logged Errors', value: errors.length, detail: errors.length ? 'Recent issues captured' : 'No active errors', icon: AlertTriangle, tone: 'warning' },
            { title: 'Browser Security', value: Object.values(browserSecurity).filter(Boolean).length, detail: 'Capabilities detected', icon: Shield, tone: 'positive' },
          ]}
          min={220}
        />
      </Section>

      <Section>
        <Stack gap={3}>
          <Badge variant="accent">Resilience Lab</Badge>
          <Text as="h2" variant="headline">Keep theme, loading, security, and error demonstrations under the shared shell.</Text>
          <Text variant="body-sm" tone="muted">
            The underlying demo actions stay the same; only the page composition is standardized.
          </Text>
        </Stack>
      </Section>

      <Section className="ui-stagger">
        <Card>
          <CardContent className="pt-6">
            <Tabs defaultValue="theme" className="space-y-4">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="theme"><Palette className="h-4 w-4 mr-2" />Theme</TabsTrigger>
                <TabsTrigger value="responsive"><Monitor className="h-4 w-4 mr-2" />Responsive</TabsTrigger>
                <TabsTrigger value="loading"><RefreshCw className="h-4 w-4 mr-2" />Loading</TabsTrigger>
                <TabsTrigger value="errors"><AlertTriangle className="h-4 w-4 mr-2" />Errors</TabsTrigger>
                <TabsTrigger value="security"><Shield className="h-4 w-4 mr-2" />Security</TabsTrigger>
              </TabsList>

              <TabsContent value="theme" className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <Text variant="headline">Theme Controls</Text>
                      <Text variant="body-sm" tone="muted">Manage application theme and appearance</Text>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Stack direction="horizontal" justify="space-between" align="center">
                        <Text variant="body-sm">Current Theme:</Text>
                        <Badge variant="outline">{theme}</Badge>
                      </Stack>
                      <Stack direction="horizontal" justify="space-between" align="center">
                        <Text variant="body-sm">Actual Theme:</Text>
                        <Badge variant={actualTheme === 'dark' ? 'accent' : 'secondary'}>{actualTheme}</Badge>
                      </Stack>
                      <Stack gap={2}>
                        <Button onClick={() => setTheme('light')} variant="outline">Light Theme</Button>
                        <Button onClick={() => setTheme('dark')} variant="outline">Dark Theme</Button>
                        <Button onClick={() => setTheme('system')} variant="outline">System Theme</Button>
                        <Button onClick={toggleTheme}>Toggle Theme</Button>
                      </Stack>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
               <TabsContent value="responsive" className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <Text variant="headline">Responsive Information</Text>
                      <Text variant="body-sm" tone="muted">Current device and breakpoint information</Text>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <Stack direction="horizontal" gap={2} align="center">
                          <Text variant="body-sm" tone="muted">Breakpoint:</Text>
                          <Badge variant="outline">{currentBreakpoint}</Badge>
                        </Stack>
                        <Stack direction="horizontal" gap={2} align="center">
                          <Text variant="body-sm" tone="muted">Device:</Text>
                          <Badge variant="outline">{isMobile ? 'Mobile' : isTablet ? 'Tablet' : 'Desktop'}</Badge>
                        </Stack>
                        <Stack direction="horizontal" gap={2} align="center">
                          <Text variant="body-sm" tone="muted">Width:</Text>
                          <Text variant="body-sm" className="font-mono">{windowSize.width}px</Text>
                        </Stack>
                        <Stack direction="horizontal" gap={2} align="center">
                          <Text variant="body-sm" tone="muted">Height:</Text>
                          <Text variant="body-sm" className="font-mono">{windowSize.height}px</Text>
                        </Stack>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <Text variant="headline">Responsive Grid</Text>
                      <Text variant="body-sm" tone="muted">Grid that adapts to screen size</Text>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                          <div key={i} className="h-16 bg-content-accent/5 rounded-lg flex items-center justify-center font-medium border border-content-accent/10">{i}</div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="loading" className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <Text variant="headline">Loading Components</Text>
                      <Text variant="body-sm" tone="muted">Various loading states and spinners</Text>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-3">
                        <div className="flex items-center space-x-4"><LoadingSpinner size="sm" /><span>Small spinner</span></div>
                        <div className="flex items-center space-x-4"><LoadingSpinner size="md" variant="dots" /><span>Dots variant</span></div>
                        <div className="flex items-center space-x-4"><LoadingSpinner size="lg" variant="pulse" /><span>Pulse variant</span></div>
                      </div>
                      <LoadingButton isLoading={demoLoading} onClick={simulateLoading} loadingText="Processing...">
                        Start Loading Demo
                      </LoadingButton>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <Text variant="headline">Loading Skeletons</Text>
                      <Text variant="body-sm" tone="muted">Skeleton loaders for better UX</Text>
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

              <TabsContent value="errors" className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <Text variant="headline">Error Simulation</Text>
                      <Text variant="body-sm" tone="muted">Test error handling and display</Text>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Button onClick={simulateError} variant="destructive" className="w-full">Simulate Error</Button>
                      <Button onClick={simulateAsyncOperation} variant="outline" className="w-full">Simulate Async Error</Button>
                      <Button onClick={clearErrors} variant="secondary" className="w-full">Clear Errors</Button>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <Text variant="headline">Recent Errors</Text>
                      <Text variant="body-sm" tone="muted">{errors.length} error(s) logged</Text>
                    </CardHeader>
                    <CardContent>
                      {errors.length === 0 ? (
                        <Text variant="body-sm" tone="muted">No errors logged</Text>
                      ) : (
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {errors.slice(0, 3).map((error) => (
                            <div key={error.timestamp} className="p-2 bg-destructive/10 rounded text-sm">
                              <div className="font-medium">{error.code}</div>
                              <div className="text-gray-600">{error.message}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>


              <TabsContent value="security" className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <Text variant="headline">Input Validation</Text>
                      <Text variant="body-sm" tone="muted">Test security validation features</Text>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Input
                          placeholder="Test email, URL, or suspicious content"
                          value={testInput}
                          onChange={(e) => setTestInput(e.target.value)}
                        />
                        <Button onClick={testSecurity} className="w-full">Test Security Validation</Button>
                      </div>

                      <div className="space-y-2">
                        <div className="relative">
                          <Input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Test password strength"
                            value={passwordInput}
                            onChange={(e) => setPasswordInput(e.target.value)}
                          />
                          <button
                            type="button"
                            className="absolute right-0 top-0 h-full px-3 flex items-center justify-center opacity-70 hover:opacity-100 transition-opacity"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        <Button onClick={testPasswordStrength} className="w-full">Test Password Strength</Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <Text variant="headline">Browser Security</Text>
                      <Text variant="body-sm" tone="muted">Current browser security capabilities</Text>
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
          </CardContent>
        </Card>
      </Section>
    </Page>
  );
}
