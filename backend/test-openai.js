// test-openai.js
import dotenv from 'dotenv';
import fetch from 'node-fetch';

// טען את .env
dotenv.config();

// קבל את ה־API key
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

console.log("API key loaded:", `"${OPENAI_API_KEY}"`);

if (!OPENAI_API_KEY) {
  console.error("❌ API key לא נטען! בדוק את הקובץ .env והנתיב שלו.");
  process.exit(1);
}

// בצע קריאת בדיקה ל-OpenAI
async function testOpenAI() {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: "שלום, האם הכל עובד?" }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ קריאה נכשלה:", data);
    } else {
      console.log("✅ קריאה הצליחה! התוצאה:");
      console.log(JSON.stringify(data, null, 2));
    }
  } catch (err) {
    console.error("❌ שגיאה ב־fetch:", err);
  }
}

testOpenAI();
