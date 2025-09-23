// Run this script from the repository root to apply the SQL migration to your MySQL database.
// Usage: node scripts/apply-role-migration.js

const fs = require('fs');
const mysql = require('mysql2/promise');

async function run() {
  const sql = fs.readFileSync('database/20250923-add-reviewer-approver-to-roles.sql', 'utf8');
  const dbHost = process.env.DB_HOST || 'localhost';
  const dbUser = process.env.DB_USER || 'root';
  const dbPass = process.env.DB_PASS || '';
  const dbName = process.env.DB_NAME || 'accounting_db';
  const conn = await mysql.createConnection({ host: dbHost, user: dbUser, password: dbPass, database: dbName });
  try {
    console.log('Applying role migration...');
    const [result] = await conn.query(sql);
    console.log('Migration result:', result);
  } catch (e) {
    console.error('Migration failed:', e && e.stack ? e.stack : e);
  } finally {
    await conn.end();
  }
}

run();
