const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

function parseEnv(envPath) {
  const content = fs.readFileSync(envPath, 'utf8');
  const lines = content.split(/\r?\n/);
  const out = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const k = trimmed.slice(0, idx);
    const v = trimmed.slice(idx+1);
    out[k] = v;
  }
  return out;
}

async function main() {
  const envPath = path.resolve(__dirname, '../backend/.env');
  if (!fs.existsSync(envPath)) {
    console.error('No backend .env found at', envPath);
    process.exit(2);
  }
  const env = parseEnv(envPath);
  console.log('Using DB settings from backend/.env (host):', env.DB_HOST);

  const pool = mysql.createPool({
    host: env.DB_HOST || 'localhost',
    user: env.DB_USER || 'root',
    password: env.DB_PASS || '',
    database: env.DB_NAME || undefined,
    waitForConnections: true,
    connectionLimit: 2,
    connectTimeout: 5000
  });

  try {
    console.log('Attempting connection...');
    const [rows] = await pool.query('SELECT 1 as ok');
    console.log('Connection succeeded:', rows);
    await pool.end();
    process.exit(0);
  } catch (e) {
    console.error('Connection failed:', e.code || e.message);
    console.error(e);
    process.exit(1);
  }
}

main();
