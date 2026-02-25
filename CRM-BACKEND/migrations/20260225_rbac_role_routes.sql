BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS role_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES roles_v2(id) ON DELETE CASCADE,
  route_key varchar(100) NOT NULL,
  allowed boolean NOT NULL DEFAULT true,
  UNIQUE (role_id, route_key)
);

COMMIT;
