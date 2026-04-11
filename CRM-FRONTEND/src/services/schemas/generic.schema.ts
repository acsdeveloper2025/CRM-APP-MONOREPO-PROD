// Generic permissive schemas for services that only need outer-shape
// validation.
//
// B6 coverage completion: the remaining ~25 service modules share a
// common pattern — GET returns either an object with an `id` or an
// array of such objects. Writing a bespoke schema per domain would add
// ~500 lines of boilerplate for marginal value; instead this file
// provides three permissive building blocks that catch the breaks that
// matter (list became non-array, entity lost its id, success envelope
// dropped its data) while tolerating every forward-compatible field
// addition.
//
// When a specific domain grows real invariants (e.g. auth tokens, case
// state machines), it should graduate to its own schema file — these
// generic schemas are the floor, not the ceiling.

import { z } from 'zod';

/** Any object with at least an `id` (string OR number). */
export const GenericEntitySchema = z
  .object({
    id: z.union([z.string(), z.number()]),
  })
  .passthrough();

/** Array of GenericEntity. */
export const GenericEntityListSchema = z.array(GenericEntitySchema);

/** Object payload with no required fields at all — used for dashboards,
 *  reports, and analytics endpoints where the response is a freeform
 *  aggregate. Only checks that the payload is an object, not a string
 *  or null, which is enough to catch the common breaks. */
export const GenericObjectSchema = z.record(z.string(), z.unknown());

export type GenericEntityDto = z.infer<typeof GenericEntitySchema>;
