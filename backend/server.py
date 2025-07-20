from flask import Flask, request, jsonify
from flask_cors import CORS
from groq import Groq
import google.generativeai as genai
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
import jwt
import datetime
import os
from dotenv import load_dotenv
from urllib.parse import urlparse
import asyncio
import concurrent.futures
import functools
import time
from cachetools import TTLCache

# Configure Flask app
app = Flask(__name__)
CORS(app)


load_dotenv()
#gemini api key
genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))
#groq api key
client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

# In-memory cache for recent domain checks (cache for 1 hour)
domain_cache = TTLCache(maxsize=1000, ttl=3600)

# Database configuration
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///users.db'
app.config['SQLALCHEMY_BINDS'] = {
    'url_db': 'sqlite:///url_details.db'
}
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = os.urandom(24)  # For JWT token generation

db = SQLAlchemy(app)

# User model
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password = db.Column(db.String(120), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

# Domain Check History model
class DomainCheck(db.Model):
    __bind_key__ = 'url_db'  # Use the URL database
    id = db.Column(db.Integer, primary_key=True)
    domain = db.Column(db.String(255), nullable=False)
    classification = db.Column(db.String(20), nullable=False)
    summary = db.Column(db.Text, nullable=True) 
    check_date = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    user_id = db.Column(db.Integer, nullable=False)  

# Create database tables
with app.app_context():
    db.create_all()
    
    
    url_engine = db.get_engine(app, bind='url_db')
    DomainCheck.__table__.create(url_engine, checkfirst=True)

# Helper function to extract domain from URL - optimized version
def extract_domain(url):
    try:
        if not url.startswith('http') and not url.startswith('https'):
            url = 'https://' + url
            
        parsed_url = urlparse(url)
        domain = parsed_url.netloc.lower()  # Convert to lowercase for consistency
        
       
        if domain.startswith('www.'):
            domain = domain[4:]
            
        return domain
    except Exception as e:
        print(f"Error extracting domain: {e}")
        return url  

# Helper function to run async tasks
def run_async(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        return asyncio.run(func(*args, **kwargs))
    return wrapper

# Async function to get classification from Gemini
async def get_gemini_classification(url):
    model = genai.GenerativeModel("gemini-2.0-flash")
    prompt = f"Is this url suspicious: {url}? Answer only 'suspicious' or 'safe'."
    response = model.generate_content(prompt)
    return response.text.strip().lower()

# Async function to get classification from Groq
async def get_groq_classification(url):
    response = client.chat.completions.create(
        messages=[{
            "role": "user",
            "content": f"Access this url {url}, analyze it, check if it is requesting for sensitive information, check if it is impersonating any trusted brands, check if there is any content on the site trying to invoke fear in the user. The name could be something suspicious but the url or domain name could belong to a legitimate site. And tell me if you think it is 'suspicious' or 'safe' just one word response."
            # "content": f"Access this url {url}, analyze it, check if it is requesting for sensitive information, check if it is impersonating any trusted brands, check if there is any content on the site trying to invoke fear in the user. The name could be something suspicious but the url or domain name could belong to a legitimate site. And tell me if you think it is 'suspicious' or 'safe' just one word response."
        }],
        model="compound-beta",
    )
    return response.choices[0].message.content.strip().lower()

# Async function to get summary from Groq
async def get_groq_summary(url):
    response = client.chat.completions.create(
        messages=[{
            "role": "user",
            "content": f"Provide a very brief summary (maximum 50 words) explaining why this URL might be suspicious: {url}"
        }],
        model="compound-beta",
    )
    return response.choices[0].message.content.strip()

# Function to run multiple async tasks concurrently
async def run_concurrent_tasks(*tasks):
    return await asyncio.gather(*tasks)

# Authentication routes
@app.route('/register', methods=['POST'])
def register():
    data = request.json
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({'error': 'Username and password are required'}), 400

    if User.query.filter_by(username=username).first():
        return jsonify({'error': 'Username already exists'}), 400

    hashed_password = generate_password_hash(password)
    new_user = User(username=username, password=hashed_password)
    
    db.session.add(new_user)
    db.session.commit()

    return jsonify({'message': 'User created successfully'}), 201

@app.route('/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')

    user = User.query.filter_by(username=username).first()
    
    if not user or not check_password_hash(user.password, password):
        return jsonify({'error': 'Invalid username or password'}), 401

    token = jwt.encode({
        'user_id': user.id,
        'username': user.username,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(days=1)
    }, app.config['SECRET_KEY'])

    return jsonify({
        'token': token,
        'username': user.username
    }), 200

# Token verification decorator
def token_required(f):
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'error': 'Token is missing'}), 401
        try:
            token = token.split()[1]  # Remove 'Bearer ' prefix
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user = User.query.get(data['user_id'])
        except:
            return jsonify({'error': 'Invalid token'}), 401
        return f(current_user, *args, **kwargs)
    decorated.__name__ = f.__name__  # Preserve the original function name
    return decorated

