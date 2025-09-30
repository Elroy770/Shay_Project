// הגדרות API למול השרת המקומי
const API_CONFIG = {
    url: 'http://localhost:3000/api/career-recommendations'
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