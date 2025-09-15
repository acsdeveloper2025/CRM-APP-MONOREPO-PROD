import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Key, RefreshCw, Copy, Eye, EyeOff, Mail, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { usersService } from '@/services/users';
import { User } from '@/types/user';

interface ResetPasswordDialogProps {
  user: User;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ResetPasswordDialog({ user, open, onOpenChange }: ResetPasswordDialogProps) {
  const queryClient = useQueryClient();
  const [generatedPassword, setGeneratedPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);
  const [resetMethod, setResetMethod] = useState<'show' | 'email' | null>(null);

  const generatePasswordMutation = useMutation({
    mutationFn: (userId: string) => usersService.generateTemporaryPassword(userId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setGeneratedPassword(data.data?.temporaryPassword || '');
      setShowPassword(true); // Show password by default when generated
      if (resetMethod === 'email') {
        toast.success('Temporary password generated and sent via email');
      } else {
        toast.success('Temporary password generated successfully');
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to generate temporary password');
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
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Key className="h-5 w-5" />
            <span>Reset Password</span>
          </DialogTitle>
          <DialogDescription>
            Generate a temporary password for {user.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!generatedPassword ? (
            <>
              <Alert>
                <RefreshCw className="h-4 w-4" />
                <AlertDescription>
                  Choose how you want to reset the password for this user. The user will be required to change the temporary password on their next login.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <h4 className="font-medium">User Information:</h4>
                <div className="text-sm text-muted-foreground">
                  <p>Name: {user.name}</p>
                  <p>Username: {user.username}</p>
                  <p>Email: {user.email}</p>
                  <p>Employee ID: {user.employeeId}</p>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-medium">Reset Method:</h4>
                <div className="grid grid-cols-1 gap-3">
                  <div className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-center space-x-2">
                      <Eye className="h-4 w-4 text-blue-600" />
                      <h5 className="font-medium">Show Password</h5>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Generate and display the temporary password in this dialog. You can copy it and share with the user manually.
                    </p>
                    <Button
                      onClick={() => handleGeneratePassword('show')}
                      disabled={generatePasswordMutation.isPending}
                      variant="outline"
                      className="w-full"
                    >
                      {generatePasswordMutation.isPending ? 'Generating...' : 'Reset & Show Password'}
                    </Button>
                  </div>

                  <div className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-center space-x-2">
                      <Mail className="h-4 w-4 text-green-600" />
                      <h5 className="font-medium">Send via Email</h5>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Generate and automatically send the temporary password to {user.email} via email.
                    </p>
                    <Button
                      onClick={() => handleGeneratePassword('email')}
                      disabled={generatePasswordMutation.isPending}
                      className="w-full"
                    >
                      {generatePasswordMutation.isPending ? 'Generating...' : 'Reset & Send Email'}
                    </Button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  {resetMethod === 'email'
                    ? `Password generated successfully! An email has been sent to ${user.email} with the new credentials.`
                    : 'Password generated successfully! You can now copy the password and share it with the user.'
                  }
                </AlertDescription>
              </Alert>

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={user.username}
                    readOnly
                    className="bg-white text-foreground font-medium border-2 border-border focus:border-border shadow-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Temporary Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={generatedPassword}
                      readOnly
                      className="bg-white text-foreground font-mono font-bold pr-20 border-2 border-blue-200 text-lg focus:border-blue-400 shadow-sm"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex space-x-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={handleCopyPassword}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                <Alert>
                  {resetMethod === 'email' ? (
                    <>
                      <Mail className="h-4 w-4" />
                      <AlertDescription>
                        The credentials have been sent to <strong>{user.email}</strong>. Please inform the user to check their email and change the password after logging in.
                      </AlertDescription>
                    </>
                  ) : (
                    <>
                      <Eye className="h-4 w-4" />
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

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={generatePasswordMutation.isPending}
          >
            {generatedPassword ? 'Close' : 'Cancel'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
