require('dotenv/config');
const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  const [rows] = await conn.query('SELECT id, name, requires_building_docs FROM property_types ORDER BY id');
  console.log(JSON.stringify(rows));
  await conn.end();
}
main().catch(e => { console.error(e); process.exit(1); });
