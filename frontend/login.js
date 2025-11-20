// Default to backend port used in local dev. If `config.json` is present it will override this.
let API_URL = "http://localhost:3000";

/** טוען את config.json כדי לקבל את כתובת ה-API */
async function loadConfig() {
    try {
        const res = await fetch("config.json");
        const config = await res.json();
        // Only override if config contains a non-empty API_URL
        if (config && config.API_URL && config.API_URL.trim()) API_URL = config.API_URL;
    } catch (err) {
        console.error("Failed to load config.json - using default API_URL:", err);
    }
}

function showError(message) {
    const errorDiv = document.getElementById("errorMessage");
    errorDiv.textContent = message;
    errorDiv.classList.add("active");
}

async function signup(email, password) {
    if (!API_URL) await loadConfig();
    const res = await fetch(`${API_URL}/api/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Signup failed');
    }
    const data = await res.json();
    localStorage.setItem('token', data.token);
    window.location.href = 'career_advisor_appV2.html';
}

async function login(email, password) {
    if (!API_URL) await loadConfig();
    const res = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Login failed');
    }
    const data = await res.json();
    localStorage.setItem('token', data.token);
    window.location.href = 'career_advisor_appV2.html';
}

document.getElementById('signupBtn').addEventListener('click', async () => {
    const email = document.getElementById('emailInput').value.trim();
    const password = document.getElementById('passwordInput').value;

    if (!email || !password) {
        showError('נא למלא אימייל וסיסמה');
        return;
    }

    try {
        await signup(email, password);
    } catch (err) {
        showError(err.message);
    }
});

document.getElementById('loginBtn').addEventListener('click', async () => {
    const email = document.getElementById('emailInput').value.trim();
    const password = document.getElementById('passwordInput').value;

    if (!email || !password) {
        showError('נא למלא אימייל וסיסמה');
        return;
    }

    try {
        await login(email, password);
    } catch (err) {
        showError(err.message);
    }
});

// Load config on startup
loadConfig();
