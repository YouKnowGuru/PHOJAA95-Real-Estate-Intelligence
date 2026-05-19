require('dotenv').config({quiet:true});
const mysql = require('mysql2/promise');
async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  const [rows] = await conn.query("SELECT p.id, p.property_name, p.property_type_id, pt.name as type_name, pt.requires_building_docs FROM properties p LEFT JOIN property_types pt ON p.property_type_id = pt.id ORDER BY p.id DESC LIMIT 5");
  console.log(JSON.stringify(rows));
  await conn.end();
}
main().catch(e => console.error(e.message));