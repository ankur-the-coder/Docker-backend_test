const fastify = require('fastify')({ logger: true });
const mysql = require('mysql2/promise');

// DB Connection Pool
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Complex Fibonacci function (CPU-intensive)
function fib(n) {
    if (n <= 1) {
        return n;
    }
    return fib(n - 1) + fib(n - 2);
}

// --- 1. Original Endpoint (I/O Stress) ---
fastify.get('/users/:id', async (request, reply) => {
    const userId = request.params.id;
    // Perform a simple I/O operation (DB Query)
    const [rows] = await pool.execute('SELECT name FROM users WHERE id = ?', [userId]);

    if (rows.length === 0) {
        reply.code(404).send({ error: 'user not found' });
    }

    return { id: userId, name: rows[0].name };
});

// --- 2. New Complex Endpoint (CPU + I/O Stress) ---
fastify.get('/complex/:n', async (request, reply) => {
    // 1. CPU-intensive calculation
    const n = parseInt(request.params.n);
    if (isNaN(n)) {
        reply.code(400).send({ error: 'invalid N parameter' });
    }

    const startTime = process.hrtime.bigint();
    const result = fib(n); // High complexity calculation
    const endTime = process.hrtime.bigint();
    const duration_ms = Number(endTime - startTime) / 1000000; // Nanoseconds to milliseconds

    // 2. I/O operation (DB Query)
    const [countRows] = await pool.execute('SELECT COUNT(*) as count FROM users');
    const count = countRows[0].count;

    // 3. Return results including the calculation time (for metric extraction)
    return { 
        fib_input: n, 
        fib_result: result, 
        calc_time_ms: duration_ms, // New metric
        db_rows: count,
        language: "Node.js",
    };
});

const start = async () => {
    try {
        await fastify.listen({ port: 3000, host: '0.0.0.0' });
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};
start();