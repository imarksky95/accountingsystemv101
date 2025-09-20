/* Seed script to add sample contacts and chart of accounts entries if missing.

Run with: `node scripts/seed-contacts-coa.js` from project root (uses .env in backend/).
It uses same DB env vars as `backend/.env` or environment.
*/

const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', 'backend', '.env') });

async function main() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'accounting_db',
    waitForConnections: true,
    connectionLimit: 5,
  });

  try {
    // Contacts
    const contacts = [
      { display_name: 'Cashier', contact_type: 'Employee', contact_info: 'cashier@example.com' },
      { display_name: 'Vendor A', contact_type: 'Vendor', contact_info: 'vendorA@example.com' },
      { display_name: 'Vendor B', contact_type: 'Vendor', contact_info: 'vendorB@example.com' }
    ];

    for (const c of contacts) {
      const [rows] = await pool.execute('SELECT 1 FROM contacts WHERE display_name = ? LIMIT 1', [c.display_name]);
      if (rows.length === 0) {
        const [r] = await pool.execute('INSERT INTO contacts (contact_control, display_name, contact_type, contact_info) VALUES (NULL, ?, ?, ?)', [c.display_name, c.contact_type, c.contact_info]);
        const generated = 'CT-' + String(r.insertId).padStart(4, '0');
        await pool.execute('UPDATE contacts SET contact_control = ? WHERE contact_id = ?', [generated, r.insertId]);
        console.log('Inserted contact', c.display_name);
      } else {
        console.log('Contact exists', c.display_name);
      }
    }

    // Chart of Accounts
    const coas = [
      { account_number: '1000', account_name: 'Cash', account_type: 'Asset' },
      { account_number: '2000', account_name: 'Accounts Payable', account_type: 'Liability' },
      { account_number: '3000', account_name: 'Utilities', account_type: 'Expense' }
    ];

    for (const a of coas) {
      const [rows] = await pool.execute('SELECT 1 FROM chart_of_accounts WHERE account_number = ? LIMIT 1', [a.account_number]);
      if (rows.length === 0) {
        const [cntRows] = await pool.execute('SELECT COUNT(*) as count FROM chart_of_accounts');
        const control = 'COA-' + (cntRows[0].count + 1);
        await pool.execute('INSERT INTO chart_of_accounts (control_number, account_number, account_name, account_type, deleted) VALUES (?, ?, ?, ?, 0)', [control, a.account_number, a.account_name, a.account_type]);
        console.log('Inserted COA', a.account_number, a.account_name);
      } else {
        console.log('COA exists', a.account_number);
      }
    }

    console.log('Seeding complete');
    await pool.end();
  } catch (err) {
    console.error('Seeding error', err);
    process.exit(1);
  }
}

main();
