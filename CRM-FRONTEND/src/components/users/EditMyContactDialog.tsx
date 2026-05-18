// D2 (audit 2026-05-18): self-edit Contact dialog for ProfilePage
// Identity tab. The two field-level write surfaces a user has against
// their own profile — email + phone. Name / employeeId / role / dept /
// designation remain admin-managed; password has its own dedicated
// Password tab.

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useStandardizedMutation } from '@/hooks/useStandardizedMutation';
import { apiService } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import {
  updateMyContactFormSchema,
  type UpdateMyContactFormData,
} from '@/forms/schemas/user.schema';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentEmail: string | null | undefined;
  currentPhone: string | null | undefined;
}

export function EditMyContactDialog({ open, onOpenChange, currentEmail, currentPhone }: Props) {
  const { refreshUserPermissions } = useAuth();

  const form = useForm<UpdateMyContactFormData>({
    resolver: zodResolver(updateMyContactFormSchema),
    defaultValues: { email: currentEmail ?? '', phone: currentPhone ?? '' },
  });

  // Reset to the latest stored values whenever the dialog opens.
  useEffect(() => {
    if (open) {
      form.reset({ email: currentEmail ?? '', phone: currentPhone ?? '' });
    }
  }, [open, currentEmail, currentPhone, form]);

  const mutation = useStandardizedMutation({
    mutationFn: (data: UpdateMyContactFormData) =>
      apiService.patch<{ email: string | null; phone: string | null }>('/users/me/profile', {
        email: data.email ?? '',
        phone: data.phone ?? '',
      }),
    successMessage: 'Contact info updated',
    errorContext: 'Update Contact Info',
    onSuccess: async () => {
      await refreshUserPermissions();
      onOpenChange(false);
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!mutation.isPending) {
          onOpenChange(next);
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Update Contact Info</DialogTitle>
          <DialogDescription>
            Change your email and / or phone. Leave a field blank to clear it.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="name@example.com"
                      autoComplete="email"
                      disabled={mutation.isPending}
                      className="case-sensitive"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>Must be unique across the system.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input
                      type="tel"
                      placeholder="+919876543210"
                      autoComplete="tel"
                      disabled={mutation.isPending}
                      className="case-sensitive"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>E.164 format (country code, digits only).</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={mutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Saving…' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
