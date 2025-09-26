const fs = require('fs');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
  const sql = fs.readFileSync(__dirname + '/../database/all_migrations.sql', 'utf8');
  const db = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'accountingsystem',
    multipleStatements: true
  });
  try {
    console.log('Running consolidated migrations...');
    const stmts = sql.split(/;\s*\n/).map(s => s.trim()).filter(s => s.length);
    for (const s of stmts) {
      try {
        await db.query(s + ';');
      } catch (e) {
        console.warn('Statement failed (continuing):', e.message);
      }
    }
    console.log('Migrations finished.');
  } finally {
    await db.end();
  }
}

run().catch(err => { console.error(err); process.exit(1); });
