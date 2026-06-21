import os
import pytest

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.main import app  
from app.database import Base, get_db
from app.models.user import User
from app.utils.auth_helpers import get_password_hash

TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL")

engine = create_engine(TEST_DATABASE_URL)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture()
def db_session():
    """Wipes and rebuilds the test DB for tests."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()

@pytest.fixture()
def seed_lookups(db_session):
    """
    Seeds all static reference lookup tables.
    """
    # Seed user roles
    db_session.execute(text("""
        INSERT INTO user_roles (id, code, display_name, description) VALUES 
        (1, 'USER', 'Member', 'Default application access'),
        (2, 'ADMIN', 'Administrator', 'Full system control')
        ON CONFLICT (id) DO NOTHING;
    """))
    
    # Seed user statuses
    db_session.execute(text("""
        INSERT INTO user_statuses (id, code, display_name, description) VALUES 
        (1, 'ACTIVE', 'Active','Active user account that have access to all system funcionality'),
        (2, 'SUSPENDED', 'Suspended','Suspended user account that restricted to access certain system functionality')
        ON CONFLICT (id) DO NOTHING;
    """))
    
    db_session.commit()

@pytest.fixture()
def client(db_session, seed_lookups):
    """Overrides the standard get_db dependency with our test session."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass
            
    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()
    
@pytest.fixture() 
def seed_user(db_session):
    """Seeds a single valid user into the test database."""
    hashed_password = get_password_hash("Correctpassword123!")
    test_user = User(
        email="someemail@mail.com", 
        password=hashed_password, 
        name="Test User",
        status_id=1,
        role_id=1
    )
    db_session.add(test_user)
    db_session.commit()
    db_session.refresh(test_user)
    return test_user