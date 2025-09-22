const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });

async function run() {
  const host = process.env.DB_HOST || '127.0.0.1';
  const user = process.env.DB_USER;
  const password = process.env.DB_PASS;
  const database = process.env.DB_NAME;
  const pool = await mysql.createPool({ host, user, password, database, waitForConnections: true, connectionLimit: 2 });
  try {
    const [rows, fields] = await pool.query('SELECT * FROM company_profile LIMIT 1');
    console.log('Fields:', fields.map(f => f.name).join(', '));
    console.log('Row sample:', rows[0]);
  } catch (err) {
    console.error(err && err.stack ? err.stack : err);
    process.exitCode = 2;
  } finally {
    await pool.end();
  }
}

run();
