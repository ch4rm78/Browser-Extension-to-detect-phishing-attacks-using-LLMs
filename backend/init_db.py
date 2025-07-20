from server import app, db
from server import User, DomainCheck

def init_database():
    with app.app_context():
        # Create all tables in the default database (users)
        db.create_all()
        
        # Create URL database tables explicitly
        url_engine = db.get_engine(app, bind='url_db')
        DomainCheck.__table__.create(url_engine, checkfirst=True)
        
        print("Both databases initialized successfully!")

if __name__ == "__main__":
    init_database()