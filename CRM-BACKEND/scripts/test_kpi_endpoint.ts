
import { DashboardKPIController } from '../src/controllers/dashboardKPIController';
import { pool } from '../src/config/database';

async function testKPIEndpoint() {
  console.log('--- TESTING KPI ENDPOINT LOGIC ---');

  try {
    // Mock Request
    const req: any = {
      user: { id: 'test-user-id', role: 'ADMIN' }, // Adjust as needed
      query: {
        // Test filters if needed
        // clientId: '1',
      }
    };

    // Mock Response
    const res: any = {
      json: (data: any) => {
        console.log('\nResponse Received:');
        console.log(JSON.stringify(data, null, 2));
        
        if (data.success && data.data) {
           const kpi = data.data;
           console.log('\n--- VERIFICATION SUMMARY ---');
           console.log(`Total Tasks: ${kpi.workload?.total_tasks?.value}`);
           console.log(`Open Tasks: ${kpi.workload?.open_tasks?.value}`);
           console.log(`Completed Today: ${kpi.workload?.completed_today}`);
           console.log(`Active Field Agents Today: ${kpi.legacy_compatibility?.field_agents?.active_today?.value}`);
           console.log(`Avg TAT (Days): ${kpi.performance?.avg_tat_days?.value}`);
        }
      },
      status: (code: number) => {
        console.log(`\nStatus Code: ${code}`);
        return res;
      }
    };

    console.log('Calling DashboardKPIController.getKPIs()...');
    await DashboardKPIController.getKPIs(req, res);

  } catch (error) {
    console.error('Test Failed:', error);
  } finally {
    await pool.end();
  }
}

testKPIEndpoint();
