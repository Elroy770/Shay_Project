// הגדרות API עם מפתח קבוע
const API_CONFIG = {
    url: 'https://api.openai.com/v1/chat/completions',
    apiKey: API,
    model: 'gpt-4o-mini',
    maxTokens: 2000
};

/**
 * בניית ה-prompt שיישלח ל-OpenAI
 * @param {string} userText - הטקסט שהמשתמש כתב על עצמו
 * @returns {string} הפרומפט המלא
 */
function buildPrompt(userText) {
    return `אתה יועץ קריירה מקצועי. נתח את הטקסט הבא על המשתמש והמלץ על 3 מקצועות המתאימים ביותר עבורו.

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
- כל מקצוע צריך להתאים לכישורים ולתחומי העניין שהוזכרו`;
}

/**
 * שליחת בקשה ל-OpenAI API וקבלת המלצות מקצועיות
 * @param {string} userText - הטקסט שהמשתמש כתב
 * @returns {Promise<Object>} אובייקט JSON עם המלצות המקצועות
 */
async function getCareerRecommendations(userText) {
    const response = await fetch(API_CONFIG.url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_CONFIG.apiKey}`
        },
        body: JSON.stringify({
            model: API_CONFIG.model,
            messages: [
                {
                    role: 'system',
                    content: 'אתה יועץ קריירה מקצועי ישראלי המתמחה בהתאמת מקצועות על בסיס ניתוח טקסט. אתה מחזיר תמיד JSON תקין בפורמט המבוקש.'
                },
                {
                    role: 'user',
                    content: buildPrompt(userText)
                }
            ],
            temperature: 0.7,
            max_tokens: API_CONFIG.maxTokens
        })
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `שגיאת API: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // ניסיון לחלץ JSON מהתשובה
    let jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        throw new Error('לא התקבלה תשובה תקינה מה-API');
    }
    
    return JSON.parse(jsonMatch[0]);
}

/**
 * יצירת HTML לכרטיס מקצוע בודד
 * @param {Object} career - אובייקט מקצוע עם כל הפרטים
 * @returns {string} HTML של הכרטיס
 */
function createCareerCard(career) {
    const stepsHTML = career.path.map(step => `<li>${step}</li>`).join('');
    
    return `
        <div class="career-card">
            <div class="career-title">${career.name}</div>
            
            ${career.explanation ? `
            <div class="career-section">
                <div class="career-section-title">💡 למה זה מתאים לך:</div>
                <div class="career-section-content">${career.explanation}</div>
            </div>
            ` : ''}
            
            <div class="career-section">
                <div class="career-section-title">📚 המסלול המומלץ:</div>
                <ul class="steps-list">
                    ${stepsHTML}
                </ul>
            </div>
            
            <div class="career-section">
                <div class="career-section-title">💰 טווח משכורות:</div>
                <div class="salary-range">${career.salary}</div>
            </div>
        </div>
    `;
}

/**
 * הצגת הודעת שגיאה למשתמש
 * @param {string} message - הודעת השגיאה
 */
function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    errorDiv.textContent = message;
    errorDiv.classList.add('active');
}

/**
 * הסתרת הודעת השגיאה
 */
function hideError() {
    const errorDiv = document.getElementById('errorMessage');
    errorDiv.classList.remove('active');
}

/**
 * איפוס הטופס וחזרה למצב התחלתי
 */
function resetForm() {
    document.getElementById('userText').value = '';
    document.getElementById('careerForm').style.display = 'block';
    document.getElementById('results').classList.remove('active');
    hideError();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * טיפול בשליחת הטופס - הפונקציה המרכזית
 */
document.getElementById('careerForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const userText = document.getElementById('userText').value.trim();
    const submitBtn = document.getElementById('submitBtn');
    const loading = document.getElementById('loading');
    
    // בדיקת תקינות הטקסט
    if (userText.length < 50) {
        showError('⚠️ נא לכתוב טקסט ארוך יותר (לפחות 50 תווים) כדי שה-AI יוכל לנתח טוב יותר');
        return;
    }
    
    // הסתרת שגיאות קודמות
    hideError();
    
    // הצגת מצב טעינה
    submitBtn.disabled = true;
    loading.classList.add('active');
    
    try {
        // קריאה ל-OpenAI API
        const result = await getCareerRecommendations(userText);
        
        // הצגת התוצאות
        const container = document.getElementById('careersContainer');
        
        if (!result.careers || result.careers.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #666;">לא התקבלו המלצות. נסה שוב.</p>';
        } else {
            container.innerHTML = result.careers.map(career => createCareerCard(career)).join('');
        }
        
        // הסתרת הטופס והצגת התוצאות
        document.getElementById('careerForm').style.display = 'none';
        document.getElementById('results').classList.add('active');
        
        // גלילה חלקה לתוצאות
        document.getElementById('results').scrollIntoView({ behavior: 'smooth' });
        
    } catch (error) {
        console.error('Error:', error);
        showError(`❌ שגיאה: ${error.message}`);
    } finally {
        // הסתרת מצב טעינה
        submitBtn.disabled = false;
        loading.classList.remove('active');
    }
});