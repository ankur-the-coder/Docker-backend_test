import http from 'k6/http';
import { check } from 'k6';

const PORT = __ENV.PORT || '3000';
const MODE = __ENV.MODE || 'db';
const BASE_URL = `http://localhost:${PORT}`;

export const options = {
  scenarios: {
    saturation: {
      executor: 'ramping-arrival-rate',
      startRate: 50,
      timeUnit: '1s',
      preAllocatedVUs: 500,
      maxVUs: 5000,
      stages: [
        { duration: '1m', target: 100 },
        { duration: '1m', target: 300 },
        { duration: '1m', target: 600 },
        { duration: '1m', target: 1000 },
        { duration: '1m', target: 1500 },
        { duration: '1m', target: 2000 },
        { duration: '1m', target: 3000 },
      ],
    },
  },
};

export default function () {
  let res;

  if (MODE === 'db') {
    const id = Math.floor(Math.random() * 3) + 1;
    res = http.get(`${BASE_URL}/db/${id}`, { timeout: '60s' });
  } else {
    res = http.get(`${BASE_URL}/calc`, { timeout: '60s' });
  }

  check(res, {
    'status ok': r => r.status === 200,
  });
}
