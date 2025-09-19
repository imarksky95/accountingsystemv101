const fs = require('fs');
const path = require('path');

const sqlPath = path.resolve(__dirname, '../database/ap-management.sql');
const backendDir = path.resolve(__dirname, '../backend');

const sql = fs.readFileSync(sqlPath, 'utf8');

// Parse CREATE TABLE columns
const tableCols = {};
const tableRegex = /CREATE TABLE IF NOT EXISTS\s+(\w+)\s*\(([^;]+?)\);/gms;
let m;
while ((m = tableRegex.exec(sql)) !== null) {
  const table = m[1];
  const body = m[2];
  const cols = [];
  const lines = body.split('\n').map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (/^(INDEX|--|ALTER|\) )/i.test(line)) continue;
    const colMatch = line.match(/^([`"]?\w+[`\"]?)\s+/);
    if (colMatch) {
      const col = colMatch[1].replace(/[`"]/g, '');
      cols.push(col);
    }
  }
  tableCols[table] = new Set(cols);
}

function extractSqlStrings(content) {
  const regex = /dbPool\.execute\s*\(\s*([`'"])([\s\S]*?)\1/gm;
  const results = [];
  let r;
  while ((r = regex.exec(content)) !== null) {
    results.push(r[2]);
  }
  return results;
}

function extractColumnsFromSql(sqlStr) {
  const found = [];
  // INSERT INTO table (col1, col2) VALUES
  const ins = sqlStr.match(/INSERT INTO\s+(\w+)\s*\(([^)]+)\)/i);
  if (ins) {
    const table = ins[1];
    const cols = ins[2].split(',').map(s => s.trim().replace(/[`'"\s]/g, ''));
    cols.forEach(c => found.push({table, col: c}));
  }
  // UPDATE table SET col1=?, col2=? WHERE ...
  const upd = sqlStr.match(/UPDATE\s+(\w+)\s+SET\s+([\s\S]+?)\s+WHERE/i);
  if (upd) {
    const table = upd[1];
    const setPart = upd[2];
    const parts = setPart.split(',').map(s => s.trim());
    parts.forEach(p => {
      const colMatch = p.match(/^([`\"]?\w+[`\"]?)\s*=.*/);
      if (colMatch) found.push({table, col: colMatch[1].replace(/[`"]/g, '')});
    });
  }
  // DELETE FROM table WHERE col=?
  const del = sqlStr.match(/DELETE FROM\s+(\w+)\s+WHERE\s+([\s\S]+)/i);
  if (del) {
    const table = del[1];
    const where = del[2];
    const whereCols = where.match(/([`\"]?\w+[`\"]?)\s*=\s*\?/g);
    if (whereCols) whereCols.forEach(wc => {
      const col = wc.split('=')[0].trim().replace(/[`"]/g, '');
      found.push({table, col});
    });
  }
  // SELECT col1, col2 FROM table
  const sel = sqlStr.match(/SELECT\s+([\s\S]+?)\s+FROM\s+(\w+)/i);
  if (sel) {
    const colsPart = sel[1].trim();
    const table = sel[2];
    if (colsPart !== '*') {
      const cols = colsPart.split(',').map(s => s.trim().replace(/[`\"]/g, ''));
      cols.forEach(c => found.push({table, col: c}));
    }
  }
  return found;
}

const backendFiles = ['paymentVoucher.js','checkVoucher.js','scheduledPayment.js','disbursementReport.js'];
const mismatches = [];
for (const f of backendFiles) {
  const content = fs.readFileSync(path.join(backendDir, f), 'utf8');
  const sqlStrings = extractSqlStrings(content);
  for (const s of sqlStrings) {
    const uses = extractColumnsFromSql(s);
    uses.forEach(u => {
        // skip aggregate-like tokens or tokens containing non-identifier characters
        if (/\*|\(|\)|\s|\bas\b/i.test(u.col)) return;
        if (!tableCols[u.table]) {
          mismatches.push({file: f, table: u.table, col: u.col, reason: 'table-not-found'});
        } else if (!tableCols[u.table].has(u.col)) {
          mismatches.push({file: f, table: u.table, col: u.col, reason: 'column-not-found'});
        }
    });
  }
}

if (mismatches.length === 0) {
  console.log('All SQL columns referenced by backend AP routes match the schema.');
  process.exit(0);
} else {
  console.log('Found mismatches:');
  mismatches.forEach(m => console.log(`${m.file}: table=${m.table} col=${m.col} reason=${m.reason}`));
  process.exit(2);
}
