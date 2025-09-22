const path = require('path');
const fs = require('fs');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });

async function run() {
  const sqlPath = path.resolve(__dirname, '../database/20250922-rename-name-type-to-company_name_company_type.sql');
  if (!fs.existsSync(sqlPath)) {
    console.error('Migration file not found:', sqlPath);
    process.exit(1);
  }
  const sql = fs.readFileSync(sqlPath, 'utf8');

  const host = process.env.DB_HOST || '127.0.0.1';
  const user = process.env.DB_USER;
  const password = process.env.DB_PASS;
  const database = process.env.DB_NAME;

  if (!user || !database) {
    console.error('Missing DB credentials in backend/.env (DB_USER, DB_NAME)');
    process.exit(1);
  }

  console.log('Connecting to DB', { host, user, database });
  const pool = await mysql.createPool({ host, user, password, database, waitForConnections: true, connectionLimit: 2 });

  // Split statements by semicolon at line end. Remove comments and empty parts.
  const parts = sql
    .split(/;\s*\n/)
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('--'));

  try {
    for (const part of parts) {
      console.log('Executing SQL:', part.split('\n')[0].slice(0, 200));
      await pool.query(part);
    }
    console.log('Migration executed successfully.');
  } catch (err) {
    console.error('Migration error:', err && err.stack ? err.stack : err);
    process.exitCode = 2;
  } finally {
    await pool.end();
  }
}

run();
