import dotenv from 'dotenv';
dotenv.config();
import mysql from 'mysql2/promise';

// פונקציית עזר לזיהוי תצורת החיבור (Socket vs TCP)
function getDbConfig() {
  const dbHost = process.env.DB_HOST || 'localhost';
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  
  const config = {
    user,
    password,
  };

  // בדיקה אם אנחנו ב-Cloud Run (זיהוי לפי מבנה ה-Connection Name)
  // פורמט: project-id:region:instance-name
  if (dbHost.includes(':') && !dbHost.includes('127.0.0.1') && !dbHost.includes('localhost')) {
    // ב-Cloud Run משתמשים ב-Socket Path
    // אם הערך כבר מכיל /cloudsql/ נשתמש בו, אחרת נוסיף את הקידומת
    config.socketPath = dbHost.startsWith('/cloudsql/') 
      ? dbHost 
      : `/cloudsql/${dbHost}`;
  } else {
    // עבודה לוקאלית רגילה
    config.host = dbHost;
    config.port = process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306;
  }

  return config;
}

const maxRetries = parseInt(process.env.DB_CONNECT_RETRIES || '30', 10);
const delayMs = parseInt(process.env.DB_CONNECT_DELAY_MS || '1000', 10);

async function waitForDb() {
  const connectionConfig = getDbConfig();
  
  // הדפסת לוג כדי שנבין לאן הוא מנסה להתחבר
  console.log('Attempting DB connection with config:', { 
    user: connectionConfig.user, 
    socketPath: connectionConfig.socketPath, 
    host: connectionConfig.host 
  });

  for (let i = 1; i <= maxRetries; i++) {
    try {
      const conn = await mysql.createConnection(connectionConfig);
      await conn.ping();
      await conn.end();
      console.log(`Connected successfully (attempt ${i})`);
      return;
    } catch (err) {
      console.log(`Waiting for DB (${i}/${maxRetries}) - ${err.message}`);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  throw new Error(`Unable to connect to DB after ${maxRetries} attempts`);
}

try {
  await waitForDb();
  // כאן מתחילים את האפליקציה כמו שהיא
  import('./index.js');
} catch (err) {
  console.error('DB connection failed, exiting:', err);
  process.exit(1);
}