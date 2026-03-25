#!/usr/bin/env ts-node

import { adminRoleV2Id, adminUserId, createPool, logger } from './lib/dbAdmin';

type Check = {
  name: string;
  ok: boolean;
  details: string;
};

async function singleValue(pool: ReturnType<typeof createPool>, sql: string): Promise<string> {
  const result = await pool.query(sql);
  const firstRow = result.rows[0] as Record<string, unknown> | undefined;
  const firstKey = firstRow ? Object.keys(firstRow)[0] : null;
  return firstKey ? String(firstRow[firstKey]) : '';
}

async function main(): Promise<void> {
  const pool = createPool();
  const checks: Check[] = [];

  try {
    const operationalCount = await singleValue(
      pool,
      `SELECT (
        (SELECT COUNT(*) FROM cases) +
        (SELECT COUNT(*) FROM verification_tasks) +
        (SELECT COUNT(*) FROM applicants) +
        (SELECT COUNT(*) FROM verifications) +
        (SELECT COUNT(*) FROM visits) +
        (SELECT COUNT(*) FROM clients) +
        (SELECT COUNT(*) FROM products) +
        (SELECT COUNT(*) FROM rates) +
        (SELECT COUNT(*) FROM "rateTypeAssignments") +
        (SELECT COUNT(*) FROM "documentTypeRates") +
        (SELECT COUNT(*) FROM service_zone_rules) +
        (SELECT COUNT(*) FROM zone_rate_type_mapping) +
        (SELECT COUNT(*) FROM service_zones)
      ) AS total`
    );

    checks.push({
      name: 'Operational data removed',
      ok: operationalCount === '0',
      details: `total_rows=${operationalCount}`
    });

    const adminCount = await singleValue(pool, `SELECT COUNT(*) AS count FROM users WHERE id = '${adminUserId}'`);
    checks.push({
      name: 'Admin user exists',
      ok: adminCount === '1',
      details: `count=${adminCount}`
    });

    const userCount = await singleValue(pool, 'SELECT COUNT(*) AS count FROM users');
    checks.push({
      name: 'Only one user remains',
      ok: userCount === '1',
      details: `count=${userCount}`
    });

    const rbacRoleCount = await singleValue(pool, 'SELECT COUNT(*) AS count FROM roles_v2');
    checks.push({
      name: 'RBAC roles reduced to Admin only',
      ok: rbacRoleCount === '1',
      details: `count=${rbacRoleCount}`
    });

    const adminRoleLink = await singleValue(
      pool,
      `SELECT COUNT(*) AS count
       FROM users u
       JOIN user_roles ur ON ur.user_id = u.id
       WHERE u.id = '${adminUserId}' AND ur.role_id = '${adminRoleV2Id}'`
    );
    checks.push({
      name: 'Admin user role mapping is intact',
      ok: adminRoleLink === '1',
      details: `count=${adminRoleLink}`
    });

    const missingPermissions = await singleValue(
      pool,
      `SELECT COUNT(*) AS count
       FROM permissions p
       LEFT JOIN role_permissions rp
         ON rp.permission_id = p.id
        AND rp.role_id = '${adminRoleV2Id}'
        AND rp.allowed = TRUE
       WHERE rp.id IS NULL`
    );
    checks.push({
      name: 'Admin role has full permissions',
      ok: missingPermissions === '0',
      details: `missing_permissions=${missingPermissions}`
    });

    const gapResult = await pool.query(`
      SELECT 'countries' AS table_name, MIN(id) AS min_id, MAX(id) AS max_id, COUNT(*) AS row_count, COUNT(DISTINCT id) AS distinct_ids, (MAX(id) - MIN(id) + 1 - COUNT(*)) AS gap_count FROM countries
      UNION ALL
      SELECT 'states', MIN(id), MAX(id), COUNT(*), COUNT(DISTINCT id), (MAX(id) - MIN(id) + 1 - COUNT(*)) FROM states
      UNION ALL
      SELECT 'cities', MIN(id), MAX(id), COUNT(*), COUNT(DISTINCT id), (MAX(id) - MIN(id) + 1 - COUNT(*)) FROM cities
      UNION ALL
      SELECT 'areas', MIN(id), MAX(id), COUNT(*), COUNT(DISTINCT id), (MAX(id) - MIN(id) + 1 - COUNT(*)) FROM areas
      UNION ALL
      SELECT 'pincodes', MIN(id), MAX(id), COUNT(*), COUNT(DISTINCT id), (MAX(id) - MIN(id) + 1 - COUNT(*)) FROM pincodes
      UNION ALL
      SELECT 'pincodeAreas', MIN(id), MAX(id), COUNT(*), COUNT(DISTINCT id), (MAX(id) - MIN(id) + 1 - COUNT(*)) FROM "pincodeAreas"
      UNION ALL
      SELECT 'documentTypes', MIN(id), MAX(id), COUNT(*), COUNT(DISTINCT id), (MAX(id) - MIN(id) + 1 - COUNT(*)) FROM "documentTypes"
      UNION ALL
      SELECT 'verificationTypes', MIN(id), MAX(id), COUNT(*), COUNT(DISTINCT id), (MAX(id) - MIN(id) + 1 - COUNT(*)) FROM "verificationTypes"
      UNION ALL
      SELECT 'rateTypes', MIN(id), MAX(id), COUNT(*), COUNT(DISTINCT id), (MAX(id) - MIN(id) + 1 - COUNT(*)) FROM "rateTypes"
    `);

    for (const row of gapResult.rows) {
      const minId = Number(row.min_id);
      const maxId = Number(row.max_id);
      const rowCount = Number(row.row_count);
      const distinctIds = Number(row.distinct_ids);
      const gapCount = Number(row.gap_count);
      checks.push({
        name: `${row.table_name} IDs are contiguous`,
        ok: minId === 1 && maxId === rowCount && distinctIds === rowCount && gapCount === 0,
        details: `min=${minId} max=${maxId} rows=${rowCount} distinct=${distinctIds} gaps=${gapCount}`
      });
    }

    const brokenRefs = await pool.query(`
      SELECT 'states.countryId' AS ref_name, COUNT(*) AS broken_count FROM states s LEFT JOIN countries c ON c.id = s."countryId" WHERE c.id IS NULL
      UNION ALL
      SELECT 'cities.stateId', COUNT(*) FROM cities ci LEFT JOIN states s ON s.id = ci."stateId" WHERE s.id IS NULL
      UNION ALL
      SELECT 'cities.countryId', COUNT(*) FROM cities ci LEFT JOIN countries c ON c.id = ci."countryId" WHERE c.id IS NULL
      UNION ALL
      SELECT 'pincodes.cityId', COUNT(*) FROM pincodes p LEFT JOIN cities ci ON ci.id = p."cityId" WHERE ci.id IS NULL
      UNION ALL
      SELECT 'pincodeAreas.pincodeId', COUNT(*) FROM "pincodeAreas" pa LEFT JOIN pincodes p ON p.id = pa."pincodeId" WHERE p.id IS NULL
      UNION ALL
      SELECT 'pincodeAreas.areaId', COUNT(*) FROM "pincodeAreas" pa LEFT JOIN areas a ON a.id = pa."areaId" WHERE a.id IS NULL
    `);

    for (const row of brokenRefs.rows) {
      const brokenCount = Number(row.broken_count);
      checks.push({
        name: `${row.ref_name} references are valid`,
        ok: brokenCount === 0,
        details: `broken=${brokenCount}`
      });
    }

    const seqResult = await pool.query(`
      SELECT sequencename, last_value
      FROM pg_sequences
      WHERE schemaname = 'public'
        AND sequencename IN (
          'countries_temp_id_seq',
          'states_temp_id_seq',
          'cities_temp_id_seq',
          'areas_temp_id_seq',
          'pincodes_temp_id_seq',
          'pincodeAreas_temp_id_seq',
          'documentTypes_id_seq',
          'verificationTypes_temp_id_seq',
          'rateTypes_temp_id_seq'
        )
      ORDER BY sequencename
    `);

    const expectedSequences = new Map<string, number>([
      ['countries_temp_id_seq', 2],
      ['states_temp_id_seq', 2],
      ['cities_temp_id_seq', 4],
      ['areas_temp_id_seq', 862],
      ['pincodes_temp_id_seq', 215],
      ['pincodeAreas_temp_id_seq', 880],
      ['documentTypes_id_seq', 11],
      ['verificationTypes_temp_id_seq', 9],
      ['rateTypes_temp_id_seq', 8]
    ]);

    for (const row of seqResult.rows) {
      const expected = expectedSequences.get(String(row.sequencename));
      const actual = Number(row.last_value);
      checks.push({
        name: `${row.sequencename} is aligned`,
        ok: expected === actual,
        details: `expected=${expected} actual=${actual}`
      });
    }

    const failed = checks.filter(check => !check.ok);
    for (const check of checks) {
      const prefix = check.ok ? 'PASS' : 'FAIL';
      logger.info(`${prefix} ${check.name} (${check.details})`);
    }

    if (failed.length > 0) {
      throw new Error(`Database validation failed with ${failed.length} issue(s)`);
    }

    logger.info('Database validation passed');
  } finally {
    await pool.end();
  }
}

main().catch(error => {
  logger.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
