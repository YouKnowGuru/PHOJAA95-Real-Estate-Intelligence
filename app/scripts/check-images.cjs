require('dotenv').config({path: './app/.env', quiet:true});
const mysql = require('mysql2/promise');
async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  const [rows] = await conn.query("SELECT * FROM property_images ORDER BY id DESC LIMIT 10");
  console.log("LAST 10 IMAGES:");
  console.log(JSON.stringify(rows, null, 2));
  await conn.end();
}
main().catch(e => console.error(e.message));
