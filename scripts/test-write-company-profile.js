const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });

async function run() {
  const host = process.env.DB_HOST;
  const user = process.env.DB_USER;
  const password = process.env.DB_PASS;
  const database = process.env.DB_NAME;
  if (!user || !database) {
    console.error('Missing DB credentials');
    process.exit(1);
  }
  const pool = await mysql.createPool({ host, user, password, database, waitForConnections: true, connectionLimit: 2 });
  try {
    const testName = 'Test Company X';
    const testType = 'Corporation';
    console.log('Writing test company profile...', { testName, testType });
    await pool.execute(
      `INSERT INTO company_profile (id, company_name, address, tin, company_type)
       VALUES (1, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE company_name=VALUES(company_name), address=VALUES(address), tin=VALUES(tin), company_type=VALUES(company_type)`,
      [testName, 'Test Address', '000000000', testType]
    );
    const [rows] = await pool.query('SELECT id, company_name, address, tin, company_type FROM company_profile WHERE id=1');
    console.log('Read back row:', rows[0]);
  } catch (err) {
    console.error('Error:', err && err.stack ? err.stack : err);
    process.exitCode = 2;
  } finally {
    await pool.end();
  }
}

run();
