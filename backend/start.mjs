import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

// Ensure we load the .env that sits next to this file so start-time checks see the same envs as index.js
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: `${__dirname}/.env` });

const host = process.env.DB_HOST || '127.0.0.1';
const user = process.env.DB_USER || 'root';
const password = process.env.DB_PASSWORD || '';
const port = process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : undefined;
const socketPath = process.env.DB_SOCKET_PATH || process.env.INSTANCE_CONNECTION_NAME || undefined;

const maxRetries = parseInt(process.env.DB_CONNECT_RETRIES || '15', 10);
const delayMs = parseInt(process.env.DB_CONNECT_DELAY_MS || '500', 10);

async function waitForDb() {
  for (let i = 1; i <= maxRetries; i++) {
    try {
      // Build connection options: prefer unix socket when provided
      const connectionOptions = socketPath
        ? { socketPath, user, password }
        : port
        ? { host, port, user, password }
        : { host, user, password };

      // Log a sanitized view of the connection attempt (do not print password)
      const masked = { ...connectionOptions };
      if (masked.password) masked.password = '***';
      if (masked.socketPath) {
        console.log(`Attempting DB connection via socketPath=${masked.socketPath} user=${masked.user}`);
      } else {
        console.log(`Attempting DB connection host=${masked.host}${masked.port ? ` port=${masked.port}` : ''} user=${masked.user}`);
      }

      const conn = await mysql.createConnection(connectionOptions);
      await conn.ping();
      await conn.end();
      console.log(`Connected to DB (attempt ${i})`);
      return;
    } catch (err) {
      // Detailed logging for diagnostics
      console.warn(`Waiting for DB (${i}/${maxRetries}) - ${err.message}`);
      try {
        // if mysql2 error object has useful properties, log them
        if (err && typeof err === 'object') {
          const { code, errno, sqlMessage, sqlState } = err;
          if (code || errno || sqlMessage || sqlState) {
            console.warn('DB error details:', { code, errno, sqlState, sqlMessage });
          }
        }
      } catch (logErr) {
        console.warn('Failed to extract detailed DB error properties:', logErr && logErr.message);
      }
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  throw new Error(`Unable to connect to DB at ${host} after ${maxRetries} attempts`);
}

try {
  await waitForDb();
  // start the app
  import('./index.js');
} catch (err) {
  // Final diagnostic summary before exit
  console.error('DB connection failed, exiting. Final error:');
  if (err && typeof err === 'object') {
    console.error(err.stack || err);
  } else {
    console.error(String(err));
  }

  console.error('\nHelpful diagnostics:');
  console.error('- Verify DB_HOST, DB_USER, DB_PASSWORD and DB_NAME environment variables.');
  console.error('- If using Cloud SQL, ensure you set DB_SOCKET_PATH and the Cloud Run service has Cloud SQL Client role.');
  console.error('- If mounting host /var/lib/mysql, ensure files are compatible with the MySQL image version and permissions are correct.');
  console.error('- Check MySQL container logs for Data Dictionary / InnoDB errors (downgrade/permission issues).');
  console.error('- Increase DB_CONNECT_RETRIES and DB_CONNECT_DELAY_MS to allow more startup time if needed.');
  process.exit(1);
}
