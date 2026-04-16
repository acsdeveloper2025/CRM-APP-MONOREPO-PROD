import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { LoginRequest } from '@/types/auth';
import { LoadingPage } from '@/components/ui/loading';
import { logger } from '@/utils/logger';

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
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  const [loginError, setLoginError] = useState<string>('');

  const onSubmit = async (data: LoginFormData) => {
    setIsSubmitting(true);
    setLoginError('');
    try {
      const success = await login(data as LoginRequest);
      if (success) {
        navigate('/');
      }
    } catch (error: unknown) {
      logger.error('Login error:', error);
      // Extract error message from API response
      const axiosErr = error as {
        response?: {
          data?: { message?: string; error?: { code?: string; retryAfterSeconds?: number } };
        };
      };
      const code = axiosErr.response?.data?.error?.code;
      if (code === 'ACCOUNT_LOCKED') {
        const retryMin = Math.ceil((axiosErr.response?.data?.error?.retryAfterSeconds || 900) / 60);
        setLoginError(`Account temporarily locked. Try again in ${retryMin} minutes.`);
      } else if (code === 'RATE_LIMIT_EXCEEDED') {
        setLoginError('Too many login attempts. Please wait and try again.');
      } else {
        setLoginError(axiosErr.response?.data?.message || 'Invalid credentials. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <LoadingPage title="Authenticating" description="Verifying your credentials..." />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">CRM Admin Dashboard</h2>
          <p className="mt-2 text-sm text-gray-600">Sign in to your account</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
            <CardDescription>Enter your credentials to access the admin dashboard</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter your username"
                  {...register('username')}
                  className={errors.username ? 'border-red-500' : ''}
                />
                {errors.username && (
                  <p className="text-sm text-red-500">{errors.username.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  {...register('password')}
                  className={errors.password ? 'border-red-500' : ''}
                />
                {errors.password && (
                  <p className="text-sm text-red-500">{errors.password.message}</p>
                )}
              </div>

              {loginError && (
                <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md">
                  {loginError}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
