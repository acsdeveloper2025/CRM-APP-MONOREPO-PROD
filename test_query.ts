import { pool } from './crm-backend/src/config/database';

async function testQuery() {
  const thresholdDays = 3;
  const limitNum = 20;
  const offset = 0;
  const sortBy = 'days_overdue';
  const sortOrder = 'desc';

  const conditions = [
    `vt.status NOT IN ('COMPLETED', 'REVOKED', 'CANCELLED')`,
    `vt.created_at < NOW() - INTERVAL '${thresholdDays} days'`,
  ];
  const params = [];
  let paramIdx = 1;

  const whereClause = conditions.join(' AND ');

  const sortFieldMap = {
    task_number: 'vt.task_number',
    customer_name: 'c."customerName"',
    days_overdue: 'days_overdue',
    status: 'vt.status',
    priority: 'vt.priority',
    created_at: 'vt.created_at',
  };
  const orderBy = sortFieldMap[sortBy] || 'days_overdue';
  const direction = sortOrder === 'asc' ? 'ASC' : 'DESC';

  const query = `
    SELECT 
      vt.id,
      vt.task_number as "taskNumber",
      vt.case_id as "caseId",
      c."caseId" as "caseNumber",
      c."customerName" as "customerName",
      vt.status,
      vt.priority,
      vtype.name as "verificationTypeName",
      u.name as "assignedToName",
      EXTRACT(EPOCH FROM (NOW() - vt.created_at))/86400 as days_overdue
    FROM verification_tasks vt
    LEFT JOIN cases c ON vt.case_id = c.id
    LEFT JOIN users u ON vt.assigned_to = u.id
    LEFT JOIN "verificationTypes" vtype ON vt.verification_type_id = vtype.id
    WHERE ${whereClause}
    ORDER BY ${orderBy} ${direction}
    LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
  `;

  console.log('Running query:', query);
  console.log('Params:', [...params, limitNum, offset]);

  try {
    const res = await pool.query(query, [...params, limitNum, offset]);
    console.log('Query success! Row count:', res.rowCount);
  } catch (err) {
    console.error('Query failed!', err);
  } finally {
    await pool.end();
  }
}

testQuery();
