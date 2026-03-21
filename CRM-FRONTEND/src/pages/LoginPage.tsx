import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import type { LoginRequest } from '@/types/auth';
import { LoadingPage } from '@/ui/components/Loading';
import { Button } from '@/ui/components/Button';
import { Card } from '@/ui/components/Card';
import { Input } from '@/ui/components/Input';
import { Badge } from '@/ui/components/Badge';
import { Page } from '@/ui/layout/Page';
import { Grid } from '@/ui/layout/Grid';
import { Section } from '@/ui/layout/Section';
import { Box } from '@/ui/primitives/Box';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  macAddress: z.string().optional(),
});

type LoginFormData = z.infer<typeof loginSchema>;

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated, isLoading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);


  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  useEffect(() => {
    // Check for logout reason in URL
    const params = new URLSearchParams(window.location.search);
    const reason = params.get('reason');
    if (reason) {
      toast.info(decodeURIComponent(reason));
      // Clean up URL to prevent toast repeating on refresh
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  const onSubmit = async (data: LoginFormData) => {
    setIsSubmitting(true);
    try {
      const success = await login(data as LoginRequest);
      if (success) {
        navigate('/dashboard');
      }
    } catch (error: unknown) {
      console.error('Login error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <LoadingPage title="Authenticating" description="Verifying your credentials..." />;
  }

  return (
    <Page>
      <Box className="ui-login-page">
        <Box className="ui-login-grid ui-stagger">
          <Card tone="highlight" className="ui-hero-panel">
            <Stack gap={5} style={{ height: '100%', justifyContent: 'space-between' }}>
              <Stack gap={5}>
              <Badge variant="accent">Premium Operations SaaS</Badge>
              <Stack gap={3}>
                <Text as="h1" variant="display">
                  CRM that feels executive, not utilitarian.
                </Text>
                <Text variant="body" tone="muted">
                  Review case flow, assign field work, and control turnaround with a single disciplined command surface.
                </Text>
              </Stack>
              <Grid min={180}>
                <Card tone="strong">
                  <Stack gap={2}>
                    <Text variant="label" tone="soft">Case velocity</Text>
                    <Text variant="headline">Unified task flow</Text>
                    <Text variant="body-sm" tone="muted">Assignment, review, and completion on one surface.</Text>
                  </Stack>
                </Card>
                <Card tone="strong">
                  <Stack gap={2}>
                    <Text variant="label" tone="soft">Operator clarity</Text>
                    <Text variant="headline">Tighter signals</Text>
                    <Text variant="body-sm" tone="muted">Priorities, status, and action areas stay visually consistent.</Text>
                  </Stack>
                </Card>
              </Grid>
              </Stack>
              <Card tone="strong">
                <Stack gap={2}>
                  <Text variant="label" tone="soft">Brand promise</Text>
                  <Text variant="headline">Clarity under operational pressure.</Text>
                  <Text variant="body-sm" tone="muted">
                    A premium admin workspace with stronger hierarchy, calmer decisions, and tighter execution flow.
                  </Text>
                </Stack>
              </Card>
            </Stack>
          </Card>

          <Card tone="strong">
            <Section>
              <Stack gap={4}>
                <Badge variant="neutral">Access portal</Badge>
                <Stack gap={2}>
                  <Text as="h2" variant="headline">Sign in</Text>
                  <Text variant="body-sm" tone="muted">
                    Enter your credentials to access the admin workspace.
                  </Text>
                </Stack>
              </Stack>
            </Section>

            <form onSubmit={handleSubmit(onSubmit)}>
              <Stack gap={4}>
                <Stack gap={2}>
                  <Text as="label" htmlFor="username" variant="label" tone="soft">Username</Text>
                  <Input
                    id="username"
                    type="text"
                    placeholder="Enter your username"
                    {...register('username')}
                    invalid={Boolean(errors.username)}
                  />
                  {errors.username ? <Text variant="caption" tone="danger">{errors.username.message}</Text> : null}
                </Stack>

                <Stack gap={2}>
                  <Text as="label" htmlFor="password" variant="label" tone="soft">Password</Text>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    {...register('password')}
                    invalid={Boolean(errors.password)}
                  />
                  {errors.password ? <Text variant="caption" tone="danger">{errors.password.message}</Text> : null}
                </Stack>

                <Button type="submit" fullWidth disabled={isSubmitting}>
                  {isSubmitting ? 'Signing in...' : 'Enter workspace'}
                </Button>
              </Stack>
            </form>
          </Card>
        </Box>
      </Box>
    </Page>
  );
};
