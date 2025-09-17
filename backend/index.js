require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const mysql = require('mysql2/promise');

const app = express();

// CORS middleware - allow multiple origins for dev
app.use(cors({
  origin: true,
  credentials: true
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
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});