import mysql from 'mysql2/promise';

async function check() {
  const conn = await mysql.createConnection({
    host: '82.197.82.197',
    user: 'u291876837_phoaa95',
    password: 'Phojaa%4095',
    database: 'u291876837_phoaa95',
    timezone: '+06:00',
  });

  console.log('=== Current date in Bhutan ===');
  const [nowRow] = await conn.execute("SELECT NOW() as now, CURDATE() as today");
  console.log('MySQL NOW():', nowRow[0].now);
  console.log('MySQL CURDATE():', nowRow[0].today);

  console.log('\n=== All attendance records ===');
  const [all] = await conn.execute('SELECT * FROM attendance ORDER BY date DESC LIMIT 30');
  console.log('Total records:', all.length);
  all.forEach(r => console.log(r));

  console.log('\n=== Records for May 2025 ===');
  const [may] = await conn.execute("SELECT * FROM attendance WHERE date >= '2025-05-01' AND date <= '2025-05-31' ORDER BY date DESC");
  console.log('May records:', may.length);

  console.log('\n=== Records for June 2025 ===');
  const [june] = await conn.execute("SELECT * FROM attendance WHERE date >= '2025-06-01' AND date <= '2025-06-30' ORDER BY date DESC");
  console.log('June records:', june.length);

  console.log('\n=== Check date column type ===');
  const [cols] = await conn.execute("SHOW COLUMNS FROM attendance WHERE Field = 'date'");
  console.log('Date column:', cols[0]);

  await conn.end();
}

check().catch(console.error);
