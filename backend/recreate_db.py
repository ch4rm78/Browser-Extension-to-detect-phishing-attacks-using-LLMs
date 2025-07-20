from server import app, db
from server import User, DomainCheck

with app.app_context():
    # Drop all tables from the default database
    db.drop_all()
    
    # Drop all tables from the URL database
    url_engine = db.get_engine(app, bind='url_db')
    DomainCheck.__table__.drop(url_engine, checkfirst=True)
    
    # Create all tables with the new schema in both databases
    db.create_all()
    
    # Create URL database tables explicitly
    DomainCheck.__table__.create(url_engine, checkfirst=True)
    
    print('Database tables recreated successfully in both databases')