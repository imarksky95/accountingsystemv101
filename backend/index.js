const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const mysql = require('mysql2/promise');

const app = express();

// CORS middleware - allow specific origins (reflecting true for allowed list)
const allowedOrigins = [
  process.env.FRONTEND_ORIGIN || 'http://localhost:3000',
  'https://imarksky95.github.io',
  'https://imarksky95.github.io/accountingsystemv101',
  'https://accountingsystemv101.onrender.com'
];

app.use(cors({
  origin: function(origin, callback) {
    // allow requests with no origin (like mobile apps, curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    } else {
      console.warn('Blocked CORS request from origin:', origin);
      return callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
}));



app.use(express.json());

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

// Role management (basic example)
app.get('/api/roles', async (req, res, next) => {
  try {
    const [rows] = await dbPool.execute('SELECT * FROM roles');
    res.json(rows);
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