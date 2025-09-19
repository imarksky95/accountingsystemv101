const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function main() {
  const sqlPath = path.resolve(__dirname, '../database/ap-management.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  // Read DB credentials from backend/.env if present
  const envPath = path.resolve(__dirname, '../backend/.env');
  const parseEnv = (p) => {
    if (!fs.existsSync(p)) return {};
    const c = fs.readFileSync(p, 'utf8');
    return c.split(/\r?\n/).reduce((acc, line) => {
      const t = line.trim();
      if (!t || t.startsWith('#')) return acc;
      const idx = t.indexOf('=');
      if (idx === -1) return acc;
      acc[t.slice(0, idx)] = t.slice(idx+1);
      return acc;
    }, {});
  };
  const fileEnv = parseEnv(envPath);

  const pool = await mysql.createPool({
    host: fileEnv.DB_HOST || process.env.DB_HOST || 'localhost',
    user: fileEnv.DB_USER || process.env.DB_USER || 'root',
    password: fileEnv.DB_PASS || process.env.DB_PASS || '',
    database: fileEnv.DB_NAME || process.env.DB_NAME || 'accounting_db',
    waitForConnections: true,
    connectionLimit: 5
  });

  try {
    console.log('Applying AP schema...');
    // Split on semicolon followed by newline to execute statements individually
    const statements = sql.split(/;\s*\n/).map(s => s.trim()).filter(Boolean);
    // Ensure database exists by connecting without a database and creating it if needed
    const dbName = process.env.DB_NAME || 'accounting_db';
    try {
      const conn0 = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASS || ''
      });
      await conn0.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
      await conn0.end();
      console.log(`Ensured database exists: ${dbName}`);
    } catch (e) {
      console.warn('Could not ensure database exists:', e.code || e.message, e);
    }

    // Test connection
    try {
      const [testRows] = await pool.query('SELECT 1 AS ok');
      if (!testRows) throw new Error('Test query returned no rows');
      console.log('DB connection test passed');
    } catch (e) {
      console.error('DB connection test failed:', e.code || e.message, e);
      throw e;
    }

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      try {
        if (!stmt.trim()) continue;
        console.log(`Executing statement ${i+1}/${statements.length}`);
        await pool.query(stmt);
      } catch (e) {
        // log and continue
        console.warn(`Statement ${i+1} failed (continuing): code=${e.code} errno=${e.errno} sqlState=${e.sqlState}`);
        console.warn('Error object:', e);
        console.warn('Statement content:', stmt.slice(0,400));
      }
    }

    console.log('Inserting sample payment voucher...');
    const [pvResult] = await pool.execute(
      'INSERT INTO payment_vouchers (payment_voucher_control, status, preparation_date, purpose, paid_through, prepared_by, payee, description, amount_to_pay, coa_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ['PV-SAMPLE-1', 'Draft', '2025-09-19', 'Sample payment', 'Bank', 1, 'Sample Payee', 'Sample description', 1000.00, null]
    );

    console.log('Inserted Payment Voucher ID:', pvResult.insertId);

    console.log('Querying payment_vouchers...');
    const [rows] = await pool.execute('SELECT payment_voucher_id, payment_voucher_control, status, amount_to_pay, created_at FROM payment_vouchers ORDER BY payment_voucher_id DESC LIMIT 5');
    console.table(rows);

    // Insert a disbursement report linking the PV
    console.log('Inserting disbursement report and link...');
    const [drResult] = await pool.execute(
      'INSERT INTO disbursement_reports (disbursement_report_ctrl_number, status, disbursement_date, purpose, amount_to_pay, paid_through, prepared_by, approved) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ['DR-SAMPLE-1', 'Draft', '2025-09-19', 'Sample DR', 1000.00, 'Bank', 1, 0]
    );
    const drId = drResult.insertId;
    await pool.execute('INSERT INTO disbursement_report_vouchers (disbursement_report_id, payment_voucher_id) VALUES (?, ?)', [drId, pvResult.insertId]);
    console.log('Inserted DR and link');

    // Query DR with joined vouchers
    const [drRows] = await pool.execute(
      'SELECT d.disbursement_report_id, d.disbursement_report_ctrl_number, d.amount_to_pay, p.payment_voucher_id, p.payment_voucher_control FROM disbursement_reports d LEFT JOIN disbursement_report_vouchers dv ON d.disbursement_report_id = dv.disbursement_report_id LEFT JOIN payment_vouchers p ON dv.payment_voucher_id = p.payment_voucher_id WHERE d.disbursement_report_id = ?', [drId]
    );
    console.table(drRows);

    console.log('Done.');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    pool.end();
  }
}

main();
