// T1-9 (audit 2026-05-17): unify on the redacted logger. The standalone
// winston instance previously defined here had no PII redaction, leaving
// ~39 importers (cases, mobile*, exports, deduplication, etc.) emitting
// raw PII into logs/combined.log. Re-export the canonical instance from
// `@/config/logger` so all importers go through `piiRedactionFormat`.
import { logger } from '@/config/logger';

export { logger };
export default logger;
