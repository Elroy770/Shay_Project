import dotenv from 'dotenv';
dotenv.config();
import mysql from 'mysql2/promise';


// משתני סביבה בלבד
const host = process.env.DB_HOST || 'localhost';
const user = process.env.DB_USER || 'root';
const password = process.env.DB_PASSWORD || '';
const socketPath = process.env.INSTANCE_CONNECTION_NAME
  ? `/cloudsql/${process.env.INSTANCE_CONNECTION_NAME}`
  : undefined;
const maxRetries = parseInt(process.env.DB_CONNECT_RETRIES || '30', 10);
const port = process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : undefined;
const delayMs = parseInt(process.env.DB_CONNECT_DELAY_MS || '1000', 10);

async function waitForDb() {
  for (let i = 1; i <= maxRetries; i++) {
    try {
      const connectionConfig = {
        user,
        password,
        port,
      };

      if (socketPath) {
        connectionConfig.socketPath = socketPath;
        if (socketPath.includes('cloudsql')) {
          connectionConfig.ssl = { rejectUnauthorized: false };
        }
      } else {
        connectionConfig.host = host;
      }

      const conn = await mysql.createConnection(connectionConfig);
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
  // כאן מתחילים את האפליקציה כמו שהיא
  import('./index.js');
} catch (err) {
  console.error('DB connection failed, exiting:', err);
  process.exit(1);
}
