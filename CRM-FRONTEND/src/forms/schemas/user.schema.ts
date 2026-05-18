import { z } from 'zod';
import { PASSWORD_POLICY_REGEX } from '@/lib/passwordPolicy';

// Phone validation mirrors the BE validator at routes/users.ts
// (E.164: `^\+?[1-9]\d{1,14}$`). Empty string allowed; BE coerces '' → NULL.
// No dashes / spaces / parens — keep both sides identical so the FE never
// passes something the BE rejects.
const phoneFieldSchema = z
  .string()
  .max(16, 'Phone too long')
  .regex(/^$|^\+?[1-9]\d{1,14}$/, 'Use E.164 format, e.g. +919876543210')
  .optional();

const baseUserShape = {
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  email: z.string().email('Invalid email address'),
  phone: phoneFieldSchema,
  roleId: z.string().min(1, 'Role is required'),
  employeeId: z.string().min(1, 'Employee ID is required'),
  teamLeaderId: z.string().optional(),
  managerId: z.string().optional(),
};

// Self-service contact update (Profile page Identity tab). Standalone
// schema so the dialog can update either / both fields without
// dragging the full user object. Email is optional + nullable here
// (empty string allowed = "clear my email"); the BE re-validates and
// enforces uniqueness against other users.
export const updateMyContactFormSchema = z.object({
  email: z
    .string()
    .max(100, 'Email too long')
    .refine((v) => v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Invalid email address')
    .optional(),
  phone: phoneFieldSchema,
});
export type UpdateMyContactFormData = z.infer<typeof updateMyContactFormSchema>;

export const createUserFormSchema = z.object({
  ...baseUserShape,
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username too long'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(
      PASSWORD_POLICY_REGEX,
      'Password must include uppercase, lowercase, number, and special character'
    ),
  departmentId: z.string().optional(),
  designationId: z.string().optional(),
});
export type CreateUserFormData = z.infer<typeof createUserFormSchema>;

export const editUserFormSchema = z.object({
  ...baseUserShape,
  // Match Create + backend semantics: BE accepts NULL for both
  // (usersController.updateUser cleanDepartmentId / cleanDesignationId
  // coerce empty strings to null). Forcing .min(1) here blocked Edit on
  // legacy users with no dept/desig and bounced new admin assignments.
  designationId: z.string().optional(),
  departmentId: z.string().optional(),
  isActive: z.boolean(),
});
export type EditUserFormData = z.infer<typeof editUserFormSchema>;

// Phase D-3: self-service password change from Profile page.
// Server-side regex mirrors the BE validator at routes/users.ts (the
// /change-password route validator). Client-side first; BE re-validates.
export const changePasswordFormSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'New password must be at least 8 characters')
      .regex(
        PASSWORD_POLICY_REGEX,
        'Must include uppercase, lowercase, number, and special character'
      ),
    confirmPassword: z.string().min(1, 'Confirm your new password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'New password and confirmation do not match',
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    path: ['newPassword'],
    message: 'New password must differ from current password',
  });
export type ChangePasswordFormData = z.infer<typeof changePasswordFormSchema>;
