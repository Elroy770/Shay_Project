import mysql from 'mysql2/promise';

const socketPath = process.env.DB_SOCKET_PATH || 'localsocketPath';
const user = process.env.DB_USER || 'root';
const password = process.env.DB_PASSWORD || '';
const database = process.env.DB_NAME || 'Shay_Project';

const maxRetries = parseInt(process.env.DB_CONNECT_RETRIES || '30', 10);
const delayMs = parseInt(process.env.DB_CONNECT_DELAY_MS || '1000', 10);

async function waitForDb() {
  for (let i = 1; i <= maxRetries; i++) {
    try {
      const conn = await mysql.createConnection({ socketPath, user, password, database });
      await conn.ping();
      await conn.end();
      console.log(`Connected to DB at ${socketPath} (attempt ${i})`);
      return;
    } catch (err) {
      console.log(`Waiting for DB (${i}/${maxRetries}) - ${err.message}`);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  throw new Error(`Unable to connect to DB at ${socketPath} after ${maxRetries} attempts`);
}

try {
  await waitForDb();
  // start the app
  import('./index.js');
} catch (err) {
  console.error('DB connection failed, exiting:', err);
  process.exit(1);
}
