chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // Only proceed if the tab is completely loaded and the URL has changed
    // Use tab.url here as changeInfo.url might not be the final URL when status is complete
    if (changeInfo.status === 'complete' && tab.url) {
      console.log('Tab complete, URL:', tab.url); // Debug log
      
      // Wait for the page to be fully loaded before analyzing the URL
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        function: checkDocumentReadyState,
      }).then(results => {
        // Only proceed if the document is fully loaded (readyState is 'complete')
        if (results && results[0] && results[0].result === true) {
          processUrl(tabId, tab.url);
        } else {
          console.log('Document not fully loaded yet, waiting...');
          // Try again after a short delay
          setTimeout(() => {
            chrome.scripting.executeScript({
              target: { tabId: tabId },
              function: checkDocumentReadyState,
            }).then(results => {
              if (results && results[0] && results[0].result === true) {
                processUrl(tabId, tab.url);
              } else {
                console.log('Document still not fully loaded, proceeding anyway');
                processUrl(tabId, tab.url);
              }
            }).catch(error => {
              console.error('Error checking document ready state:', error);
              processUrl(tabId, tab.url); // Fallback to processing URL anyway
            });
          }, 1000); // Wait 1 second before retrying
        }
      }).catch(error => {
        console.error('Error checking document ready state:', error);
        processUrl(tabId, tab.url); // Fallback to processing URL anyway
      });
    }
});

// Function to check if the document is fully loaded
function checkDocumentReadyState() {
  return document.readyState === 'complete';
}

// Function to process the URL
function processUrl(tabId, url) {

  // Get the authentication token from storage
  chrome.storage.local.get(['token'], function(result) {
    console.log('Retrieved token from storage:', result.token ? 'Token exists' : 'No token'); // Debug log
    
    if (!result.token) {
      console.log('No authentication token found');
      return;
    }

    console.log('Sending request with token for URL:', url); // Debug log
    fetch('http://localhost:5000/process-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${result.token}`
      },
      body: JSON.stringify({ url: url }), // Use the URL passed to the function
    })
      .then((response) => {
        console.log('Response status:', response.status); // Debug log
        if (!response.ok) {
          // Check for specific auth error status if backend provides one
          if (response.status === 401 || response.status === 403) { 
              throw new Error('Authentication failed');
          } else {
              throw new Error(`HTTP error! status: ${response.status}`);
          }
        }
        return response.json();
      })
      .then((data) => {
        console.log('Classification:', data.output, 'From cache:', data.from_cache || false);
        // Store the classification for the popup to display
        chrome.storage.local.set({ 
          output: data.output,
          from_cache: data.from_cache || false
        });

        // If the URL is suspicious, send a message to the content script
        if (data.output && data.output.toLowerCase() === 'suspicious') {
          
          const MAX_RETRIES = 3;
          const RETRY_DELAY_MS = 250;
          
          // Include the summary in the message if available
          const message = { 
            action: "showSuspiciousModal",
            summary: data.summary || "This URL contains suspicious patterns or has been reported as potentially harmful."
          };

          function sendMessageWithRetry(retryCount) {
            chrome.tabs.sendMessage(tabId, message, (response) => {
              if (chrome.runtime.lastError) {
                const errorMessage = chrome.runtime.lastError.message;
                console.warn(`Error sending message (attempt ${retryCount + 1}): ${errorMessage}`, "Tab ID:", tabId);
                if (errorMessage.includes("Receiving end does not exist") && retryCount < MAX_RETRIES - 1) {
                  console.log(`Retrying message send in ${RETRY_DELAY_MS}ms...`);
                  setTimeout(() => sendMessageWithRetry(retryCount + 1), RETRY_DELAY_MS);
                } else {
                  console.error("Failed to send message to content script after multiple retries or other error:", errorMessage);
                  // Optionally store an error state if needed
                  chrome.storage.local.set({ output: `Error: Failed to warn tab ${tabId}` });
                }
              } else {
                console.log('Sent showSuspiciousModal message successfully to tab:', tabId, "Response:", response);
              }
            });
          }
          
          // Initial attempt to send the message
          sendMessageWithRetry(0);
        }
      })
      .catch((error) => {
        console.error('Error during fetch or processing:', error);
        if (error.message === 'Authentication failed') {
          // Clear the token if authentication failed
          chrome.storage.local.remove(['token'], () => {
              console.log('Token cleared due to authentication failure'); // Debug log
          });
        }
        
        chrome.storage.local.set({ output: `Error: ${error.message}` });
      });
      });
    }
