# Browser-Extension-to-detect-phishing-attacks-using-LLMs
The application is a browser extension that checks URLs in real-time to detect phishing websites and warn the user. It uses a Flask backend powered by 2 Large Language Models to classify domain names and determine if they are suspicious, and it caches results for faster future responses.

### Motivation

Phishing attacks are on the rise, and many internet users struggle to identify suspicious websites. I was motivated by a desire to protect users especially non-technical ones from falling victim to fraudulent sites.

### Why I Built This Project

As a final year project, I wanted to combine cybersecurity and AI to solve a real-world problem. Building a browser extension that uses Large Language Models to detect phishing URLs allowed me to apply both backend development and machine learning principles.

### Problem It Solves

It detects phishing domains in real-time and warns users about the potential danger ahead, preventing them from entering malicious websites. This improves browser safety and reduces the risk of stolen credentials or financial loss.

### What I Learned

I learned how to build browser extensions, use Flask for backend development, integrate LLMs for intelligent classification, and optimize system performance using a caching mechanism with SQLite.

### What Makes It Stand Out

Unlike static blacklists, my extension uses 2 Large Language Models to analyze URLs dynamically. It also caches results locally for faster future checks.

### Why I Used the Technologies I Used

1. Flask was chosen for its simplicity and lightweight nature, ideal for building a REST API quickly.

2. SQLite was used for local caching due to its low overhead and ease of integration.

3. Large Language Models were integrated because of their capability to understand and classify URLs more intelligently than traditional rule-based systems.

4. Browser Extensions (Manifest V3) provided a seamless way to interact with the user’s browsing activity and display warnings directly.

### Features

1. Real-time phishing URL detection

2. Flask-powered backend

3. Local caching with SQLite for optimized performance

4. AI-enhanced detection using Large Language Models

5. Privacy-focused: no user data is stored or sent externally

# How To Use
**IMPORTANT:** You will need to obtain API keys for Google Gemini and Groq
### Part One
1. Clone the repo
  ```
git clone https://github.com/ch4rm78/Browser-Extension-to-detect-phishing-attacks-using-LLMs.git
```
2. Enable Developer Mode in your Chrome settings
3. Go to the "Manage extensions" settings
4. Click on "Load unpacked"
3. Navigate to the cloned repo, click on it and select folder

### Part Two
Open the Project directory in your IDE

1. Create a virtual environment
```
python venv .venv
```
2. Activate your virtual environment (for windows)
```
.venv/Scripts/Activate
```
  you might need to allow running of scripts via powershell to use that command [How to do that](https://casits.artsandsciences.fsu.edu/how-run-powershell-scripts-windows-11)

3. Install the requirements
```
pip install -r requirements.txt
```
4. Create a `.env` file in the main project directory and paste the below text inside, replace the quoted texts with your API keys and save
```
GROQ_API_KEY = "YOUR GROQ API KEY HERE"

GEMINI_API_KEY = "YOUR GEMINI API KEY HERE"
```
5. Navigate to the backend directory
```
cd backend
```
6. Create the database tables
```
python init_db.py
```
7. Start the Flask server
```
python server.py
```
