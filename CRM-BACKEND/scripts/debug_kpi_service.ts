
import { DashboardKPIService } from '../src/services/dashboardKPIService';
import { pool } from '../src/config/database';

async function debugService() {
  console.log('--- DEBUGGING KPI SERVICE ---');
  try {
    const kpis = await DashboardKPIService.getKPIs({});
    console.log('Success!');
    console.log(JSON.stringify(kpis, null, 2));
  } catch (error) {
    console.error('SERVICE ERROR:', error);
  } finally {
    await pool.end();
  }
}

debugService();
