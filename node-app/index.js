const fastify = require('fastify')({ logger: false });
const mysql = require('mysql2/promise');

/* ---------- DB ---------- */

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  connectionLimit: 10
});

/* ---------- PRIME ---------- */

function isPrime(num) {
  if (num <= 1) return false;
  for (let i = 2; i * i <= num; i++) {
    if (num % i === 0) return false;
  }
  return true;
}

function compute10kPrime() {
  let count = 0, num = 2;
  while (count < 10000) {
    if (isPrime(num)) count++;
    num++;
  }
  return num - 1;
}

/* ---------- ROUTES ---------- */

fastify.get('/db/:id', async (req) => {
  const [rows] = await pool.query(
    'SELECT id, name, email FROM users WHERE id = ?',
    [req.params.id]
  );
  return rows[0] || {};
});

fastify.get('/calc', async () => {
  return { result: compute10kPrime() };
});

/* ---------- START ---------- */

fastify.listen({ port: 3000, host: '0.0.0.0' });
