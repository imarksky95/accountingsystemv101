const fs = require('fs');
const path = require('path');

const sqlPath = path.resolve(__dirname, '../database/ap-management.sql');
const backendDir = path.resolve(__dirname, '../backend');

const sql = fs.readFileSync(sqlPath, 'utf8');

// Very simple parser: find column names in CREATE TABLE blocks
const tableCols = {};
const tableRegex = /CREATE TABLE IF NOT EXISTS\s+(\w+)\s*\(([^;]+?)\);/gms;
let m;
while ((m = tableRegex.exec(sql)) !== null) {
  const table = m[1];
  const body = m[2];
  const cols = [];
  body.split('\n').forEach(line => {
    const l = line.trim();
    if (!l) return;
    // skip constraints and indexes
    if (l.startsWith('INDEX') || l.startsWith('--') || l.startsWith('ALTER') || l.startsWith(')')) return;
    const colMatch = l.match(/^([`"]?\w+[`\"]?)\s+/);
    if (colMatch) {
      cols.push(colMatch[1].replace(/[`"]/g, ''));
    }
  });
  tableCols[table] = cols;
}

// Read backend files and extract referenced columns in SQL strings
const backendFiles = ['paymentVoucher.js','checkVoucher.js','scheduledPayment.js','disbursementReport.js'];
const referenced = {};
for (const f of backendFiles) {
  const content = fs.readFileSync(path.join(backendDir, f), 'utf8');
  const sqlStrings = content.match(/\'[^']*\'/g) || [];
  referenced[f] = [];
  sqlStrings.forEach(s => {
    const str = s.slice(1, -1);
    // find column names after SELECT/INSERT/UPDATE/DELETE parts
    const colMatches = str.match(/\b([a-zA-Z_]+)\b/g) || [];
    colMatches.forEach(c => referenced[f].push(c));
  });
}

// Check each referenced column against tables
const report = [];
for (const f of backendFiles) {
  const refs = Array.from(new Set(referenced[f]));
  refs.forEach(token => {
    // ignore SQL keywords and table names
    if (/^(SELECT|FROM|WHERE|INSERT|INTO|VALUES|UPDATE|SET|DELETE|COUNT|AS|JOIN|ON|ORDER|BY|LIMIT|AND|OR|IN)$|\\d+/i.test(token)) return;
    // check if token appears as a column in any table
    const found = Object.keys(tableCols).some(t => tableCols[t].includes(token));
    if (!found) report.push({file:f, token});
  });
}

if (report.length === 0) {
  console.log('No obvious column mismatches found.');
  process.exit(0);
} else {
  console.log('Potential mismatches:');
  report.forEach(r => console.log(`${r.file}: ${r.token}`));
  process.exit(2);
}