# URL history endpoint
@app.route('/url-history', methods=['GET'])
@token_required
def get_url_history(current_user):
    history = DomainCheck.query.filter_by(user_id=current_user.id).order_by(DomainCheck.check_date.desc()).all()
    
    history_list = []
    for check in history:
        history_list.append({
            'id': check.id,
            'domain': check.domain,
            'classification': check.classification,
            'summary': check.summary if check.summary else "",
            'check_date': check.check_date.strftime('%Y-%m-%d %H:%M:%S')
        })
    
    return jsonify({'history': history_list})

# Existing routes with authentication
@app.route('/process-url', methods=['POST'])
@token_required
@run_async
async def process_url(current_user):
    start_time = time.time()
    data = request.json
    url = data.get('url')
    print(f"Received URL: {url}")
    
  
    domain = extract_domain(url)
    print(f"Extracted domain: {domain}")
    
    # Check in-memory cache first (fastest)
    cache_key = f"{domain}:{current_user.id}"
    if cache_key in domain_cache:
        cached_result = domain_cache[cache_key]
        print(f"Domain found in memory cache with classification: {cached_result['classification']}")
        return jsonify({
            'output': cached_result['classification'],
            'from_cache': True,
            'summary': cached_result['summary'] if cached_result['classification'] == 'suspicious' else "",
            'processing_time': f"{time.time() - start_time:.2f} seconds"
        })
    
    
    existing_check = DomainCheck.query.filter_by(domain=domain, user_id=current_user.id).order_by(DomainCheck.check_date.desc()).first()
    
    if existing_check:
        print(f"Domain found in database with classification: {existing_check.classification}")
        # Update the check date
        existing_check.check_date = datetime.datetime.utcnow()
        db.session.commit()
        
        # Add to memory cache
        domain_cache[cache_key] = {
            'classification': existing_check.classification,
            'summary': existing_check.summary
        }
        
        return jsonify({
            'output': existing_check.classification, 
            'from_cache': True,
            'summary': existing_check.summary if existing_check.classification == 'suspicious' else "",
            'processing_time': f"{time.time() - start_time:.2f} seconds"
        })
    
    # If domain not in database, analyze with LLMs in parallel
    try:
        # Run both classifications concurrently
        classification1, classification2 = await run_concurrent_tasks(
            get_gemini_classification(url),
            get_groq_classification(url)
        )
        
        if classification1 == 'suspicious' and classification2 == 'suspicious':
            classification = 'suspicious'
            
            summary = await get_groq_summary(url)
        else:
            classification = 'safe'
            summary = ""
            
        print(f"Classification: {classification}")
        
        # Save domain check to database
        domain_check = DomainCheck(
            domain=domain,
            classification=classification,
            summary=summary if classification == 'suspicious' else "",
            user_id=current_user.id
        )
        db.session.add(domain_check)
        db.session.commit()
        
        # Add to memory cache
        domain_cache[cache_key] = {
            'classification': classification,
            'summary': summary
        }
        
        return jsonify({
            'output': classification, 
            'from_cache': False,
            'summary': summary if classification == 'suspicious' else "",
            'processing_time': f"{time.time() - start_time:.2f} seconds"
        })
    except Exception as e:
        print(f"Error during URL analysis: {e}")
        return jsonify({
            'status': 'error',
            'message': f"Error analyzing URL: {str(e)}"
        }), 500

