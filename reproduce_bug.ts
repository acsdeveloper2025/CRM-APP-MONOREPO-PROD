import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, 'crm-backend/.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function reproduceController() {
  const queryParams = {
    threshold: '3',
    page: '1',
    limit: '20',
    sortBy: 'days_overdue',
    sortOrder: 'desc',
  };

  try {
    const {
      threshold = '1',
      page = 1,
      limit = 20,
      sortBy = 'days_overdue',
      sortOrder = 'desc',
      search,
      priority,
      status,
    } = queryParams;

    const thresholdDays = parseInt(threshold as string);
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    const clientId = undefined;
    const effectiveAgentId = undefined;

    const conditions: string[] = [
      `vt.status NOT IN ('COMPLETED', 'REVOKED', 'CANCELLED')`,
      `vt.created_at < NOW() - INTERVAL '${thresholdDays} days'`,
    ];
    const params: (string | number)[] = [];
    let paramIdx = 1;

    if (clientId) {
      conditions.push(`c."clientId" = $${paramIdx}`);
      params.push(Number(clientId));
      paramIdx++;
    }

    if (effectiveAgentId) {
      conditions.push(`vt.assigned_to = $${paramIdx}`);
      params.push(effectiveAgentId);
      paramIdx++;
    }

    if (search) {
      conditions.push(
        `(vt.task_number ILIKE $${paramIdx} OR c."caseId"::text ILIKE $${paramIdx} OR c."customerName" ILIKE $${paramIdx})`
      );
      params.push(`%${search as string}%`);
      paramIdx++;
    }

    const whereClause = conditions.join(' AND ');

    const sortFieldMap: Record<string, string> = {
      task_number: 'vt.task_number',
      customer_name: 'c."customerName"',
      days_overdue: 'days_overdue',
      status: 'vt.status',
      priority: 'vt.priority',
      created_at: 'vt.created_at',
    };
    const orderBy = sortFieldMap[sortBy as string] || 'days_overdue';
    const direction = sortOrder === 'asc' ? 'ASC' : 'DESC';

    const queryStr = `
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

    const countQuery = `
      SELECT COUNT(*) 
      FROM verification_tasks vt
      LEFT JOIN cases c ON vt.case_id = c.id
      WHERE ${whereClause}
    `;

    console.log('Main Query Params:', [...params, limitNum, offset]);
    console.log('Count Query Params:', params);

    const [tasksRes, countRes] = await Promise.all([
      pool.query(queryStr, [...params, limitNum, offset]),
      pool.query(countQuery, params),
    ]);

    const totalCount = parseInt(countRes.rows[0].count);
    const totalPages = Math.ceil(totalCount / limitNum);

    const formattedTasks = tasksRes.rows.map(t => ({
      ...t,
      daysOverdue: Math.floor(parseFloat(t.days_overdue)),
    }));

    console.log('Successfully fetched', formattedTasks.length, 'tasks');
    console.log('Total count:', totalCount);

  } catch (error) {
    console.error('CRITICAL REPRODUCTION ERROR:', error);
  } finally {
    await pool.end();
  }
}

reproduceController();
