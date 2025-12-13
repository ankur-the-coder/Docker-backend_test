import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics'; // Import Trend for custom metrics

// -----------------------------------------------------------------------
// CONFIGURATION & METRICS
// -----------------------------------------------------------------------
const PORT = __ENV.PORT || '3000';
const BASE_URL = `http://localhost:${PORT}`;
const COMPLEX_N = 38; // Fibonacci number for complexity
const complexCalcTime = new Trend('complex_calc_time_ms'); // New custom metric

// -----------------------------------------------------------------------
// LOAD SCENARIOS
// -----------------------------------------------------------------------
export const options = {
    // 1. Define custom metrics for the output
    thresholds: {
        http_req_duration: ['p(95)<500'],
        http_req_failed: ['rate<0.01'],
        complex_calc_time_ms: ['p(95)<1000'], // Example: 95% of calculation must be < 1000ms
    },
    // 2. Separate scenarios for I/O and CPU tests
    scenarios: {
        // Scenario A: I/O Bound Test (DB Query)
        io_test: {
            executor: 'constant-arrival-rate',
            rate: 200, // 200 requests per second
            timeUnit: '1s',
            duration: '60s',
            preAllocatedVUs: 500,
            exec: 'ioBoundTest',
        },
        // Scenario B: CPU + I/O Bound Test (Complex Calculation + DB Query)
        complex_test: {
            executor: 'constant-arrival-rate',
            rate: 10, // Lower rate for CPU-intensive task
            timeUnit: '1s',
            duration: '60s',
            preAllocatedVUs: 50,
            exec: 'cpuBoundTest',
        },
    },
};

// -----------------------------------------------------------------------
// I/O BOUND TEST FUNCTION
// -----------------------------------------------------------------------
export function ioBoundTest() {
    const randomId = Math.floor(Math.random() * 3) + 1;
    const res = http.get(`${BASE_URL}/users/${randomId}`);
    check(res, {
        'IO: status is 200': (r) => r.status === 200,
    });
    sleep(0.1);
}

// -----------------------------------------------------------------------
// CPU BOUND TEST FUNCTION
// -----------------------------------------------------------------------
export function cpuBoundTest() {
    const res = http.get(`${BASE_URL}/complex/${COMPLEX_N}`);

    check(res, {
        'CPU: status is 200': (r) => r.status === 200,
    });

    // Extract custom metric from JSON response
    try {
        const jsonBody = res.json();
        if (jsonBody && jsonBody.calc_time_ms !== undefined) {
            // Add the calculation time to the custom trend metric
            complexCalcTime.add(jsonBody.calc_time_ms);
        }
    } catch (e) {
        // Handle non-JSON or failed responses gracefully
        console.error(`Error parsing JSON or extracting metric: ${e}`);
    }

    sleep(0.1);
}