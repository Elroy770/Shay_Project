// === התאם את ה-URL הזה! ===
// ה-URL המלא והציבורי של שירות shay-backend ב-Cloud Run.
const CLOUD_RUN_BACKEND_URL = 'https://shay-backend-152345784611.us-central1.run.app';
// ==========================

// הגדרת ה-HOST באופן דינמי
// הקוד בודק קודם כל אם יש משתנה מוזרק (window.HOST). אם לא, הוא בודק את סביבת ההרצה:
const HOST = (typeof window !== 'undefined' && window.HOST)
    ? window.HOST
    : ((window.location.hostname === 'localhost' || window.location.hostname === '' || window.location.hostname === '127.0.0.1')
        ? 'http://localhost:3000' // עבודה לוקאלית: פונה לפורט 3000 המקומי
        : CLOUD_RUN_BACKEND_URL); // עבודה בענן: פונה ל-URL הקבוע של שירות ה-Backend

const API_CONFIG = {
    // HOST הוא כבר ה-URL המלא (כולל HTTPS ופורט 443 משתמע)
    url: `${HOST}/api/career-recommendations`
};




/**
 * בניית ה-prompt שיישלח ל-OpenAI
 * @param {string} userText - הטקסט שהמשתמש כתב על עצמו
 * @returns {string} הפרומפט המלא
 */
/**
 * שליחת בקשה ל-OpenAI API וקבלת המלצות מקצועיות
 * @param {string} userText - הטקסט שהמשתמש כתב
 * @returns {Promise<Object>} אובייקט JSON עם המלצות המקצועות
 */
async function getCareerRecommendations(userText) {
    const response = await fetch(API_CONFIG.url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userText })
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `שגיאת שרת: ${response.status}`);
    }

    return await response.json();
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

// פונקציה להשגת היסטוריית חיפושים
async function fetchHistory(limit = 20) {
    try {
        // Use the runtime HOST (injected from .env into window.HOST) with the
        // same fallback already defined at the top of the file.


        const response = await fetch(`${HOST}/api/history?limit=${limit}`);
        if (!response.ok) {
            throw new Error('שגיאת שרת בהשגת היסטוריה');
        }

        const data = await response.json();
        return data.rows || [];
    } catch (err) {
        console.error('fetchHistory error:', err);
        return [];
    }
}

// יצירת אלמנט היסטוריה בודד
function createHistoryItem(item) {
    const careers = (item.ai_response?.careers || [])
        .map(career => `<div class="career-card">${createCareerCard(career)}</div>`)
        .join('');

    return `
        <div class="history-item" style="border:1px solid #eee; padding:12px; margin-bottom:12px; border-radius:8px;">
            <div style="color:#333; font-weight:600; margin-bottom:8px;">
                ${new Date(item.created_at).toLocaleString()}
            </div>
            <div style="color:#555; margin-bottom:8px;">
                <strong>טקסט משתמש:</strong> 
                ${item.user_text.slice(0, 300)}${item.user_text.length > 300 ? '…' : ''}
            </div>
            <div><strong>תשובת AI:</strong></div>
            <div>${careers || '<div style="color:#666;">אין נתונים</div>'}</div>
        </div>
    `;
}

// פונקציה להצגת היסטוריה
async function showHistory() {
    const historySection = document.getElementById('historySection');
    const historyContainer = document.getElementById('historyContainer');

    if (historySection.style.display === 'none') {
        historySection.style.display = 'block';
        historyContainer.innerHTML = '<p style="color:#667eea;">טוען...</p>';

        const historyItems = await fetchHistory(20);
        if (historyItems.length === 0) {
            historyContainer.innerHTML = '<p style="color:#666; text-align: center;">לא נמצאו רשומות בהיסטוריה</p>';
        } else {
            historyContainer.innerHTML = historyItems.map(createHistoryItem).join('');
        }

        // גלילה חלקה לאזור ההיסטוריה
        historySection.scrollIntoView({ behavior: 'smooth' });
    } else {
        historySection.style.display = 'none';
    }
}

/**
 * איפוס הטופס וחזרה למצב התחלתי
 */
function resetForm() {
    document.getElementById('userText').value = '';
    document.getElementById('careerForm').style.display = 'block';
    document.getElementById('results').classList.remove('active');
    document.getElementById('historySection').style.display = 'none';
    hideError();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * טיפול בשליחת הטופס - הפונקציה המרכזית
 */
document.getElementById('careerForm').addEventListener('submit', async function (e) {
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