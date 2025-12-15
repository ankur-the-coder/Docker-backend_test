const fastify = require('fastify')({ logger: false });
const mysql = require('mysql2/promise');
const { Worker } = require('worker_threads');
const os = require('os');

/* ---------- DB ---------- */

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    connectionLimit: 10
});

/* ---------- WORKER POOL ---------- */

const WORKERS = os.cpus().length;
const QUEUE_LIMIT = 5000;

const workers = [];
const queue = [];

for (let i = 0; i < WORKERS; i++) {
    const worker = new Worker('./worker.js');
    worker.busy = false;
    workers.push(worker);
}

function runJob() {
    const worker = workers.find(w => !w.busy);
    if (!worker || queue.length === 0) return;

    worker.busy = true;
    const job = queue.shift();

    worker.once('message', result => {
        worker.busy = false;
        job.resolve(result);
        runJob();
    });

    worker.postMessage('go');
}

function submitJob() {
    return new Promise((resolve, reject) => {
        if (queue.length >= QUEUE_LIMIT) {
            reject(new Error('busy'));
            return;
        }
        queue.push({ resolve });
        runJob();
    });
}

/* ---------- ROUTES ---------- */

fastify.get('/db/:id', async (req) => {
    const [rows] = await pool.query(
        'SELECT id, name, email FROM users WHERE id = ?',
        [req.params.id]
    );
    return rows[0];
});

fastify.get('/calc', async (req, reply) => {
    try {
        const result = await submitJob();
        return { result };
    } catch {
        reply.code(429).send({ error: 'server busy' });
    }
});

/* ---------- START ---------- */

fastify.listen({ port: 3000, host: '0.0.0.0' });
