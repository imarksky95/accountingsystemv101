require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const app = express();

// CORS middleware - load once, before all routes
app.use(cors({
  origin: 'http://127.0.0.1:3000',
  credentials: true
}));
app.use(express.json());

const companyProfileRoutes = require('./companyProfile');
app.use('/api', companyProfileRoutes);

// MySQL connection
const mysql = require('mysql2/promise');
const dbConfig = {
  host: '127.0.0.1',
  user: 'u325151658_markchrc',
  password: 'Mark_082020',
  database: 'u325151658_accounting_db'
};
app.set('dbConfig', dbConfig);


// Auth routes
const authRoutes = require('./auth');
app.use('/api/auth', authRoutes);

// COA routes
const coaRoutes = require('./coa');
app.use('/api/coa', coaRoutes);

// Role management (basic example)
app.get('/api/roles', async (req, res) => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute('SELECT * FROM roles');
    await connection.end();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// Global error logging middleware
app.use((err, req, res, next) => {
  console.error('GLOBAL EXPRESS ERROR:', err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

// Test endpoint for connectivity
app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend is working!' });
});

app.get('/', (req, res) => {
  res.send('Accounting System Backend API');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
