// Shared zod building blocks for service response schemas.
//
// All entity schemas in this folder follow the same rule: require only
// the stable identity/timing fields, mark everything else optional, and
// allow unknown keys via `.passthrough()`. This keeps schemas forgiving
// enough that the backend can add a new field without breaking the
// frontend, while still flagging the hard breaks (a field rename, a list
// becoming paginated, a success envelope changing shape).

import { z } from 'zod';

/** Pagination envelope returned by every list endpoint. */
export const PaginationSchema = z
  .object({
    page: z.number().int().nonnegative(),
    limit: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  })
  .passthrough();

/** Standard ApiResponse envelope wrapping a typed data payload. */
export function apiResponseSchema<T extends z.ZodTypeAny>(data: T) {
  return z
    .object({
      success: z.boolean(),
      message: z.string().optional(),
      data,
    })
    .passthrough();
}

/** ApiResponse envelope for list endpoints that also carry pagination. */
export function paginatedApiResponseSchema<T extends z.ZodTypeAny>(item: T) {
  return z
    .object({
      success: z.boolean(),
      message: z.string().optional(),
      data: z.array(item),
      pagination: PaginationSchema.optional(),
    })
    .passthrough();
}
