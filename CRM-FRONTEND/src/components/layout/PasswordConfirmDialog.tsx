import React, { useState } from 'react';
import { toast } from 'sonner';
import { apiService } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface PasswordConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * 'lock' | 'unlock' — passed to the BE so SCOPE_DEMO_LOCK or
   * SCOPE_DEMO_UNLOCK audit events fire with the right action code.
   * P12 of project_scope_control_audit_2026_05_14.md.
   */
  intent: 'lock' | 'unlock';
  title: string;
  description: string;
  confirmLabel: string;
  /** Called after the BE confirms the password is valid. */
  onSuccess: () => void;
}

export const PasswordConfirmDialog: React.FC<PasswordConfirmDialogProps> = ({
  open,
  onOpenChange,
  intent,
  title,
  description,
  confirmLabel,
  onSuccess,
}) => {
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setPassword('');
    setError(null);
    setSubmitting(false);
  };

  const handleClose = (next: boolean) => {
    if (!next) {
      reset();
    }
    onOpenChange(next);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!password) {
      setError('Password is required');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await apiService.post('/auth/verify-password', { password, intent });
      toast.success(intent === 'lock' ? 'Demo Mode locked' : 'Demo Mode exited');
      reset();
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      const e = err as { response?: { data?: { message?: string; error?: { code?: string } } } };
      const code = e.response?.data?.error?.code;
      const msg =
        code === 'INVALID_PASSWORD'
          ? 'Incorrect password'
          : (e.response?.data?.message ?? 'Verification failed. Try again.');
      setError(msg);
      setSubmitting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent>
        <form onSubmit={handleSubmit}>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="my-4 space-y-2">
            <Label htmlFor="scope-demo-password">Your password</Label>
            <Input
              id="scope-demo-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) {
                  setError(null);
                }
              }}
              disabled={submitting}
              aria-invalid={!!error}
              aria-describedby={error ? 'scope-demo-password-error' : undefined}
            />
            {error && (
              <p id="scope-demo-password-error" role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
          <AlertDialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || password.length === 0}>
              {submitting ? 'Verifying…' : confirmLabel}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
};
