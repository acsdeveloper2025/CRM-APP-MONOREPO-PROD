import { z } from 'zod';

export const departmentFormSchema = z.object({
  name: z
    .string()
    .min(1, 'Department name is required')
    .max(200, 'Name must be at most 200 characters'),
  description: z
    .string()
    .max(1000, 'Description must be at most 1000 characters')
    .optional()
    .or(z.literal('')),
});
export type DepartmentFormData = z.infer<typeof departmentFormSchema>;

export const editDepartmentFormSchema = departmentFormSchema.extend({
  isActive: z.boolean().optional(),
});
export type EditDepartmentFormData = z.infer<typeof editDepartmentFormSchema>;
