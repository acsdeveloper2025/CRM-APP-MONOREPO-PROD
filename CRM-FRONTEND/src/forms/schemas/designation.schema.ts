import { z } from 'zod';

export const designationFormSchema = z.object({
  name: z
    .string()
    .min(1, 'Designation name is required')
    .max(100, 'Name must be at most 100 characters'),
  description: z
    .string()
    .max(500, 'Description must be at most 500 characters')
    .optional()
    .or(z.literal('')),
  // departmentId stored as string in the form (Select uses string values);
  // controller coerces to number on submit. Empty string = no department.
  departmentId: z.string().optional().or(z.literal('')),
});
export type DesignationFormData = z.infer<typeof designationFormSchema>;

export const editDesignationFormSchema = designationFormSchema.extend({
  isActive: z.boolean().optional(),
});
export type EditDesignationFormData = z.infer<typeof editDesignationFormSchema>;
