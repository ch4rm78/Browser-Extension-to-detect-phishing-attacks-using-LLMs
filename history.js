document.addEventListener('DOMContentLoaded', function() {
    const historyContainer = document.getElementById('history-container');
    const backButton = document.getElementById('back-button');
    
    // Get token from storage
    chrome.storage.local.get(['token', 'username'], function(result) {
        if (!result.token) {
            window.location.href = 'popup.html';
            return;
        }
        
        fetchHistory(result.token);
    });
    
    // Fetch URL check history
    function fetchHistory(token) {
        fetch('http://localhost:5000/url-history', {
            method: 'GET',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch history');
            }
            return response.json();
        })
        .then(data => {
            displayHistory(data.history);
        })
        .catch(error => {
            historyContainer.innerHTML = `
                <div class="empty-history">
                    Error loading history: ${error.message}
                </div>
            `;
        });
    }
    
    // Display history items
    function displayHistory(history) {
        if (!history || history.length === 0) {
            historyContainer.innerHTML = `
                <div class="empty-history">
                    No URL history found.
                </div>
            `;
            return;
        }
        
        let historyHTML = '';
        
        history.forEach(item => {
            historyHTML += `
                <div class="history-item">
                    <div class="domain">${item.domain}</div>
                    <div class="date">${item.check_date}</div>
                    <div class="classification">
                        Status: <span class="${item.classification}">${item.classification.toUpperCase()}</span>
                    </div>
                    ${item.summary ? `<div class="summary">Why: ${item.summary}</div>` : ''}
                </div>
            `;
        });
        
        historyContainer.innerHTML = historyHTML;
    }
    
    // Back button event listener
    backButton.addEventListener('click', function() {
        window.close();
    });
});