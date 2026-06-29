"""
This module provides functions to seed data into the database.
It can be used in seeding scripts for development, testing, or production databases.
Seed include: lookup tables: user_roles, user_statuses; users table (users, admins)
"""

import os

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.utils.auth_helpers import get_password_hash


def run_lookup_seeds(db: Session):
    """
    Seed the lookup tables in the database with initial data.
    """
    # Seed user_roles
    db.execute(
        text("""
            INSERT INTO user_roles (code, display_name, description) VALUES
            ('USER', 'Member', 'Default application access'),
            ('ADMIN', 'Administrator', 'Full system control')
            ON CONFLICT (code) DO NOTHING;
        """)
    )

    # Seed user_statuses
    db.execute(
        text("""
            INSERT INTO user_statuses (code, display_name, description) VALUES
            ('ACTIVE', 'Active', 'Active user account'),
            ('SUSPENDED', 'Suspended', 'Suspended user account')
            ON CONFLICT (code) DO NOTHING;
        """)
    )

    db.commit()


def run_users_seeds(db: Session):
    """
    Seed the users table with initial data.
    """
    sql_query = text("""
        INSERT INTO users (name, email, password, bio, location, status_id, role_id) VALUES
        (
            'Seed User 1', 'seed1@example.com', :pass, 'Bio 1', 'Location 1',
            (SELECT id FROM user_statuses WHERE code = 'ACTIVE'),
            (SELECT id FROM user_roles WHERE code = 'USER')
        ),
        (
            'Seed User 2', 'seed2@example.com', :pass, 'Bio 2', NULL,
            (SELECT id FROM user_statuses WHERE code = 'ACTIVE'),
            (SELECT id FROM user_roles WHERE code = 'USER')
        ),
        (
            'Seed User 3', 'seed3@example.com', :pass, NULL, 'Location 3',
            (SELECT id FROM user_statuses WHERE code = 'ACTIVE'),
            (SELECT id FROM user_roles WHERE code = 'USER')
        ),
        (
            'Seed User 4', 'seed4@example.com', :pass, 'Bio 4', 'Location 4',
            (SELECT id FROM user_statuses WHERE code = 'ACTIVE'),
            (SELECT id FROM user_roles WHERE code = 'USER')
        ),
        (
            'Seed User 5', 'seed5@example.com', :pass, 'Bio 5', 'Location 5',
            (SELECT id FROM user_statuses WHERE code = 'SUSPENDED'),
            (SELECT id FROM user_roles WHERE code = 'USER')
        )
        ON CONFLICT (email) DO NOTHING;
    """)

    db.execute(sql_query, {"pass": get_password_hash("ValidPassword1!")})
    db.commit()


def run_admin_seeds(db: Session):
    """
    Seed the users table with admins.
    """
    ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD")

    if not ADMIN_PASSWORD:
        raise ValueError("ADMIN_PASSWORD environment variable is not set")

    sql_query = text("""
        INSERT INTO users (name, email, password, status_id, role_id) VALUES
        (
            'Admin 1', 'admin_email@example.com', :pass,
            (SELECT id FROM user_statuses WHERE code = 'ACTIVE'),
            (SELECT id FROM user_roles WHERE code = 'ADMIN')
        )
        ON CONFLICT (email) DO NOTHING;
    """)

    db.execute(sql_query, {"pass": get_password_hash(ADMIN_PASSWORD)})
    db.commit()
