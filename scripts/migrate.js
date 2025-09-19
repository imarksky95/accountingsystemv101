const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function main() {
  const envPath = path.resolve(__dirname, '../backend/.env');
  const env = fs.existsSync(envPath) ? fs.readFileSync(envPath,'utf8').split(/\r?\n/).reduce((acc,line)=>{const t=line.trim(); if(!t||t.startsWith('#')) return acc; const i=t.indexOf('='); if(i===-1) return acc; acc[t.slice(0,i)]=t.slice(i+1); return acc;},{}) : process.env;
  const pool = await mysql.createPool({
    host: env.DB_HOST || '148.222.53.12',
    user: env.DB_USER || 'u325151658_markchrc',
    password: env.DB_PASS || 'Mark_082020',
    database: env.DB_NAME || 'u325151658_accounting_db',
    waitForConnections: true,
    connectionLimit: 5
  });

  const files = fs.readdirSync(path.resolve(__dirname, '../database')).filter(f => f.endsWith('.sql')).sort();
  for (const f of files) {
    const p = path.resolve(__dirname, '../database', f);
    const sql = fs.readFileSync(p,'utf8');
    console.log('Applying', f);
    const statements = sql.split(/;\s*\n/).map(s=>s.trim()).filter(Boolean);
    for (let i=0;i<statements.length;i++) {
      try {
        await pool.query(statements[i]);
      } catch(e) {
        console.warn('Statement failed:', e.message);
      }
    }
  }
  await pool.end();
  console.log('Migration complete');
}

main();
