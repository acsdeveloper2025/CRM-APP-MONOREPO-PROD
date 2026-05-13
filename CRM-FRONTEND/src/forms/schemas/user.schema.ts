import { z } from 'zod';
import { PASSWORD_POLICY_REGEX } from '@/lib/passwordPolicy';

const baseUserShape = {
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  email: z.string().email('Invalid email address'),
  roleId: z.string().min(1, 'Role is required'),
  employeeId: z.string().min(1, 'Employee ID is required'),
  teamLeaderId: z.string().optional(),
  managerId: z.string().optional(),
};

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
