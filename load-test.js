import http from 'k6/http';
import { check } from 'k6';

// -----------------------------------------------------------------------
// DYNAMIC CONFIGURATION
// -----------------------------------------------------------------------
const PORT = __ENV.PORT || '3000';
const MODE = __ENV.MODE || 'db'; // 'db' or 'calc'
const BASE_URL = `http://localhost:${PORT}`;

// -----------------------------------------------------------------------
// STRESS TEST SCENARIO
// -----------------------------------------------------------------------
// We ramp up connections aggressively to find the breaking point ( > 1000ms)
export const options = {
  scenarios: {
    breaking_point: {
      executor: 'ramping-vus',
      startVUs: 10,
      stages: [
        { duration: '15s', target: 100 },   // Warm up
        { duration: '2m', target: 2000 },   // Ramp up to 2000 concurrent users
        { duration: '15s', target: 0 },     // Cooldown
      ],
    },
  },
  thresholds: {
    // We want to see at what concurrency the 95th percentile exceeds 1000ms
    http_req_duration: ['p(95)<1000'], 
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  let res;

  if (MODE === 'db') {
    const randomId = Math.floor(Math.random() * 3) + 1;
    res = http.get(`${BASE_URL}/db/${randomId}`);
  } else {
    res = http.get(`${BASE_URL}/calc`);
  }

  check(res, {
    'status is 200': (r) => r.status === 200,
  });
}