#!/usr/bin/env node

/**
 * Production Health Check Script
 * Monitors the health of all CRM services
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const SERVICES = {
  backend: 'http://103.14.234.36:3000/api/health',
  frontend: 'http://103.14.234.36:5173',
  mobile: 'http://103.14.234.36:5180',
  domain: 'https://crm.allcheckservices.com/api/health'
};

const LOG_FILE = path.join(__dirname, '../../logs/health-check.log');

async function checkService(name, url) {
  try {
    const response = await axios.get(url, { timeout: 5000 });
    const status = response.status === 200 ? 'UP' : 'DOWN';
    const message = `${new Date().toISOString()} - ${name}: ${status} (${response.status})`;
    
    console.log(message);
    fs.appendFileSync(LOG_FILE, message + '\n');
    
    return { name, status, url, responseTime: response.headers['x-response-time'] || 'N/A' };
  } catch (error) {
    const message = `${new Date().toISOString()} - ${name}: DOWN (${error.message})`;
    console.error(message);
    fs.appendFileSync(LOG_FILE, message + '\n');
    
    return { name, status: 'DOWN', url, error: error.message };
  }
}

async function runHealthCheck() {
  console.log('🏥 Running CRM System Health Check...\n');
  
  const results = [];
  
  for (const [name, url] of Object.entries(SERVICES)) {
    const result = await checkService(name, url);
    results.push(result);
  }
  
  console.log('\n📊 Health Check Summary:');
  console.log('========================');
  
  results.forEach(result => {
    const status = result.status === 'UP' ? '✅' : '❌';
    console.log(`${status} ${result.name.toUpperCase()}: ${result.status}`);
    if (result.responseTime) {
      console.log(`   Response Time: ${result.responseTime}`);
    }
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });
  
  const healthyServices = results.filter(r => r.status === 'UP').length;
  const totalServices = results.length;
  
  console.log(`\n🎯 Overall Health: ${healthyServices}/${totalServices} services UP`);
  
  if (healthyServices === totalServices) {
    console.log('🎉 All services are healthy!');
    process.exit(0);
  } else {
    console.log('⚠️  Some services are down. Check logs for details.');
    process.exit(1);
  }
}

// Run health check
runHealthCheck().catch(error => {
  console.error('❌ Health check failed:', error);
  process.exit(1);
});
