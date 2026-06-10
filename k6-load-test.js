import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 100 },  // Ramp up to 100 users
    { duration: '1m', target: 500 },   // Spike to 500 users
    { duration: '2m', target: 5000 },  // Spike to 5000 users
    { duration: '1m', target: 10000 }, // Sustain 10000 concurrent users
    { duration: '30s', target: 0 },    // Ramp down to 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests should be below 500ms
    http_req_failed: ['rate<0.01'],   // Error rate should be less than 1%
  },
};

export default function () {
  // Test 1: Hit the paginated data endpoint
  const res = http.get('http://localhost:10000/api/data?page=1&limit=100');
  check(res, {
    'status was 200': (r) => r.status == 200,
    'transaction time OK': (r) => r.timings.duration < 500,
  });

  // Test 2: Hit the health endpoint
  const healthRes = http.get('http://localhost:10000/api/health');
  check(healthRes, {
    'health status 200': (r) => r.status == 200,
  });

  // Simulate user think time
  sleep(1);
}
