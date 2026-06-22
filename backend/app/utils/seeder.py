# This module provides a function to seed all lookup tables in the database.
# it can be used in seeding scripts for development, testing, or production databases.
# Tables included: user_roles, user_statuses
from sqlalchemy import text
from sqlalchemy.orm import Session

def run_lookup_seeds(db: Session):
    # Seed user_roles
    db.execute(text("""
        INSERT INTO user_roles (code, display_name, description) VALUES 
        ('USER', 'Member', 'Default application access'),
        ('ADMIN', 'Administrator', 'Full system control')
        ON CONFLICT (code) DO NOTHING;
    """))
    
    # Seed user_statuses
    db.execute(text("""
        INSERT INTO user_statuses (code, display_name, description) VALUES 
        ('ACTIVE', 'Active', 'Active user account'),
        ('SUSPENDED', 'Suspended', 'Suspended user account')
        ON CONFLICT (code) DO NOTHING;
    """))
    
    db.commit()