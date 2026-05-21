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
  const { login, completeMfaLogin, isAuthenticated, isLoading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  // T1-2: when BE returns mfaRequired, swap from password screen to a
  // code-entry screen. Holding the challenge in component state means
  // refreshing the tab dumps you back to the password screen — that is
  // intentional and matches the BE's 5min challenge TTL.
  const [mfaChallenge, setMfaChallenge] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState<string>('');

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
      const result = await login(data as LoginRequest);
      if (result.status === 'ok') {
        navigate('/');
      } else if (result.status === 'mfa-required') {
        setMfaChallenge(result.mfaChallenge);
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

  const onMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaChallenge || !mfaCode.trim()) {
      return;
    }
    setIsSubmitting(true);
    setLoginError('');
    try {
      const ok = await completeMfaLogin(mfaChallenge, mfaCode.trim());
      if (ok) {
        navigate('/');
      } else {
        setLoginError('Invalid code. Try the latest 6-digit code or a recovery code.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const onMfaCancel = () => {
    setMfaChallenge(null);
    setMfaCode('');
    setLoginError('');
  };

  if (isLoading) {
    return <LoadingPage title="Authenticating" description="Verifying your credentials..." />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="mt-6 text-3xl font-extrabold text-foreground">CRM Admin Dashboard</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{mfaChallenge ? 'Two-Factor Authentication' : 'Sign In'}</CardTitle>
            <CardDescription>
              {mfaChallenge
                ? 'Enter the 6-digit code from your authenticator app, or a recovery code.'
                : 'Enter your credentials to continue'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {mfaChallenge ? (
              <form onSubmit={onMfaSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="mfa-code">
                    Code <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="mfa-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="123 456"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value)}
                    /* eslint-disable-next-line jsx-a11y/no-autofocus -- T1-2: this field is the sole purpose of this view, focusing it is expected */
                    autoFocus
                    className="case-sensitive tracking-widest text-center text-lg"
                  />
                  <p className="text-xs text-muted-foreground">
                    Lost your device? Type a recovery code (XXXX-XXXX-XXXX). Each one works once.
                  </p>
                </div>

                {loginError && (
                  <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
                    {loginError}
                  </div>
                )}

                <div className="flex flex-col-reverse sm:flex-row gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={onMfaCancel}
                    disabled={isSubmitting}
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    className="w-full sm:flex-1"
                    disabled={isSubmitting || !mfaCode.trim()}
                  >
                    {isSubmitting ? 'Verifying…' : 'Verify'}
                  </Button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">
                    Username <span className="text-red-500">*</span>
                  </Label>
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
                  <Label htmlFor="password">
                    Password <span className="text-red-500">*</span>
                  </Label>
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
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
