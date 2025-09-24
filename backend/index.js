const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const mysql = require('mysql2/promise');

const app = express();

// CORS middleware - allow specific origins. Accept GitHub Pages origins by suffix
const allowedOrigins = [
  process.env.FRONTEND_ORIGIN || 'http://localhost:3000',
  'https://imarksky95.github.io',
  'https://imarksky95.github.io/accountingsystemv101',
  'https://accountingsystemv101.onrender.com'
];

app.use(cors({
  origin: function(origin, callback) {
    // allow requests with no origin (like curl, server-to-server)
    if (!origin) return callback(null, true);
    // allow explicit whitelist
    if (allowedOrigins.indexOf(origin) !== -1) return callback(null, true);
    // allow any GitHub Pages origin (user pages) -- helpful for gh-pages hosting
    try {
      const url = new URL(origin);
      if (url.hostname && url.hostname.endsWith('.github.io')) return callback(null, true);
    } catch (e) {
      // ignore
    }
    // allow a broad override via env var for quick testing
    if (process.env.ALLOW_ALL_ORIGINS === '1') return callback(null, true);
    console.warn('Blocked CORS request from origin:', origin);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  optionsSuccessStatus: 200
}));



// Increase request body limits to allow base64 logo uploads (default is ~100kb)
app.use(express.json({ limit: process.env.EXPRESS_JSON_LIMIT || '5mb' }));
app.use(express.urlencoded({ extended: true, limit: process.env.EXPRESS_URLENCODED_LIMIT || '5mb' }));

// Database connection pool
const dbPool = mysql.createPool({
  host: process.env.DB_HOST || '148.222.53.12',
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});
app.set('dbPool', dbPool);

// Routes
const companyProfileRoutes = require('./companyProfile');
app.use('/api', companyProfileRoutes);

const authRoutes = require('./auth');
app.use('/api/auth', authRoutes);

const coaRoutes = require('./coa');
app.use('/api/coa', coaRoutes);

// AP Management routes
const paymentVoucherRoutes = require('./paymentVoucher');
app.use('/api/payment-vouchers', paymentVoucherRoutes);

const checkVoucherRoutes = require('./checkVoucher');
app.use('/api/check-vouchers', checkVoucherRoutes);

const scheduledPaymentRoutes = require('./scheduledPayment');
app.use('/api/scheduled-payments', scheduledPaymentRoutes);

const disbursementReportRoutes = require('./disbursementReport');
app.use('/api/disbursement-reports', disbursementReportRoutes);

const vendorsRoutes = require('./vendors');
app.use('/api/vendors', vendorsRoutes);

const contactsRoutes = require('./contacts');
app.use('/api/contacts', contactsRoutes);

// Debug routes
const debugRoutes = require('./debug');
app.use('/api/debug', debugRoutes);

// Role management (basic example)
app.get('/api/roles', async (req, res, next) => {
  try {
    const [rows] = await dbPool.execute('SELECT * FROM roles');
    // Return rows as-is but ensure role_type is present
    const normalized = rows.map(r => Object.assign({}, r, { role_type: r.role_type || 'none' }));
    res.json(normalized);
  } catch (err) {
    next(err);
  }
});

const authenticateToken = require('./middleware/authenticate');

// Update role metadata (reviewer/approver). Accepts arrays or strings.
// Protected: requires authenticated user with admin privileges (role_id === 1)
app.put('/api/roles/:role_id', authenticateToken, async (req, res, next) => {
  try {
    // Basic authorization: only allow role_id 1 (Super Admin) to update roles
    const actorRoleId = req.user && req.user.role_id;
    if (!actorRoleId || Number(actorRoleId) !== 1) {
      return res.status(403).json({ error: 'Forbidden: requires admin role' });
    }
    const roleId = parseInt(req.params.role_id, 10);
    if (Number.isNaN(roleId)) return res.status(400).json({ error: 'Invalid role_id' });


    const { role_type } = req.body || {};
    const allowed = ['none','reviewer','approver','both'];
    const rt = allowed.includes(role_type) ? role_type : 'none';

    const sql = 'UPDATE roles SET role_type = ? WHERE role_id = ?';
    const [result] = await dbPool.execute(sql, [rt, roleId]);

    if (result && result.affectedRows === 0) {
      return res.status(404).json({ error: 'Role not found' });
    }

    // Return updated row
    const [rows] = await dbPool.execute('SELECT * FROM roles WHERE role_id = ?', [roleId]);
    if (!rows || rows.length === 0) return res.status(404).json({ error: 'Role not found after update' });
    const updated = rows[0];
    // normalize before returning
    // Ensure role_type is included in response
    updated.role_type = updated.role_type || 'none';
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

    // List users (protected; only Super Admin role_id === 1)
    app.get('/api/users', authenticateToken, async (req, res, next) => {
      try {
        const actorRoleId = req.user && req.user.role_id;
        if (!actorRoleId || Number(actorRoleId) !== 1) {
          return res.status(403).json({ error: 'Forbidden: requires admin role' });
        }
  const [rows] = await dbPool.execute('SELECT user_id, username, role_id, full_name, email, mobile, created_at FROM users');
        res.json(Array.isArray(rows) ? rows : []);
      } catch (err) {
        next(err);
      }
    });

// Public users list for autocompletes (returns minimal fields). If query param role_type=reviewer|approver provided, filter roles accordingly.
app.get('/api/users/public', async (req, res, next) => {
  try {
    const roleType = req.query.role_type;
    if (roleType && ['reviewer','approver','both','none'].indexOf(String(roleType)) === -1) return res.status(400).json({ error: 'Invalid role_type' });
    // join users -> roles to filter by role_type
    let sql = 'SELECT u.user_id, u.username, u.full_name, u.role_id FROM users u';
    const params = [];
    if (roleType) {
      sql += ' JOIN roles r ON r.role_id = u.role_id WHERE (r.role_type = ? OR r.role_type = ? )';
      params.push(roleType, 'both');
    }
    const [rows] = await dbPool.execute(sql, params);
    res.json(Array.isArray(rows) ? rows : []);
  } catch (err) {
    next(err);
  }
});

// Get current user's account settings (requires auth)
app.get('/api/account', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user && req.user.user_id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const [rows] = await dbPool.execute('SELECT user_id, username, full_name, email, mobile, role_id, reviewer_id, approver_id, reviewer_manual, approver_manual FROM users WHERE user_id = ?', [userId]);
    if (!rows || rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// Update current user's account settings (requires auth)
app.put('/api/account', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user && req.user.user_id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { full_name, email, mobile, reviewer_id, approver_id, reviewer_manual, approver_manual } = req.body || {};
    const fields = [];
    const params = [];
    if (full_name !== undefined) { fields.push('full_name = ?'); params.push(full_name || null); }
    if (email !== undefined) { fields.push('email = ?'); params.push(email || null); }
    if (mobile !== undefined) { fields.push('mobile = ?'); params.push(mobile || null); }
    if (reviewer_id !== undefined) { fields.push('reviewer_id = ?'); params.push(reviewer_id ? Number(reviewer_id) : null); }
    if (approver_id !== undefined) { fields.push('approver_id = ?'); params.push(approver_id ? Number(approver_id) : null); }
    if (reviewer_manual !== undefined) { fields.push('reviewer_manual = ?'); params.push(reviewer_manual || null); }
    if (approver_manual !== undefined) { fields.push('approver_manual = ?'); params.push(approver_manual || null); }
    if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
    const sql = `UPDATE users SET ${fields.join(', ')} WHERE user_id = ?`;
    params.push(userId);
    const [result] = await dbPool.execute(sql, params);
    if (result && result.affectedRows === 0) return res.status(404).json({ error: 'User not found' });
    const [rows] = await dbPool.execute('SELECT user_id, username, full_name, email, mobile, role_id, reviewer_id, approver_id, reviewer_manual, approver_manual FROM users WHERE user_id = ?', [userId]);
    res.json(rows && rows[0] ? rows[0] : {});
  } catch (err) {
    next(err);
  }
});

        // Update user details (protected; only Super Admin role_id === 1)
        app.put('/api/users/:user_id', authenticateToken, async (req, res, next) => {
          try {
            const actorRoleId = req.user && req.user.role_id;
            if (!actorRoleId || Number(actorRoleId) !== 1) {
              return res.status(403).json({ error: 'Forbidden: requires admin role' });
            }
            const userId = parseInt(req.params.user_id, 10);
            if (Number.isNaN(userId)) return res.status(400).json({ error: 'Invalid user_id' });

            const { username, role_id, full_name, email, mobile } = req.body || {};

            const fields = [];
            const params = [];
            if (username !== undefined) { fields.push('username = ?'); params.push(String(username)); }
            if (role_id !== undefined) { fields.push('role_id = ?'); params.push(Number(role_id)); }
            if (full_name !== undefined) { fields.push('full_name = ?'); params.push(full_name || null); }
            if (email !== undefined) { fields.push('email = ?'); params.push(email || null); }
            if (mobile !== undefined) { fields.push('mobile = ?'); params.push(mobile || null); }

            if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });

            const sql = `UPDATE users SET ${fields.join(', ')} WHERE user_id = ?`;
            params.push(userId);
            let result;
            try {
              [result] = await dbPool.execute(sql, params);
            } catch (dbErr) {
              if (dbErr && dbErr.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ error: 'Username already exists' });
              }
              throw dbErr;
            }
            if (result && result.affectedRows === 0) return res.status(404).json({ error: 'User not found' });

            const [rows] = await dbPool.execute('SELECT user_id, username, role_id, full_name, email, mobile, created_at FROM users WHERE user_id = ?', [userId]);
            res.json(rows && rows[0] ? rows[0] : {});
          } catch (err) {
            next(err);
          }
        });

    // Create a new role (protected; only Super Admin role_id === 1)
    app.post('/api/roles', authenticateToken, async (req, res, next) => {
      try {
        const actorRoleId = req.user && req.user.role_id;
        if (!actorRoleId || Number(actorRoleId) !== 1) {
          return res.status(403).json({ error: 'Forbidden: requires admin role' });
        }
            const { role_name, role_type } = req.body || {};
            if (!role_name || String(role_name).trim().length === 0) return res.status(400).json({ error: 'Missing role_name' });
            const allowed = ['none','reviewer','approver','both'];
            const rt = allowed.includes(role_type) ? role_type : 'none';

            const sql = 'INSERT INTO roles (role_name, role_type) VALUES (?, ?)';
            const [result] = await dbPool.execute(sql, [String(role_name).trim(), rt]);
        const insertId = result && result.insertId ? result.insertId : null;
        if (!insertId) return res.status(500).json({ error: 'Failed to create role' });

        const [rows] = await dbPool.execute('SELECT * FROM roles WHERE role_id = ?', [insertId]);
        const newRole = rows && rows[0] ? rows[0] : null;
        if (!newRole) return res.status(500).json({ error: 'Role not found after insert' });

        // Normalize reviewer/approver to arrays like the GET /api/roles route
        const normalizeList = (val) => {
          if (val == null) return [];
          if (Array.isArray(val)) return val;
          if (typeof val === 'string') {
            const s = val.trim();
            if (s.length === 0) return [];
            try {
              const parsed = JSON.parse(s);
              if (Array.isArray(parsed)) return parsed;
            } catch (e) {}
            return s.split(',').map(x => { const t = x.trim(); if (/^\d+$/.test(t)) return Number(t); return t; }).filter(x => x !== '');
          }
          return [];
        };

        newRole.role_type = newRole.role_type || 'none';
        res.status(201).json(newRole);
      } catch (err) {
        next(err);
      }
    });

    // Get single user details (protected; only Super Admin role_id === 1)
    app.get('/api/users/:user_id', authenticateToken, async (req, res, next) => {
      try {
        const actorRoleId = req.user && req.user.role_id;
        if (!actorRoleId || Number(actorRoleId) !== 1) {
          return res.status(403).json({ error: 'Forbidden: requires admin role' });
        }
        const userId = parseInt(req.params.user_id, 10);
        if (Number.isNaN(userId)) return res.status(400).json({ error: 'Invalid user_id' });

        const [rows] = await dbPool.execute('SELECT user_id, username, role_id, full_name, email, mobile, created_at FROM users WHERE user_id = ?', [userId]);
        if (!rows || rows.length === 0) return res.status(404).json({ error: 'User not found' });
        res.json(rows[0]);
      } catch (err) {
        next(err);
      }
    });

    // Delete user (protected; only Super Admin role_id === 1)
    app.delete('/api/users/:user_id', authenticateToken, async (req, res, next) => {
      try {
        const actorRoleId = req.user && req.user.role_id;
        if (!actorRoleId || Number(actorRoleId) !== 1) {
          return res.status(403).json({ error: 'Forbidden: requires admin role' });
        }
        const userId = parseInt(req.params.user_id, 10);
        if (Number.isNaN(userId)) return res.status(400).json({ error: 'Invalid user_id' });

        const [result] = await dbPool.execute('DELETE FROM users WHERE user_id = ?', [userId]);
        if (result && result.affectedRows === 0) return res.status(404).json({ error: 'User not found' });
        res.json({ success: true });
      } catch (err) {
        next(err);
      }
    });

