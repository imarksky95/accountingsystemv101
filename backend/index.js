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
    // Normalize reviewer/approver columns to arrays for frontend convenience
    const normalizeList = (val) => {
      if (val == null) return [];
      if (Array.isArray(val)) return val;
      if (typeof val === 'object') return val;
      // Try JSON parse first (e.g. stored as '[1,2]')
      if (typeof val === 'string') {
        const s = val.trim();
        if (s.length === 0) return [];
        try {
          const parsed = JSON.parse(s);
          if (Array.isArray(parsed)) return parsed;
        } catch (e) {
          // fallthrough to CSV parse
        }
        // Fallback: comma-separated values
        return s.split(',').map(x => {
          const t = x.trim();
          if (/^\d+$/.test(t)) return Number(t);
          return t;
        }).filter(x => x !== '');
      }
      return [];
    };

    const normalized = rows.map(r => {
      return Object.assign({}, r, {
        reviewer: normalizeList(r.reviewer),
        approver: normalizeList(r.approver)
      });
    });
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

    const { reviewer, approver } = req.body || {};

    const prepareValue = (v) => {
      if (v == null) return null;
      if (Array.isArray(v)) return JSON.stringify(v);
      if (typeof v === 'string') return v;
      // for objects, stringify
      try {
        return JSON.stringify(v);
      } catch (e) {
        return String(v);
      }
    };

    const reviewerVal = prepareValue(reviewer);
    const approverVal = prepareValue(approver);

    const sql = 'UPDATE roles SET reviewer = ?, approver = ? WHERE role_id = ?';
    const [result] = await dbPool.execute(sql, [reviewerVal, approverVal, roleId]);

    if (result && result.affectedRows === 0) {
      return res.status(404).json({ error: 'Role not found' });
    }

    // Return updated row
    const [rows] = await dbPool.execute('SELECT * FROM roles WHERE role_id = ?', [roleId]);
    if (!rows || rows.length === 0) return res.status(404).json({ error: 'Role not found after update' });
    const updated = rows[0];
    // normalize before returning
    const normalizeList = (val) => {
      if (val == null) return [];
      if (Array.isArray(val)) return val;
      if (typeof val === 'string') {
        const s = val.trim();
        if (s.length === 0) return [];
        try {
          const parsed = JSON.parse(s);
          if (Array.isArray(parsed)) return parsed;
        } catch (e) {
          // fallback to CSV
        }
        return s.split(',').map(x => {
          const t = x.trim();
          if (/^\d+$/.test(t)) return Number(t);
          return t;
        }).filter(x => x !== '');
      }
      return [];
    };

    updated.reviewer = normalizeList(updated.reviewer);
    updated.approver = normalizeList(updated.approver);

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
        const [rows] = await dbPool.execute('SELECT user_id, username, role_id, created_at FROM users');
        res.json(Array.isArray(rows) ? rows : []);
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
        const { role_name } = req.body || {};
        if (!role_name || String(role_name).trim().length === 0) return res.status(400).json({ error: 'Missing role_name' });

        const sql = 'INSERT INTO roles (role_name) VALUES (?)';
        const [result] = await dbPool.execute(sql, [String(role_name).trim()]);
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

        newRole.reviewer = normalizeList(newRole.reviewer);
        newRole.approver = normalizeList(newRole.approver);
        res.status(201).json(newRole);
      } catch (err) {
        next(err);
      }
    });

// Global error logging middleware
app.use((err, req, res, next) => {
  console.error('GLOBAL EXPRESS ERROR:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Test endpoint for connectivity
app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend is working!' });
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