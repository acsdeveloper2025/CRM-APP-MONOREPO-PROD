#!/usr/bin/env ts-node

import { adminRoleV2Id, adminUserId, createPool, destructiveTables, logger } from './lib/dbAdmin';

const resetSql = `
BEGIN;

UPDATE "documentTypes"
SET created_by = '${adminUserId}',
    updated_by = '${adminUserId}'
WHERE created_by IS DISTINCT FROM '${adminUserId}'
   OR updated_by IS DISTINCT FROM '${adminUserId}';

TRUNCATE TABLE
  ${destructiveTables.join(',\n  ')}
RESTART IDENTITY CASCADE;

DELETE FROM user_roles
WHERE user_id <> '${adminUserId}';

DELETE FROM role_routes
WHERE role_id <> '${adminRoleV2Id}';

DELETE FROM role_permissions
WHERE role_id <> '${adminRoleV2Id}';

DELETE FROM roles_v2
WHERE id <> '${adminRoleV2Id}';

UPDATE users
SET manager_id = NULL,
    team_leader_id = NULL,
    "departmentId" = 2,
    "designationId" = NULL,
    role = 'SUPER_ADMIN',
    "isActive" = TRUE
WHERE id = '${adminUserId}';

DELETE FROM users
WHERE id <> '${adminUserId}';

DO $$
DECLARE
  rec record;
  max_id bigint;
BEGIN
  FOR rec IN
    SELECT
      format('%I.%I', n.nspname, c.relname) AS fq_table_name,
      a.attname AS column_name,
      pg_get_serial_sequence(format('%I.%I', n.nspname, c.relname), a.attname) AS seq_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_index i ON i.indrelid = c.oid AND i.indisprimary
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY(i.indkey)
    JOIN pg_type t ON t.oid = a.atttypid
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND array_length(i.indkey, 1) = 1
      AND t.typname IN ('int2', 'int4', 'int8')
  LOOP
    IF rec.seq_name IS NOT NULL THEN
      EXECUTE format('SELECT COALESCE(MAX(%I), 0) FROM %s', rec.column_name, rec.fq_table_name) INTO max_id;
      IF max_id = 0 THEN
        EXECUTE format('SELECT setval(%L, 1, false)', rec.seq_name);
      ELSE
        EXECUTE format('SELECT setval(%L, %s, true)', rec.seq_name, max_id);
      END IF;
    END IF;
  END LOOP;
END $$;

COMMIT;
`;

const normalizeSql = `
BEGIN;

CREATE TEMP TABLE country_map AS
SELECT id AS old_id, ROW_NUMBER() OVER (ORDER BY id) AS new_id
FROM countries;

CREATE TEMP TABLE state_map AS
SELECT id AS old_id, ROW_NUMBER() OVER (ORDER BY id) AS new_id
FROM states;

CREATE TEMP TABLE city_map AS
SELECT id AS old_id, ROW_NUMBER() OVER (ORDER BY id) AS new_id
FROM cities;

CREATE TEMP TABLE area_map AS
SELECT id AS old_id, ROW_NUMBER() OVER (ORDER BY id) AS new_id
FROM areas;

CREATE TEMP TABLE pincode_map AS
SELECT id AS old_id, ROW_NUMBER() OVER (ORDER BY id) AS new_id
FROM pincodes;

CREATE TEMP TABLE pincode_area_map AS
SELECT id AS old_id, ROW_NUMBER() OVER (ORDER BY id) AS new_id
FROM "pincodeAreas";

SET session_replication_role = replica;

UPDATE countries
SET id = -(SELECT new_id FROM country_map WHERE old_id = countries.id);

UPDATE states
SET id = -(SELECT new_id FROM state_map WHERE old_id = states.id),
    "countryId" = -(SELECT new_id FROM country_map WHERE old_id = states."countryId");

UPDATE cities
SET id = -(SELECT new_id FROM city_map WHERE old_id = cities.id),
    "stateId" = -(SELECT new_id FROM state_map WHERE old_id = cities."stateId"),
    "countryId" = -(SELECT new_id FROM country_map WHERE old_id = cities."countryId");

UPDATE areas
SET id = -(SELECT new_id FROM area_map WHERE old_id = areas.id);

UPDATE pincodes
SET id = -(SELECT new_id FROM pincode_map WHERE old_id = pincodes.id),
    "cityId" = -(SELECT new_id FROM city_map WHERE old_id = pincodes."cityId");

UPDATE "pincodeAreas"
SET id = -(SELECT new_id FROM pincode_area_map WHERE old_id = "pincodeAreas".id),
    "pincodeId" = -(SELECT new_id FROM pincode_map WHERE old_id = "pincodeAreas"."pincodeId"),
    "areaId" = -(SELECT new_id FROM area_map WHERE old_id = "pincodeAreas"."areaId");

UPDATE countries SET id = -id;
UPDATE states SET id = -id, "countryId" = -"countryId";
UPDATE cities SET id = -id, "stateId" = -"stateId", "countryId" = -"countryId";
UPDATE areas SET id = -id;
UPDATE pincodes SET id = -id, "cityId" = -"cityId";
UPDATE "pincodeAreas" SET id = -id, "pincodeId" = -"pincodeId", "areaId" = -"areaId";

SET session_replication_role = origin;

SELECT setval('countries_temp_id_seq', COALESCE((SELECT MAX(id) FROM countries), 1), true);
SELECT setval('states_temp_id_seq', COALESCE((SELECT MAX(id) FROM states), 1), true);
SELECT setval('cities_temp_id_seq', COALESCE((SELECT MAX(id) FROM cities), 1), true);
SELECT setval('areas_temp_id_seq', COALESCE((SELECT MAX(id) FROM areas), 1), true);
SELECT setval('pincodes_temp_id_seq', COALESCE((SELECT MAX(id) FROM pincodes), 1), true);
SELECT setval('"pincodeAreas_temp_id_seq"', COALESCE((SELECT MAX(id) FROM "pincodeAreas"), 1), true);

COMMIT;
`;

async function main(): Promise<void> {
  const pool = createPool();
  try {
    logger.info('Resetting local database to the canonical main state');
    await pool.query(resetSql);
    await pool.query(normalizeSql);
    logger.info('Local database reset and normalization complete');
  } finally {
    await pool.end();
  }
}

main().catch(error => {
  logger.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
