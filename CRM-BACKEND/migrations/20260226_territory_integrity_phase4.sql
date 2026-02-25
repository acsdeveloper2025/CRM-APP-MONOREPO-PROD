-- Phase 4: Territory Integrity DB hardening (non-destructive)
-- Note:
-- 1) This migration does NOT modify existing task rows.
-- 2) We intentionally avoid task-level NOT NULL/check constraints here because
--    existing dev data may contain territory-invalid tasks (e.g. area_id NULL).
-- 3) We add uniqueness protections to prevent duplicate mapping/rule ambiguity.

BEGIN;

-- Fail early if duplicate pincode-area mappings already exist.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "pincodeAreas"
    GROUP BY "pincodeId", "areaId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot add unique pincodeAreas constraint: duplicate (pincodeId, areaId) pairs exist';
  END IF;
END $$;

-- Prevent duplicate pincode -> area mapping rows.
CREATE UNIQUE INDEX IF NOT EXISTS uq_pincode_areas_pincode_area
  ON public."pincodeAreas" ("pincodeId", "areaId");

-- Fail early if duplicate active service-zone rules already exist for same scope.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.service_zone_rules
    WHERE is_active = true
    GROUP BY
      COALESCE(client_id, -1),
      COALESCE(product_id, -1),
      pincode_id,
      COALESCE(area_id, -1)
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot add unique active service_zone_rules scope index: duplicate active rules exist';
  END IF;
END $$;

-- Prevent duplicate active service-zone rules per operational scope.
-- Expression index treats NULL client/product/area as the same scope bucket.
CREATE UNIQUE INDEX IF NOT EXISTS uq_service_zone_rules_active_scope
  ON public.service_zone_rules (
    COALESCE(client_id, -1),
    COALESCE(product_id, -1),
    pincode_id,
    COALESCE(area_id, -1)
  )
  WHERE is_active = true;

COMMIT;

