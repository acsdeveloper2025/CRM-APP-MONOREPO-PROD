-- Field-Exec Tracking epic — P1 backend ingest + latest_location projection.
--
-- 1. Allow source='TRACKING' on locations (foreground periodic GPS points,
--    untethered from a task). Was: TASK | ADMIN_PING only.
-- 2. latest_location: one row per agent, upserted on every locations write
--    (app-side, D1 option a). Lets the field-monitoring roster read the
--    freshest position per agent from a single indexed table instead of the
--    triple-CTE 3-source LATERAL (P2 rewrite).
--
-- NOTE: plain DDL (no CONCURRENTLY) — scripts/run-migrations.ts wraps each
-- migration in BEGIN/COMMIT. Instant on current data volume.

-- ─── 1. extend locations.source CHECK ───
ALTER TABLE public.locations DROP CONSTRAINT IF EXISTS chk_locations_source;
ALTER TABLE public.locations
  ADD CONSTRAINT chk_locations_source
  CHECK (((source)::text = ANY (ARRAY[
    ('TASK'::character varying)::text,
    ('ADMIN_PING'::character varying)::text,
    ('TRACKING'::character varying)::text
  ])));

-- ─── 2. latest_location projection ───
CREATE TABLE IF NOT EXISTS public.latest_location (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  latitude numeric(10,8) NOT NULL,
  longitude numeric(11,8) NOT NULL,
  accuracy numeric(8,2),
  recorded_at timestamp with time zone NOT NULL,
  source character varying(20) NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Bbox filter on the live map (roster WHERE lat BETWEEN .. AND lng BETWEEN ..).
CREATE INDEX IF NOT EXISTS idx_latest_location_geo
  ON public.latest_location (latitude, longitude);

-- Freshness sort / staleness sweep.
CREATE INDEX IF NOT EXISTS idx_latest_location_recorded_at
  ON public.latest_location (recorded_at DESC);

-- Backfill from existing locations so the projection isn't empty on first
-- deploy (freshest locations row per agent). Idempotent.
INSERT INTO public.latest_location (user_id, latitude, longitude, accuracy, recorded_at, source, updated_at)
SELECT DISTINCT ON (l.recorded_by)
  l.recorded_by, l.latitude, l.longitude, l.accuracy, l.recorded_at, l.source, now()
FROM public.locations l
ORDER BY l.recorded_by, l.recorded_at DESC
ON CONFLICT (user_id) DO UPDATE SET
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  accuracy = EXCLUDED.accuracy,
  recorded_at = EXCLUDED.recorded_at,
  source = EXCLUDED.source,
  updated_at = now()
WHERE public.latest_location.recorded_at <= EXCLUDED.recorded_at;
