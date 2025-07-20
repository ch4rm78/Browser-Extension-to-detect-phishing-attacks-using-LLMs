// CSS content from modal.css
const modalCSS = `
@import url('https://fonts.googleapis.com/css?family=Poppins&display=swap');

/* Minimal reset and base styles */
#suspicious-url-modal-container * {
    box-sizing: border-box;
    font-family: 'Poppins', sans-serif;
    margin: 0;
    padding: 0;
    /* Attempt to reset inherited styles that might interfere */
    line-height: initial; 
    border: initial;
    background: initial;
    color: initial;
    text-align: initial;
}

#suspicious-url-modal-container button {
    background-color: #474747 ;
    border: 0;
    border-radius: 5px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    color: #fff;
    font-size: 14px;
    padding: 10px 25px;
    cursor: pointer;
    margin: 0 5px;
}

#suspicious-url-modal-container .buttons-container {
    display: flex;
    justify-content: center;
    margin-top: 15px;
}

#suspicious-url-modal-container #modal-details-button {
    background-color: #4285f4;
}

#suspicious-url-modal-container .summary-container {
    margin: 15px 0;
    padding: 10px;
    background-color: #f8f8f8;
    border-radius: 5px;
    border-left: 4px solid #4285f4;
}

#suspicious-url-modal-container .summary-text {
    font-size: 14px;
    line-height: 1.4;
    color: #333;
}

#suspicious-url-modal-container {
    background-color: rgba(0, 0, 0, 0.6); /* Darker overlay */
    display: flex;
    align-items: center ;
    justify-content: center;
    position:fixed; /* Fixed position to overlay content */
    opacity: 0;
    pointer-events: none;
    top:0;
    left:0;
    height: 100vh;
    width: 100vw;
    z-index: 999999; /* High z-index */
    transition: opacity 0.3s ease; /* Smooth transition */
}

#suspicious-url-modal-container.show{
    pointer-events: auto;
    opacity: 1;
}

#suspicious-url-modal-container .modal-content { /* Renamed class */
    background-color: #fff;
    border-radius: 5px;
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3); /* Enhanced shadow */
    padding: 30px 50px;
    width: 500px; /* Slightly narrower */
    max-width: 90%; /* Responsive */
    text-align: center;
    color: #333; /* Default text color */
    transform: translateY(-50px); /* Initial position for transition */
    transition: transform 0.3s ease;
}

#suspicious-url-modal-container.show .modal-content {
    transform: translateY(0); /* Final position for transition */
}


#suspicious-url-modal-container h1 {
    margin-bottom: 15px; /* Spacing */
    color: #d9534f; /* Warning color */
    font-size: 22px;
}

#suspicious-url-modal-container p {
    font-size: 15px;
    opacity: 0.9;
    margin-bottom: 20px; /* Spacing */
    line-height: 1.5;
}

#suspicious-url-modal-container #modal-close-button { /* Specific ID */
     background-color: #d9534f; /* Match heading color */
}
`;

// Function to inject CSS and HTML for the modal
function injectAndShowModal() {
    // Check if modal already exists
    if (document.getElementById('suspicious-url-modal-container')) {
        const container = document.getElementById('suspicious-url-modal-container');
        container.classList.add('show'); // Just show it if it exists
        return;
    }

    // Inject CSS
    const styleSheet = document.createElement("style");
    styleSheet.type = "text/css";
    styleSheet.innerText = modalCSS;
    document.head.appendChild(styleSheet);

    // Create Modal HTML Structure
    const modalContainer = document.createElement('div');
    modalContainer.id = 'suspicious-url-modal-container';
    

    const modalDiv = document.createElement('div');
    modalDiv.classList.add('modal-content'); 

    const heading = document.createElement('h1');
    heading.textContent = 'Suspicious URL Detected';

    const paragraph = document.createElement('p');
    paragraph.textContent = 'This website has been flagged as potentially unsafe. Proceed with caution.';
    
    // Create a hidden summary container
    const summaryContainer = document.createElement('div');
    summaryContainer.id = 'summary-container';
    summaryContainer.style.display = 'none';
    summaryContainer.classList.add('summary-container');
    
    const summaryText = document.createElement('p');
    summaryText.id = 'summary-text';
    summaryText.classList.add('summary-text');
    summaryContainer.appendChild(summaryText);
    
    // Create buttons container for layout
    const buttonsContainer = document.createElement('div');
    buttonsContainer.classList.add('buttons-container');
    
    // Add details button
    const detailsButton = document.createElement('button');
    detailsButton.id = 'modal-details-button';
    detailsButton.textContent = 'Show Details';
    
    const closeButton = document.createElement('button');
    closeButton.id = 'modal-close-button'; // Specific ID
    closeButton.textContent = 'Acknowledge & Close';

    // Assemble Modal
    modalDiv.appendChild(heading);
    modalDiv.appendChild(paragraph);
    modalDiv.appendChild(summaryContainer);
    buttonsContainer.appendChild(detailsButton);
    buttonsContainer.appendChild(closeButton);
    modalDiv.appendChild(buttonsContainer);
    modalContainer.appendChild(modalDiv);

    // Add to page
    document.body.appendChild(modalContainer);

    // Add Button Listeners
    closeButton.addEventListener('click', () => {
        modalContainer.classList.remove('show');
    });
    
    // Add details button listener
    detailsButton.addEventListener('click', () => {
        const summaryContainer = document.getElementById('summary-container');
        if (summaryContainer.style.display === 'none') {
            summaryContainer.style.display = 'block';
            detailsButton.textContent = 'Hide Details';
        } else {
            summaryContainer.style.display = 'none';
            detailsButton.textContent = 'Show Details';
        }
    });

    
     // Use a minimal timeout to ensure the element is in the DOM and CSS applied before adding 'show'
    setTimeout(() => {
        modalContainer.classList.add('show');
    }, 5); 

    console.log("Suspicious URL modal injected and shown.");
}


// Track the current URL
let previousUrl = window.location.href;

// Function to observe URL changes
const observeUrlChange = () => {
  const observer = new MutationObserver(() => {
    if (window.location.href !== previousUrl) {
      previousUrl = window.location.href;
      console.log("URL changed to:", previousUrl);

      // Send the new URL to the background script for classification
      chrome.runtime.sendMessage(
        { action: "classifyURL", url: previousUrl }
      );
    }
  });

  // Observe changes to the <body> element (and subtree)
  // Consider observing 'document' instead for SPA navigation that might not affect body directly
  observer.observe(document.body, { 
    childList: true,
    subtree: true,
   
  });
};

// Start observing URL changes
observeUrlChange();

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Content script received message:', message);
    
    if (message.action === "showSuspiciousModal") {
        console.log('Showing suspicious URL modal');
        
        // Store the summary for use after modal creation
        const summary = message.summary || "This URL contains suspicious patterns or has been reported as potentially harmful.";
        
        // Inject and show the modal
        injectAndShowModal();
        
        // Set the summary text after a small delay to ensure modal is created
        setTimeout(() => {
            console.log('Setting summary text:', summary);
            const summaryText = document.getElementById('summary-text');
            if (summaryText) {
                summaryText.textContent = summary;
            } else {
                console.error('Summary text element not found in modal');
            }
        }, 50); // Small delay to ensure modal is fully created
        
        sendResponse({status: "Modal shown"});
        return true; // Keep the message channel open for the async response
    }
});