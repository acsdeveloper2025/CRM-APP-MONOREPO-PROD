// Zod schemas for case endpoints.
//
// Kept minimal — only the stable identity/status fields are required,
// everything else is accepted via .passthrough(). The goal is to catch
// shape breaks (id missing, status missing, payload not an object) not
// to mirror the TypeScript `Case` interface field-for-field, which
// evolves with every CRM feature.

import { z } from 'zod';
import { PaginationSchema } from './common.schema';

export const CaseSchema = z
  .object({
    id: z.string().min(1),
    status: z.string(),
    priority: z.string().optional(),
    clientId: z.number().optional(),
    productId: z.number().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .passthrough();

// PG aggregate COUNT(...) returns bigint which the `pg` driver surfaces as
// a JS string (avoids precision loss). Use z.coerce.number() so the schema
// matches the documented codebase convention (per project_e2e_live_test
// 2026-05-02 bug 18: "PG NUMERIC always wrap in Number()").
export const CaseStatisticsSchema = z
  .object({
    totalCases: z.coerce.number().optional(),
    pending: z.coerce.number().optional(),
    inProgress: z.coerce.number().optional(),
    completed: z.coerce.number().optional(),
  })
  .passthrough();

export const CaseListResponseSchema = z
  .object({
    data: z.array(CaseSchema),
    statistics: CaseStatisticsSchema.optional(),
    pagination: PaginationSchema.optional(),
  })
  .passthrough();

export type CaseDto = z.infer<typeof CaseSchema>;
export type CaseListResponseDto = z.infer<typeof CaseListResponseSchema>;
