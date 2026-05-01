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
  designationId: z.string().min(1, 'Designation is required'),
  departmentId: z.string().min(1, 'Department is required'),
  isActive: z.boolean(),
});
export type EditUserFormData = z.infer<typeof editUserFormSchema>;
