import { z } from 'zod';

export const rateTypeFormSchema = z.object({
  name: z
    .string()
    .min(1, 'Rate type name is required')
    .max(100, 'Name must be less than 100 characters'),
  description: z.string().max(500, 'Description must be less than 500 characters').optional(),
  isActive: z.boolean(),
});
export type RateTypeFormData = z.infer<typeof rateTypeFormSchema>;