// Global error logging middleware
app.use((err, req, res, next) => {
  console.error('GLOBAL EXPRESS ERROR:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Delete role (protected; only Super Admin role_id === 1)
app.delete('/api/roles/:role_id', authenticateToken, async (req, res, next) => {
  try {
    const actorRoleId = req.user && req.user.role_id;
    if (!actorRoleId || Number(actorRoleId) !== 1) {
      return res.status(403).json({ error: 'Forbidden: requires admin role' });
    }
    const roleId = parseInt(req.params.role_id, 10);
    if (Number.isNaN(roleId)) return res.status(400).json({ error: 'Invalid role_id' });

    try {
      const [result] = await dbPool.execute('DELETE FROM roles WHERE role_id = ?', [roleId]);
      if (result && result.affectedRows === 0) return res.status(404).json({ error: 'Role not found' });
      res.json({ success: true });
    } catch (dbErr) {
      // Foreign key or integrity constraint - likely users reference this role
      if (dbErr && dbErr.code === 'ER_ROW_IS_REFERENCED_' || (dbErr && dbErr.errno === 1451)) {
        return res.status(409).json({ error: 'Role is in use and cannot be deleted' });
      }
      throw dbErr;
    }
  } catch (err) {
    next(err);
  }
});

// Test endpoint for connectivity
app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend is working!' });
});

// Dashboard summary endpoint - returns small set of aggregates useful for dashboard widgets
app.get('/api/dashboard/summary', async (req, res, next) => {
  try {
    const pool = app.get('dbPool');
    // 1) Cash in bank: sum of balances from a bank_accounts table if present, else derive from payment_vouchers
    let cashInBank = 0;
    try {
      const [rows] = await pool.execute('SELECT SUM(balance) AS total FROM bank_accounts');
      if (rows && rows[0] && rows[0].total != null) cashInBank = Number(rows[0].total) || 0;
    } catch (e) {
      // fallback: sum of unreconciled inflows - outflows over recent payments (best effort)
      const [inRows] = await pool.execute("SELECT IFNULL(SUM(amount_to_pay),0) AS inflow FROM payment_vouchers WHERE status = 'paid'");
      cashInBank = Number((inRows && inRows[0] && inRows[0].inflow) ? inRows[0].inflow : 0);
    }

    // 2) Recent cashflow points: last 8 days aggregated by day from payment_vouchers (payments and receipts)
    const [pointsRows] = await pool.execute(`
      SELECT DATE(created_at) AS dt,
        SUM(CASE WHEN amount_to_pay >= 0 THEN amount_to_pay ELSE 0 END) AS outflow,
        SUM(CASE WHEN amount_to_pay < 0 THEN ABS(amount_to_pay) ELSE 0 END) AS inflow
      FROM payment_vouchers
      WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      GROUP BY DATE(created_at)
      ORDER BY DATE(created_at) ASC
      LIMIT 30
    `);

    // 3) Highlights: simple counts
    const [[{ open_pvs = 0 }], [{ vendors_count = 0 }]] = await Promise.all([
      pool.execute("SELECT COUNT(*) AS open_pvs FROM payment_vouchers WHERE status IN ('draft','pending')"),
      pool.execute("SELECT COUNT(*) AS vendors_count FROM vendors")
    ]).then(results => results.map(r => r[0]));

    res.json({ cashInBank, points: pointsRows || [], highlights: { openPaymentVouchers: Number(open_pvs || 0), vendorsCount: Number(vendors_count || 0) } });
  } catch (err) {
    next(err);
  }
});

app.get('/', (req, res) => {
  res.send('Accounting System Backend API');
});

// 404 handler (should be last)
app.use((req, res, next) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 5000;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;