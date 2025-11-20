import dotenv from 'dotenv';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

// Ensure we load the .env file that sits next to this file regardless of CWD
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: `${__dirname}/.env` });
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/hello", (req, res) => {
    res.send("Hello from backend!");
});

const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = 'gpt-3.5-turbo';
const MAX_TOKENS = 2000;

// Determine database connection: Cloud SQL socket or localhost
const dbConfig = {
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'Shay_Project',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// If DB_SOCKET_PATH is set, use Cloud SQL socket; otherwise use DB_HOST (or localhost)
if (process.env.DB_SOCKET_PATH) {
  dbConfig.socketPath = process.env.DB_SOCKET_PATH;
} else {
  dbConfig.host = process.env.DB_HOST || 'localhost';
}

const pool = mysql.createPool(dbConfig);

// Startup environment validation (DB_NAME is optional)
const requiredEnvs = [
  { name: 'DB_USER', value: process.env.DB_USER },
  { name: 'DB_PASSWORD', value: process.env.DB_PASSWORD },
  { name: 'OPENAI_API_KEY', value: process.env.OPENAI_API_KEY }
];

// DB_HOST is required only if DB_SOCKET_PATH is not set (localhost mode)
if (!process.env.DB_SOCKET_PATH && !process.env.DB_HOST) {
  requiredEnvs.push({ name: 'DB_HOST (or DB_SOCKET_PATH for Cloud SQL)', value: process.env.DB_HOST });
}

const missing = requiredEnvs.filter(e => !e.value || e.value.toString().trim() === '').map(e => e.name);
if (missing.length) {
  console.error('Missing required environment variables:', missing.join(', '));
  console.error('Please provide them via backend/.env or environment (see README_DOCKER.md)');
  process.exit(1);
}

// Initialize database: create the database if it doesn't exist, then create the table.
const initDB = async () => {
  const dbName = process.env.DB_NAME || 'Shay_Project';

  // Create a temporary pool without a default database to ensure the DB exists
  const tmpDbConfig = {
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    waitForConnections: true,
    connectionLimit: 1
  };

  // Use socket path if available, otherwise use host
  if (process.env.DB_SOCKET_PATH) {
    tmpDbConfig.socketPath = process.env.DB_SOCKET_PATH;
  } else {
    tmpDbConfig.host = process.env.DB_HOST || 'localhost';
  }

  const tmpPool = mysql.createPool(tmpDbConfig);

  try {
    await tmpPool.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await tmpPool.end();

    // Try to create table with JSON column; if the server doesn't support JSON, fall back to LONGTEXT
    const createTableJSON = `CREATE TABLE IF NOT EXISTS \`${dbName}\`.ai_requests (id INT AUTO_INCREMENT PRIMARY KEY, user_text LONGTEXT NOT NULL, ai_response JSON NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`;
    const createTableText = `CREATE TABLE IF NOT EXISTS \`${dbName}\`.ai_requests (id INT AUTO_INCREMENT PRIMARY KEY, user_text LONGTEXT NOT NULL, ai_response LONGTEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`;

    // Create users table (id, email unique, password_hash, created_at)
    const createUsersJSON = `CREATE TABLE IF NOT EXISTS \`${dbName}\`.users (id INT AUTO_INCREMENT PRIMARY KEY, email VARCHAR(255) NOT NULL UNIQUE, password_hash VARCHAR(255) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`;

    try {
      await pool.query(createTableJSON);
      console.log('Database and table (with JSON column) initialized successfully');
    } catch (jsonErr) {
      console.warn('JSON column not supported, falling back to LONGTEXT for ai_response:', jsonErr.message);
      await pool.query(createTableText);
      console.log('Database and table (with LONGTEXT column) initialized successfully');
    }
    try {
      await pool.query(createUsersJSON);
      console.log('Users table initialized successfully');
    } catch (userErr) {
      console.error('Failed to create users table:', userErr.message);
    }
  } catch (error) {
    console.error('Database initialization error:', error);
  }
};

// Initialize the database
initDB().catch(console.error);

async function callOpenAI(userText) {
  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        {
          role: 'system',
          content: 'אתה יועץ קריירה מקצועי ישראלי המתמחה בהתאמת מקצועות על בסיס ניתוח טקסט. אתה מחזיר תמיד JSON תקין בפורמט המבוקש.'
        },
        {
          role: 'user',
          content: `אתה יועץ קריירה מקצועי. נתח את הטקסט הבא על המשתמש והמלץ על 3 מקצועות המתאימים ביותר עבורו.

טקסט המשתמש:
"${userText}"

החזר JSON בפורמט הבא בדיוק (ללא טקסט נוסף):
{
  "careers": [
    {
      "name": "שם המקצוע בעברית",
      "explanation": "הסבר קצר למה המקצוע מתאים למשתמש (2-3 משפטים)",
      "path": [
        "שלב 1 במסלול",
        "שלב 2 במסלול",
        "שלב 3 במסלול",
        "שלב 4 במסלול",
        "שלב 5 במסלול"
      ],
      "salary": "טווח משכורות בשקלים, לדוגמה: 15,000 - 30,000 ₪"
    }
  ]
}`
        }
      ],
      temperature: 0.7,
      max_tokens: MAX_TOKENS
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `שגיאת API: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('לא התקבלה תשובה תקינה מה־API');

  try {
    return JSON.parse(content);
  } catch (e) {
    console.error('JSON parsing error:', e);
    // Try to extract JSON from the content if direct parsing fails
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('לא התקבלה תשובה בפורמט JSON');
    
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (e2) {
      console.error('Second JSON parsing error:', e2);
      throw new Error('התקבל JSON לא תקין מה-API');
    }
  }
}

app.post('/api/career-recommendations', async (req, res) => {
  try {
    const { userText } = req.body;
    if (!userText || userText.trim().length < 50) {
      return res.status(400).json({ 
        error: 'נא לכתוב טקסט ארוך יותר (לפחות 50 תווים)' 
      });
    }

    const aiParsed = await callOpenAI(userText);

    try {
      await pool.execute(
        'INSERT INTO ai_requests (user_text, ai_response) VALUES (?, ?)',
        [userText, JSON.stringify(aiParsed)]
      );
    } catch (dbErr) {
      console.error('DB insert error:', dbErr);
    }

    return res.json(aiParsed);
  } catch (error) {
    console.error('Error in /career-recommendations:', error);
    return res.status(500).json({ error: error.message });
  }
});

// --- Authentication endpoints ---
const JWT_SECRET = process.env.JWT_SECRET || 'replace_this_with_a_secure_random_value';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';

app.post('/api/signup', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password || password.length < 6) {
      return res.status(400).json({ error: 'Email and password (>=6 chars) are required' });
    }

    const [rows] = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    if (rows.length) return res.status(409).json({ error: 'User already exists' });

    const password_hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query('INSERT INTO users (email, password_hash) VALUES (?, ?)', [email, password_hash]);

    const token = jwt.sign({ sub: result.insertId, email }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
    res.json({ token });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const [rows] = await pool.query('SELECT id, password_hash FROM users WHERE email = ? LIMIT 1', [email]);
    if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });

    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ sub: user.id, email }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
    res.json({ token });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

// Middleware to protect endpoints
function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const m = header.match(/^Bearer (.+)$/);
  if (!m) return res.status(401).json({ error: 'Missing token' });
  const token = m[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Example: protect history endpoint (optional). We'll allow anonymous access for now but show how to protect.
// app.get('/api/history', authMiddleware, async (req, res) => { ... });

app.get('/api/history', async (req, res) => {
  try {
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = parseInt(req.query.offset) || 0;

    const [rows] = await pool.query(
      'SELECT id, user_text, ai_response, created_at FROM ai_requests ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [limit, offset]
    );

    const normalized = rows.map(r => ({
      id: r.id,
      user_text: r.user_text,
      ai_response: (typeof r.ai_response === 'string') ? JSON.parse(r.ai_response) : r.ai_response,
      created_at: r.created_at
    }));

    res.json({ rows: normalized });
  } catch (error) {
    console.error('Error in /history:', error);
    res.status(500).json({ error: error.message });
  }
});

// Cloud Run חייב להאזין לכולם
app.listen(PORT, "0.0.0.0", () => {
    console.log("Backend listening on port", PORT);
});