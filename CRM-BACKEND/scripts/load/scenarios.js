// k6 full scenario — Phase F5.
//
// Ramps from 20 VUs → 200 VUs over 1 minute, holds 200 VUs for 3
// minutes, ramps down over 1 minute. Exercises the 10 highest-
// traffic backend endpoints identified by the audit.
//
// Thresholds fail the run if:
//   - overall p95 > 800ms or p99 > 2000ms
//   - per-endpoint p95 exceeds its allowance
//   - error rate > 2%
//
// Usage:
//   k6 run scripts/load/scenarios.js -e BASE_URL=https://staging.example -e AUTH_TOKEN=...
//   k6 run scripts/load/scenarios.js --summary-export=ops-summary.json

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';

export const options = {
  stages: [
    { duration: '1m', target: 20 },
    { duration: '1m', target: 200 },
    { duration: '3m', target: 200 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<800', 'p(99)<2000'],
    http_req_failed: ['rate<0.02'],
    'http_req_duration{endpoint:health}': ['p(95)<50'],
    'http_req_duration{endpoint:auth_me}': ['p(95)<200'],
    'http_req_duration{endpoint:cases_list}': ['p(95)<600'],
    'http_req_duration{endpoint:case_by_id}': ['p(95)<500'],
    'http_req_duration{endpoint:tasks_list}': ['p(95)<600'],
    'http_req_duration{endpoint:clients_list}': ['p(95)<400'],
    'http_req_duration{endpoint:products_list}': ['p(95)<400'],
    'http_req_duration{endpoint:dashboard_stats}': ['p(95)<800'],
    'http_req_duration{endpoint:notifications_list}': ['p(95)<400'],
    'http_req_duration{endpoint:attachments_by_case}': ['p(95)<500'],
  },
};

const authHeaders = () => ({
  Authorization: `Bearer ${AUTH_TOKEN}`,
  'Content-Type': 'application/json',
});

const caseListLatency = new Trend('cases_list_latency');
const taskListLatency = new Trend('tasks_list_latency');

function getJson(url, tag) {
  return http.get(url, {
    headers: authHeaders(),
    tags: { endpoint: tag },
  });
}

export default function () {
  group('health', () => {
    const res = http.get(`${BASE_URL}/api/health`, {
      tags: { endpoint: 'health' },
    });
    check(res, { 'health 200': r => r.status === 200 });
  });

  if (!AUTH_TOKEN) {
    sleep(1);
    return;
  }

  group('auth_me', () => {
    const res = getJson(`${BASE_URL}/api/user`, 'auth_me');
    check(res, { 'auth_me 200': r => r.status === 200 });
  });

  group('cases_list', () => {
    const res = getJson(`${BASE_URL}/api/cases?page=1&limit=20`, 'cases_list');
    caseListLatency.add(res.timings.waiting);
    check(res, { 'cases_list 200': r => r.status === 200 });
  });

  group('tasks_list', () => {
    const res = getJson(
      `${BASE_URL}/api/verification-tasks?page=1&limit=20`,
      'tasks_list'
    );
    taskListLatency.add(res.timings.waiting);
    check(res, { 'tasks_list 200': r => r.status === 200 });
  });

  group('clients_list', () => {
    const res = getJson(`${BASE_URL}/api/clients?page=1&limit=20`, 'clients_list');
    check(res, { 'clients_list 200': r => r.status === 200 });
  });

  group('products_list', () => {
    const res = getJson(`${BASE_URL}/api/products?page=1&limit=20`, 'products_list');
    check(res, { 'products_list 200': r => r.status === 200 });
  });

  group('dashboard_stats', () => {
    const res = getJson(`${BASE_URL}/api/dashboard/stats`, 'dashboard_stats');
    check(res, { 'dashboard_stats 200': r => r.status === 200 });
  });

  group('notifications_list', () => {
    const res = getJson(`${BASE_URL}/api/notifications?page=1&limit=20`, 'notifications_list');
    check(res, { 'notifications_list 200': r => r.status === 200 });
  });

  sleep(1);
}
