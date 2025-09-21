const express = require('express');
const mysql = require('mysql2/promise');
const router = express.Router();

function getDbPool(req) {
  return req.app.get('dbPool');
}

// List all COA entries with parent account name, only not deleted
router.get('/', async (req, res) => {
  try {
    const dbPool = getDbPool(req);
    const [rows] = await dbPool.execute(`
      SELECT coa.*, COALESCE(parent.account_name, parent.name) AS parent_account_name
      FROM chart_of_accounts coa
      LEFT JOIN chart_of_accounts parent ON coa.parent_id = parent.coa_id
      WHERE coa.deleted = 0
      ORDER BY coa.coa_id ASC
    `);
    res.json(rows);
  } catch (err) {
    console.error('COA API error (GET /):', err);
    res.status(500).json({ error: err.message });
  }
});

// Add a new COA entry (with manual account_number and optional parent_id)
router.post('/', async (req, res) => {
  const { account_number, account_name, account_type, parent_id } = req.body;
  if (!account_number) return res.status(400).json({ error: 'Account Number is required' });
  try {
    const dbPool = getDbPool(req);
    // Check for duplicate account_number where deleted=0
    const [dupRows] = await dbPool.execute(
      'SELECT 1 FROM chart_of_accounts WHERE account_number = ? AND deleted = 0 LIMIT 1',
      [account_number]
    );
    if (dupRows.length > 0) {
      return res.status(400).json({ error: 'Duplicate Account Number' });
    }
    const sql = 'INSERT INTO chart_of_accounts (account_number, account_name, account_type, control_number, parent_id) VALUES (?, ?, ?, ?, ?)';
    // Generate control number (simple example, you may want to improve this logic)
    const [result] = await dbPool.execute('SELECT COUNT(*) as count FROM chart_of_accounts');
    const control_number = `COA-${result[0].count + 1}`;
    await dbPool.execute(sql, [account_number, account_name, account_type, control_number, parent_id || null]);
    res.status(201).json({ message: 'Account added' });
  } catch (err) {
    console.error('COA API error (POST /):', err);
    res.status(500).json({ error: err.message });
  }
});

// Edit a COA entry (with manual account_number and optional parent_id)
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { account_number, account_name, account_type, parent_id } = req.body;
  if (!account_number) return res.status(400).json({ error: 'Account Number is required' });
  try {
    const dbPool = getDbPool(req);
    // Check for duplicate account_number where deleted=0 and not self
    const [dupRows] = await dbPool.execute(
      'SELECT 1 FROM chart_of_accounts WHERE account_number = ? AND deleted = 0 AND coa_id != ? LIMIT 1',
      [account_number, id]
    );
    if (dupRows.length > 0) {
      return res.status(400).json({ error: 'Duplicate Account Number' });
    }
    try {
      await dbPool.execute(
        'UPDATE chart_of_accounts SET account_number=?, account_name=?, account_type=?, parent_id=? WHERE coa_id=?',
        [account_number, account_name, account_type, parent_id || null, id]
      );
      res.json({ message: 'Account updated' });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        console.error('COA API error (PUT /:id) DUP_ENTRY:', err);
        return res.status(400).json({ error: 'Account Number already exists. Please use a unique Account Number.' });
      }
      console.error('COA API error (PUT /:id):', err);
      res.status(500).json({ error: err.message });
    }
  } catch (err) {
    console.error('COA API error (PUT /:id):', err);
    res.status(500).json({ error: err.message });
  }
});
// Get all accounts for parent selection (id and name only, not deleted)
router.get('/all/simple', async (req, res) => {
  try {
    const dbPool = getDbPool(req);
    const [rows] = await dbPool.execute('SELECT coa_id, COALESCE(account_name, name) AS account_name FROM chart_of_accounts WHERE deleted = 0');
    res.json(rows);
  } catch (err) {
    console.error('COA API error (GET /all/simple):', err);
    res.status(500).json({ error: err.message });
  }
});

// Fallback simple list that assumes `account_name` column exists (for older deployments)
router.get('/all/simple/fallback', async (req, res) => {
  try {
    const dbPool = getDbPool(req);
    const [rows] = await dbPool.execute('SELECT coa_id, account_name FROM chart_of_accounts WHERE deleted = 0');
    res.json(rows);
  } catch (err) {
    console.error('COA API error (GET /all/simple/fallback):', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete a COA entry
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const dbPool = getDbPool(req);
    await dbPool.execute('UPDATE chart_of_accounts SET deleted=1 WHERE coa_id=?', [id]);
    res.json({ message: 'Account deleted' });
  } catch (err) {
    console.error('COA API error (DELETE /:id):', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