#For processing tabs when the "collect tabs" button is clicked
@app.route('/process-tabs', methods=['POST'])
@token_required
@run_async
async def process_tabs(current_user):
    try:
        start_time = time.time()
        data = request.json
        tabs = data.get('tabs', [])
        
        print(f"Received {len(tabs)} tabs data")
        results = []
        processing_tasks = []
        
        # Process each tab asynchronously
        async def process_tab(tab):
            url = tab['url']
            domain = extract_domain(url)
            summary = ""
            from_cache = False
            
            
            cache_key = f"{domain}:{current_user.id}"
            if cache_key in domain_cache:
                cached_result = domain_cache[cache_key]
                classification = cached_result['classification']
                summary = cached_result['summary'] if classification == 'suspicious' else ""
                from_cache = True
                print(f"Domain {domain} found in memory cache")
            else:
                # Check if domain exists in database
                existing_check = DomainCheck.query.filter_by(domain=domain, user_id=current_user.id).order_by(DomainCheck.check_date.desc()).first()
                
                if existing_check:
                    classification = existing_check.classification
                    summary = existing_check.summary if classification == 'suspicious' else ""
                    existing_check.check_date = datetime.datetime.utcnow()
                    from_cache = True
                    print(f"Domain {domain} found in database")
                    
                    # Add to memory cache
                    domain_cache[cache_key] = {
                        'classification': classification,
                        'summary': summary
                    }
                else:
                    # If domain not in database, analyze with LLMs in parallel
                    classification1, classification2 = await run_concurrent_tasks(
                        get_gemini_classification(url),
                        get_groq_classification(url)
                    )
                    
                    if classification1 == 'suspicious' and classification2 == 'suspicious':
                        classification = 'suspicious'
                        # Only get summary if classified as suspicious
                        summary = await get_groq_summary(url)
                    else:
                        classification = 'safe'
                        summary = ""
                    
                    # Save domain check to database
                    domain_check = DomainCheck(
                        domain=domain,
                        classification=classification,
                        summary=summary,
                        user_id=current_user.id
                    )
                    db.session.add(domain_check)
                    
                    # Add to memory cache
                    domain_cache[cache_key] = {
                        'classification': classification,
                        'summary': summary
                    }
            
            return {
                'url': url,
                'domain': domain,
                'title': tab['title'],
                'classification': classification,
                'summary': summary,
                'from_cache': from_cache
            }
        
        # Create tasks for all tabs
        for tab in tabs:
            processing_tasks.append(process_tab(tab))
        
        # Run all tasks concurrently and collect results
        results = await asyncio.gather(*processing_tasks)
        
        # Commit all database changes at once
        db.session.commit()
        
        total_time = time.time() - start_time
        print(f"Processed {len(tabs)} tabs in {total_time:.2f} seconds")
        
        return jsonify({
            'status': 'success',
            'results': results,
            'message': f'Processed {len(tabs)} tabs successfully in {total_time:.2f} seconds'
        })

    except Exception as e:
        print(f"Error processing tabs: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

if __name__ == '__main__':
    # Create index on domain and user_id for faster lookups
    with app.app_context():
        try:
            url_engine = db.get_engine(app, bind='url_db')
            # Create index if it doesn't exist
            db.session.execute(db.text('CREATE INDEX IF NOT EXISTS idx_domain_user_id ON domain_check (domain, user_id)'), bind=url_engine)
            db.session.commit()
            print("Database index created successfully")
        except Exception as e:
            print(f"Error creating index: {e}")
    
    app.run(port=5000)