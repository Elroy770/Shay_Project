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

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = 'gpt-3.5-turbo';
const MAX_TOKENS = 2000;

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'Shay_Project',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Startup environment validation (DB_NAME is optional)
const requiredEnvs = [
  { name: 'DB_HOST', value: process.env.DB_HOST },
  { name: 'DB_USER', value: process.env.DB_USER },
  { name: 'DB_PASSWORD', value: process.env.DB_PASSWORD },
  { name: 'OPENAI_API_KEY', value: process.env.OPENAI_API_KEY }
];

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
  const tmpPool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    waitForConnections: true,
    connectionLimit: 1
  });

  try {
    await tmpPool.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await tmpPool.end();

    // Try to create table with JSON column; if the server doesn't support JSON, fall back to LONGTEXT
    const createTableJSON = `CREATE TABLE IF NOT EXISTS \`${dbName}\`.ai_requests (id INT AUTO_INCREMENT PRIMARY KEY, user_text LONGTEXT NOT NULL, ai_response JSON NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`;
    const createTableText = `CREATE TABLE IF NOT EXISTS \`${dbName}\`.ai_requests (id INT AUTO_INCREMENT PRIMARY KEY, user_text LONGTEXT NOT NULL, ai_response LONGTEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`;

    try {
      await pool.query(createTableJSON);
      console.log('Database and table (with JSON column) initialized successfully');
    } catch (jsonErr) {
      console.warn('JSON column not supported, falling back to LONGTEXT for ai_response:', jsonErr.message);
      await pool.query(createTableText);
      console.log('Database and table (with LONGTEXT column) initialized successfully');
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

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});