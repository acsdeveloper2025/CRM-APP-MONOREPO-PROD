// k6 smoke test — Phase F5.
//
// Fast sanity check that runs on every PR. 5 VUs, 30 seconds, three
// endpoints. Fails the run if p95 > 500ms or error rate > 1%.
//
// Usage:
//   k6 run scripts/load/smoke.js -e BASE_URL=http://localhost:3000 -e AUTH_TOKEN=...

import http from 'k6/http';
import { check, group, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';

export const options = {
  vus: 5,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1500'],
    http_req_failed: ['rate<0.01'],
    'http_req_duration{endpoint:health}': ['p(95)<50'],
    'http_req_duration{endpoint:cases_list}': ['p(95)<500'],
    'http_req_duration{endpoint:auth_me}': ['p(95)<200'],
  },
};

const authHeaders = () => ({
  Authorization: `Bearer ${AUTH_TOKEN}`,
  'Content-Type': 'application/json',
});

export default function () {
  group('health', () => {
    const res = http.get(`${BASE_URL}/api/health`, {
      tags: { endpoint: 'health' },
    });
    check(res, { 'health 200': r => r.status === 200 });
  });

  if (!AUTH_TOKEN) {
    // Unauthenticated smoke — only the public health endpoint.
    sleep(1);
    return;
  }

  group('auth_me', () => {
    const res = http.get(`${BASE_URL}/api/user`, {
      headers: authHeaders(),
      tags: { endpoint: 'auth_me' },
    });
    check(res, {
      'auth_me 200': r => r.status === 200,
      'auth_me has user': r => {
        try {
          return typeof r.json('data.id') === 'string';
        } catch {
          return false;
        }
      },
    });
  });

  group('cases_list', () => {
    const res = http.get(`${BASE_URL}/api/cases?page=1&limit=20`, {
      headers: authHeaders(),
      tags: { endpoint: 'cases_list' },
    });
    check(res, { 'cases_list 200': r => r.status === 200 });
  });

  sleep(1);
}
