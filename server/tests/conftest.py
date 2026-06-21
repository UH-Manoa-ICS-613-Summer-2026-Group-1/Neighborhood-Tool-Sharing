import os
import pytest

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.main import app  
from app.database import Base, get_db
from app.models.user import User, UserRole, UserStatus
from app.utils.auth_helpers import get_password_hash
from app.utils.seeder import run_lookup_seeds

TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL")

engine = create_engine(TEST_DATABASE_URL)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture()
def db_session():
    """
    Wipes and rebuilds the test DB for tests.
    """
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()

@pytest.fixture()
def seed_lookups_tables(db_session):
    """
    Seeds all static reference lookup tables.
    """
    run_lookup_seeds(db_session)
    
@pytest.fixture()
def client(db_session, seed_lookups_tables):
    """
    Overrides the standard get_db dependency with our test session.
    """
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
    """
    Seeds a single valid user into the test database.
    """
    hashed_password = get_password_hash("Correctpassword123!")
    test_user_role = db_session.query(UserRole).filter(UserRole.code == "USER").first()
    test_user_status = db_session.query(UserStatus).filter(UserStatus.code == "ACTIVE").first()
    
    test_user = User(
        email="someemail@mail.com", 
        password=hashed_password, 
        name="Test User",
        status=test_user_status,
        role=test_user_role
    )
    db_session.add(test_user)
    db_session.commit()
    db_session.refresh(test_user)
    return test_user