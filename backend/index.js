require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Configuration
const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Constants
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = 'gpt-4o-mini';
const MAX_TOKENS = 2000;

app.post('/api/career-recommendations', async (req, res) => {
  try {
    const { userText } = req.body;
    
    if (!userText || userText.trim().length < 50) {
      return res.status(400).json({
        error: 'נא לכתוב טקסט ארוך יותר (לפחות 50 תווים) כדי שה-AI יוכל לנתח טוב יותר'
      });
    }

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
}

חשוב:
- המלץ על 3 מקצועות בדיוק
- השתמש בשמות מקצועות ישראליים/עבריים
- טווח המשכורות צריך להיות ריאלי לשוק הישראלי
- המסלול צריך להיות מעשי וישים
- כל מקצוע צריך להתאים לכישורים ולתחומי העניין שהוזכרו`
          }
        ],
        temperature: 0.7,
        max_tokens: MAX_TOKENS
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `שגיאת API: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Extract JSON from response
    let jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('לא התקבלה תשובה תקינה מה-API');
    }
    
    res.json(JSON.parse(jsonMatch[0]));
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
