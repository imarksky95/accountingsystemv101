const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function readEnv() {
  const envPath = path.join(__dirname, '..', 'backend', '.env');
  const txt = await fs.promises.readFile(envPath, 'utf8');
  const lines = txt.split(/\r?\n/).filter(Boolean);
  const out = {};
  for (const l of lines) {
    const m = l.match(/^([^=]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

async function run(){
  const env = await readEnv();
  const conn = await mysql.createConnection({
    host: env.DB_HOST,
    user: env.DB_USER,
    password: env.DB_PASS,
    database: env.DB_NAME,
  });
  const [rows] = await conn.execute('SELECT user_id, username FROM users LIMIT 50');
  console.log(rows);
  await conn.end();
}

run().catch(e=>{ console.error(e); process.exit(1); });
