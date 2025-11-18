let API_URL = "";

/** טוען את config.json כדי לקבל את כתובת ה-API */
async function loadConfig() {
    try {
        const res = await fetch("config.json");
        const config = await res.json();
        API_URL = config.API_URL;
    } catch (err) {
        console.error("Failed to load config.json:", err);
    }
}

/** שליחת בקשה לשרת לקבלת המלצות */
async function getCareerRecommendations(userText) {
    if (!API_URL) await loadConfig();

    const response = await fetch(`${API_URL}/api/career-recommendations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userText })
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `שגיאת שרת: ${response.status}`);
    }

    return await response.json();
}

/** טעינת קובץ config.json בהתחלה */
loadConfig();

/** יצירת כרטיס קריירה */
function createCareerCard(career) {
    const stepsHTML = career.path.map(step => `<li>${step}</li>`).join('');

    return `
        <div class="career-card">
            <div class="career-title">${career.name}</div>
            
            ${career.explanation ? `
            <div class="career-section">
                <div class="career-section-title">💡 למה זה מתאים לך:</div>
                <div class="career-section-content">${career.explanation}</div>
            </div>` : ""}
            
            <div class="career-section">
                <div class="career-section-title">📚 המסלול המומלץ:</div>
                <ul class="steps-list">${stepsHTML}</ul>
            </div>
            
            <div class="career-section">
                <div class="career-section-title">💰 טווח משכורות:</div>
                <div class="salary-range">${career.salary}</div>
            </div>
        </div>
    `;
}

/** הצגת שגיאה */
function showError(message) {
    const errorDiv = document.getElementById("errorMessage");
    errorDiv.textContent = message;
    errorDiv.classList.add("active");
}

/** הסתרת שגיאה */
function hideError() {
    document.getElementById("errorMessage").classList.remove("active");
}

/** שליפת היסטוריה */
async function fetchHistory(limit = 20) {
    if (!API_URL) await loadConfig();

    try {
        const response = await fetch(`${API_URL}/api/history?limit=${limit}`);
        if (!response.ok) throw new Error("שגיאת שרת בהשגת היסטוריה");

        const data = await response.json();
        return data.rows || [];
    } catch (err) {
        console.error("fetchHistory error:", err);
        return [];
    }
}

/** יצירת פריט היסטוריה */
function createHistoryItem(item) {
    const careers = (item.ai_response?.careers || [])
        .map(career => createCareerCard(career))
        .join("");

    return `
        <div class="history-item" style="border:1px solid #eee; padding:12px; margin-bottom:12px; border-radius:8px;">
            <div style="color:#333; font-weight:600; margin-bottom:8px;">
                ${new Date(item.created_at).toLocaleString()}
            </div>
            <div style="color:#555; margin-bottom:8px;">
                <strong>טקסט משתמש:</strong> 
                ${item.user_text.slice(0, 300)}${item.user_text.length > 300 ? "…" : ""}
            </div>
            <div><strong>תשובת AI:</strong></div>
            <div>${careers || '<div style="color:#666;">אין נתונים</div>'}</div>
        </div>
    `;
}

/** הצגת היסטוריה */
async function showHistory() {
    const historySection = document.getElementById("historySection");
    const historyContainer = document.getElementById("historyContainer");

    if (historySection.style.display === "none") {
        historySection.style.display = "block";
        historyContainer.innerHTML = "<p style='color:#667eea;'>טוען...</p>";

        const historyItems = await fetchHistory(20);
        
        historyContainer.innerHTML =
            historyItems.length === 0
                ? "<p style='text-align:center;color:#666;'>לא נמצאו רשומות בהיסטוריה</p>"
                : historyItems.map(createHistoryItem).join("");

        historySection.scrollIntoView({ behavior: "smooth" });
    } else {
        historySection.style.display = "none";
    }
}

/** איפוס טופס */
function resetForm() {
    document.getElementById("userText").value = "";
    document.getElementById("careerForm").style.display = "block";
    document.getElementById("results").classList.remove("active");
    document.getElementById("historySection").style.display = "none";
    hideError();
    window.scrollTo({ top: 0, behavior: "smooth" });
}

/** שליחת טופס */
document.getElementById("careerForm").addEventListener("submit", async function (e) {
    e.preventDefault();

    const userText = document.getElementById("userText").value.trim();
    const submitBtn = document.getElementById("submitBtn");
    const loading = document.getElementById("loading");

    if (userText.length < 50) {
        showError("⚠️ נא לכתוב טקסט ארוך יותר (לפחות 50 תווים)");
        return;
    }

    hideError();
    submitBtn.disabled = true;
    loading.classList.add("active");

    try {
        const result = await getCareerRecommendations(userText);
        const container = document.getElementById("careersContainer");

        container.innerHTML =
            !result.careers || result.careers.length === 0
                ? "<p style='text-align:center;color:#666;'>לא התקבלו המלצות.</p>"
                : result.careers.map(createCareerCard).join("");

        document.getElementById("careerForm").style.display = "none";
        document.getElementById("results").classList.add("active");

        document.getElementById("results").scrollIntoView({ behavior: "smooth" });
    } catch (error) {
        console.error("Error:", error);
        showError(`❌ שגיאה: ${error.message}`);
    } finally {
        submitBtn.disabled = false;
        loading.classList.remove("active");
    }
});
