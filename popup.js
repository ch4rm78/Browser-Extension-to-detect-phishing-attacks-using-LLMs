// API endpoints
const API_BASE_URL = 'http://localhost:5000';

// Check authentication status on load
document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const authContainer = document.getElementById('auth-container');
    const mainContainer = document.getElementById('main-container');
    const loginButton = document.getElementById('login-button');
    const registerButton = document.getElementById('register-button');
    const logoutButton = document.getElementById('logout-button');
    const collectUrlsButton = document.getElementById('collectUrls');
    const output = document.getElementById('output');
    const usernameDisplay = document.getElementById('username-display');
    const authMessage = document.getElementById('auth-message');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const loginTab = document.getElementById('login-tab');
    const registerTab = document.getElementById('register-tab');
    
    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username');
    
    if (token && username) {
        showMainContainer(username);
    } else {
        showAuthContainer();
    }
    
    // Add event listener for history button
    const historyButton = document.getElementById('view-history');
    if (historyButton) {
        historyButton.addEventListener('click', function() {
            chrome.tabs.create({ url: 'history.html' });
        });
    }
    
    // Check if we have a cached result
    chrome.storage.local.get(['output', 'from_cache'], function(result) {
        if (result.output) {
            const cacheInfo = document.getElementById('cache-info');
            if (cacheInfo && result.from_cache) {
                cacheInfo.textContent = 'Last result was retrieved from cache';
            }
        }
    });
    
    // Event Listeners
    loginButton.addEventListener('click', handleLogin);
    registerButton.addEventListener('click', handleRegister);
    logoutButton.addEventListener('click', handleLogout);
    collectUrlsButton.addEventListener('click', collectTabUrls);
    
    // Tab switching event listeners
    loginTab.addEventListener('click', function() {
        loginTab.classList.add('active');
        registerTab.classList.remove('active');
        loginForm.classList.add('active');
        registerForm.classList.remove('active');
    });
    
    registerTab.addEventListener('click', function() {
        registerTab.classList.add('active');
        loginTab.classList.remove('active');
        registerForm.classList.add('active');
        loginForm.classList.remove('active');
    });
});

// Authentication Functions
async function handleLogin() {
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;

    try {
        const response = await fetch(`${API_BASE_URL}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password }),
        });

        const data = await response.json();

        if (response.ok) {
            console.log('Login successful, token:', data.token); // Debug log
            localStorage.setItem('token', data.token);
            localStorage.setItem('username', data.username);
            // Also store in chrome.storage.local for background script
            chrome.storage.local.set({ 
                token: data.token,
                username: data.username 
            }, function() {
                console.log('Token stored in chrome.storage.local'); // Debug log
            });
            showMainContainer(data.username);
            showMessage('Login successful!', 'success');
        } else {
            showMessage(data.error || 'Login failed', 'error');
        }
    } catch (error) {
        showMessage('Error connecting to server', 'error');
    }
}

async function handleRegister() {
    const username = document.getElementById('register-username').value;
    const password = document.getElementById('register-password').value;

    try {
        const response = await fetch(`${API_BASE_URL}/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password }),
        });

        const data = await response.json();

        if (response.ok) {
            showMessage('Registration successful! Please login.', 'success');
            document.getElementById('register-username').value = '';
            document.getElementById('register-password').value = '';
        } else {
            showMessage(data.error || 'Registration failed', 'error');
        }
    } catch (error) {
        showMessage('Error connecting to server', 'error');
    }
}

function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    showAuthContainer();
    showMessage('Logged out successfully', 'success');
}

// UI Functions
// UI Functions - using function declarations so they can be called before definition
function showAuthContainer() {
    const authContainer = document.getElementById('auth-container');
    const mainContainer = document.getElementById('main-container');
    authContainer.style.display = 'block';
    mainContainer.style.display = 'none';
}

function showMainContainer(username) {
    const authContainer = document.getElementById('auth-container');
    const mainContainer = document.getElementById('main-container');
    const usernameDisplay = document.getElementById('username-display');
    authContainer.style.display = 'none';
    mainContainer.style.display = 'block';
    usernameDisplay.textContent = username;
}

function showMessage(message, type) {
    const authMessage = document.getElementById('auth-message');
    authMessage.textContent = message;
    authMessage.className = type === 'error' ? 'error-message' : 'success-message';
    setTimeout(() => {
        authMessage.textContent = '';
        authMessage.className = '';
    }, 3000);
}

// Tab URL Collection
async function collectTabUrls() {
    try {
        const tabs = await chrome.tabs.query({});
        const tabData = tabs.map(tab => ({
            title: tab.title,
            url: tab.url
        }));

        // Get token from chrome.storage.local instead of localStorage
        chrome.storage.local.get(['token'], function(result) {
            if (!result.token) {
                output.innerHTML = 'Error: Not authenticated. Please login again.';
                return;
            }

            fetch(`${API_BASE_URL}/process-tabs`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${result.token}`
                },
                body: JSON.stringify({ tabs: tabData }),
            })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    let resultHTML = `<p>Processed ${tabData.length} tabs successfully</p>`;
                    
                    // Count suspicious domains
                    const suspiciousCount = data.results.filter(r => r.classification === 'suspicious').length;
                    const cachedCount = data.results.filter(r => r.from_cache).length;
                    
                    if (suspiciousCount > 0) {
                        resultHTML += `<p style="color: red;">Found ${suspiciousCount} suspicious domains!</p>`;
                    } else {
                        resultHTML += `<p style="color: green;">All domains are safe!</p>`;
                    }
                    
                    if (cachedCount > 0) {
                        resultHTML += `<p style="font-size: 12px; color: #666;">${cachedCount} results were retrieved from cache</p>`;
                    }
                    
                    output.innerHTML = resultHTML;
                } else {
                    output.innerHTML = `Error: ${data.error || 'Failed to process tabs'}`;
                }
            })
            .catch(error => {
                output.innerHTML = 'Error collecting tab URLs';
            });
        });
    } catch (error) {
        output.innerHTML = 'Error collecting tab URLs';
    }
}