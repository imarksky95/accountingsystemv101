const mysql = require('mysql2/promise');
require('dotenv').config({ path: require('path').resolve(__dirname, '../backend/.env') });

async function detectMime(buffer) {
  if (!buffer || buffer.length < 4) return null;
  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return 'image/png';
  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return 'image/jpeg';
  // WebP: RIFF....WEBP -> 52 49 46 46 .... 57 45 42 50
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
    // check further for 'WEBP'
    const header = buffer.toString('ascii', 8, 12);
    if (header === 'WEBP') return 'image/webp';
  }
  return null;
}

(async () => {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
  });
  try {
    const [rows] = await connection.execute('SELECT id, logo FROM company_profile WHERE logo IS NOT NULL');
    console.log('Found', rows.length, 'rows with logo');
    for (const r of rows) {
      const id = r.id;
      const logo = r.logo;
      const buffer = Buffer.isBuffer(logo) ? logo : Buffer.from(logo);
      const mime = await detectMime(buffer) || 'image/png';
      const size = buffer.length;
      console.log(`Updating id=${id} mime=${mime} size=${size}`);
      await connection.execute('UPDATE company_profile SET logo_mime = ?, logo_size_bytes = ? WHERE id = ?', [mime, size, id]);
    }
    console.log('Backfill complete');
  } catch (e) {
    console.error('Backfill failed', e);
  } finally {
    await connection.end();
  }
})();
