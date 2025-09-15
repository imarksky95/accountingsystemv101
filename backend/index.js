require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();

// Allow requests from your GitHub Pages domain
app.use(cors({
  origin: 'https://imarksky95.github.io',
  credentials: true // if you use cookies or HTTP authentication
}));
app.use(express.json());

// Company Profile routes
const companyProfileRoutes = require('./companyProfile');
app.use('/api', companyProfileRoutes);

// MySQL connection
const mysql = require('mysql2/promise');
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'accounting_db',
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
