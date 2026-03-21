import { useState } from 'react';
import { Key, RefreshCw, Copy, Eye, EyeOff, Mail, CheckCircle } from 'lucide-react';
import { useMutationWithInvalidation } from '@/hooks/useStandardizedMutation';
import { Button } from '@/ui/components/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/components/Dialog';
import { Input } from '@/ui/components/Input';
import { Label } from '@/ui/components/Label';
import { Alert, AlertDescription } from '@/ui/components/Alert';
import { toast } from 'sonner';
import { usersService } from '@/services/users';
import { User } from '@/types/user';
import { ApiResponse } from '@/types/api';
import { PasswordPolicyChecklist } from './PasswordPolicyChecklist';
import { isPasswordPolicyValid } from '@/lib/passwordPolicy';

interface ResetPasswordDialogProps {
  user: User;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ResetPasswordDialog({ user, open, onOpenChange }: ResetPasswordDialogProps) {
  const [generatedPassword, setGeneratedPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);
  const [resetMethod, setResetMethod] = useState<'show' | 'email' | null>(null);
  const [customPassword, setCustomPassword] = useState('');
  const [confirmCustomPassword, setConfirmCustomPassword] = useState('');
  const [showCustomPassword, setShowCustomPassword] = useState(false);
  const [showConfirmCustomPassword, setShowConfirmCustomPassword] = useState(false);

  const generatePasswordMutation = useMutationWithInvalidation({
    mutationFn: (userId: string) => usersService.generateTemporaryPassword(userId),
    invalidateKeys: [['users']],
    successMessage: resetMethod === 'email'
      ? 'Temporary password generated and sent via email'
      : 'Temporary password generated successfully',
    errorContext: 'Generate Temporary Password',
    errorFallbackMessage: 'Failed to generate temporary password',
    onSuccess: (data: ApiResponse<{ temporaryPassword: string }>) => {
      setGeneratedPassword(data.data?.temporaryPassword || '');
      setShowPassword(true); // Show password by default when generated
    },
  });

  const setCustomPasswordMutation = useMutationWithInvalidation({
    mutationFn: () =>
      usersService.resetPassword({
        username: user.username,
        newPassword: customPassword,
        confirmPassword: confirmCustomPassword,
      }),
    invalidateKeys: [['users']],
    successMessage: 'Custom password set successfully',
    errorContext: 'Custom Password Reset',
    errorFallbackMessage: 'Failed to set custom password',
    onSuccess: () => {
      setGeneratedPassword(customPassword);
      setResetMethod('show');
      setShowPassword(true);
    },
  });

  const handleGeneratePassword = (method: 'show' | 'email') => {
    setResetMethod(method);
    generatePasswordMutation.mutate(user.id);
  };

  const handleCopyPassword = async () => {
    if (generatedPassword) {
      await navigator.clipboard.writeText(generatedPassword);
      toast.success('Password copied to clipboard');
    }
  };

  const handleClose = () => {
    setGeneratedPassword('');
    setShowPassword(false);
    setResetMethod(null);
    setCustomPassword('');
    setConfirmCustomPassword('');
    setShowCustomPassword(false);
    setShowConfirmCustomPassword(false);
    onOpenChange(false);
  };

  const isCustomPasswordValid =
    isPasswordPolicyValid(customPassword) && customPassword === confirmCustomPassword;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent {...{ className: "max-w-[95vw] sm:max-w-[500px]" }}>
        <DialogHeader>
          <DialogTitle {...{ className: "flex items-center space-x-2" }}>
            <Key {...{ className: "h-5 w-5" }} />
            <span>Reset Password</span>
          </DialogTitle>
          <DialogDescription>
            Generate a temporary password for {user.name}
          </DialogDescription>
        </DialogHeader>

        <div {...{ className: "space-y-4" }}>
          {!generatedPassword ? (
            <>
              <Alert>
                <RefreshCw {...{ className: "h-4 w-4" }} />
                <AlertDescription>
                  Choose how you want to reset the password for this user. The user will be required to change the temporary password on their next login.
                </AlertDescription>
              </Alert>

              <div {...{ className: "space-y-2" }}>
                <h4 {...{ className: "font-medium" }}>User Information:</h4>
                <div {...{ className: "text-sm text-gray-600" }}>
                  <p>Name: {user.name}</p>
                  <p>Username: {user.username}</p>
                  <p>Email: {user.email}</p>
                  <p>Employee ID: {user.employeeId}</p>
                </div>
              </div>

              <div {...{ className: "space-y-3" }}>
                <h4 {...{ className: "font-medium" }}>Reset Method:</h4>
                <div {...{ className: "grid grid-cols-1 gap-3" }}>
                  <div {...{ className: "border rounded-lg p-4 space-y-2" }}>
                    <div {...{ className: "flex items-center space-x-2" }}>
                      <Eye {...{ className: "h-4 w-4 text-green-600" }} />
                      <h5 {...{ className: "font-medium" }}>Show Password</h5>
                    </div>
                    <p {...{ className: "text-sm text-gray-600" }}>
                      Generate and display the temporary password in this dialog. You can copy it and share with the user manually.
                    </p>
                    <Button
                      onClick={() => handleGeneratePassword('show')}
                      disabled={generatePasswordMutation.isPending}
                      variant="outline"
                      {...{ className: "w-full" }}
                    >
                      {generatePasswordMutation.isPending ? 'Generating...' : 'Reset & Show Password'}
                    </Button>
                  </div>

                  <div {...{ className: "border rounded-lg p-4 space-y-2" }}>
                    <div {...{ className: "flex items-center space-x-2" }}>
                      <Mail {...{ className: "h-4 w-4 text-green-600" }} />
                      <h5 {...{ className: "font-medium" }}>Send via Email</h5>
                    </div>
                    <p {...{ className: "text-sm text-gray-600" }}>
                      Generate and automatically send the temporary password to {user.email} via email.
                    </p>
                    <Button
                      onClick={() => handleGeneratePassword('email')}
                      disabled={generatePasswordMutation.isPending}
                      {...{ className: "w-full" }}
                    >
                      {generatePasswordMutation.isPending ? 'Generating...' : 'Reset & Send Email'}
                    </Button>
                  </div>

                  <div {...{ className: "border rounded-lg p-4 space-y-3" }}>
                    <div {...{ className: "flex items-center space-x-2" }}>
                      <Key {...{ className: "h-4 w-4 text-green-600" }} />
                      <h5 {...{ className: "font-medium" }}>Set Custom Password</h5>
                    </div>
                    <p {...{ className: "text-sm text-gray-600" }}>
                      Set a custom password manually with strong password policy validation.
                    </p>

                    <div {...{ className: "space-y-2" }}>
                      <Label htmlFor="custom-password">New Password</Label>
                      <div {...{ className: "relative" }}>
                        <Input
                          id="custom-password"
                          type={showCustomPassword ? 'text' : 'password'}
                          value={customPassword}
                          onChange={(e) => setCustomPassword(e.target.value)}
                          placeholder="Enter custom password"
                          {...{ className: "pr-10" }}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          {...{ className: "absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0" }}
                          onClick={() => setShowCustomPassword(!showCustomPassword)}
                        >
                          {showCustomPassword ? (
                            <EyeOff {...{ className: "h-4 w-4" }} />
                          ) : (
                            <Eye {...{ className: "h-4 w-4" }} />
                          )}
                        </Button>
                      </div>
                    </div>

                    <div {...{ className: "space-y-2" }}>
                      <Label htmlFor="confirm-custom-password">Confirm Password</Label>
                      <div {...{ className: "relative" }}>
                        <Input
                          id="confirm-custom-password"
                          type={showConfirmCustomPassword ? 'text' : 'password'}
                          value={confirmCustomPassword}
                          onChange={(e) => setConfirmCustomPassword(e.target.value)}
                          placeholder="Re-enter custom password"
                          {...{ className: "pr-10" }}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          {...{ className: "absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0" }}
                          onClick={() => setShowConfirmCustomPassword(!showConfirmCustomPassword)}
                        >
                          {showConfirmCustomPassword ? (
                            <EyeOff {...{ className: "h-4 w-4" }} />
                          ) : (
                            <Eye {...{ className: "h-4 w-4" }} />
                          )}
                        </Button>
                      </div>
                      {confirmCustomPassword &&
                        customPassword !== confirmCustomPassword && (
                          <p {...{ className: "text-xs text-red-600" }}>Passwords do not match</p>
                        )}
                    </div>

                    <PasswordPolicyChecklist password={customPassword} />

                    <Button
                      onClick={() => setCustomPasswordMutation.mutate()}
                      disabled={!isCustomPasswordValid || setCustomPasswordMutation.isPending}
                      {...{ className: "w-full" }}
                    >
                      {setCustomPasswordMutation.isPending
                        ? 'Setting Password...'
                        : 'Set Custom Password'}
                    </Button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <Alert {...{ className: "border-green-200 bg-green-50" }}>
                <CheckCircle {...{ className: "h-4 w-4 text-green-600" }} />
                <AlertDescription {...{ className: "text-green-800" }}>
                  {resetMethod === 'email'
                    ? `Password generated successfully! An email has been sent to ${user.email} with the new credentials.`
                    : 'Password generated successfully! You can now copy the password and share it with the user.'
                  }
                </AlertDescription>
              </Alert>

              <div {...{ className: "space-y-3" }}>
                <div {...{ className: "space-y-2" }}>
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={user.username}
                    readOnly
                    {...{ className: "bg-white text-gray-900 font-medium border-2 border-border focus:border-border shadow-sm" }}
                  />
                </div>

                <div {...{ className: "space-y-2" }}>
                  <Label htmlFor="password">Temporary Password</Label>
                  <div {...{ className: "relative" }}>
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={generatedPassword}
                      readOnly
                      {...{ className: "bg-white text-gray-900 font-mono font-bold pr-20 border-2 border-green-200 text-lg focus:border-blue-400 shadow-sm" }}
                    />
                    <div {...{ className: "absolute right-2 top-1/2 -translate-y-1/2 flex space-x-1" }}>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        {...{ className: "h-8 w-8 p-0" }}
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff {...{ className: "h-4 w-4" }} /> : <Eye {...{ className: "h-4 w-4" }} />}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        {...{ className: "h-8 w-8 p-0" }}
                        onClick={handleCopyPassword}
                      >
                        <Copy {...{ className: "h-4 w-4" }} />
                      </Button>
                    </div>
                  </div>
                </div>

                <Alert>
                  {resetMethod === 'email' ? (
                    <>
                      <Mail {...{ className: "h-4 w-4" }} />
                      <AlertDescription>
                        The credentials have been sent to <strong>{user.email}</strong>. Please inform the user to check their email and change the password after logging in.
                      </AlertDescription>
                    </>
                  ) : (
                    <>
                      <Eye {...{ className: "h-4 w-4" }} />
                      <AlertDescription>
                        Please share these credentials with <strong>{user.name}</strong> securely and inform them to change the password after logging in.
                      </AlertDescription>
                    </>
                  )}
                </Alert>
              </div>
            </>
          )}
        </div>

        <DialogFooter {...{ className: "flex-col sm:flex-row gap-2" }}>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={generatePasswordMutation.isPending}
           {...{ className: "w-full sm:w-auto" }}>
            {generatedPassword ? 'Close' : 'Cancel'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
