// Zod schemas for verification task endpoints. Mirrors the case.schema
// convention: stable identity/status required, everything else optional
// via .passthrough().

import { z } from 'zod';

export const VerificationTaskSchema = z
  .object({
    id: z.string().min(1),
    status: z.string(),
    priority: z.string().optional(),
    caseId: z.union([z.string(), z.number()]).optional(),
    assignedTo: z.string().nullable().optional(),
    verificationTypeId: z.number().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .passthrough();

export type VerificationTaskDto = z.infer<typeof VerificationTaskSchema>;
