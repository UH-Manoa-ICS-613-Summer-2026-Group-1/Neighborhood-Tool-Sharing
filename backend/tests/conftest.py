import os
from pathlib import Path

import pytest
import sqlalchemy as sa
from alembic import command
from alembic.config import Config
from app.database import get_db
from app.main import app
from app.models.user import User, UserRole, UserStatus
from app.utils.auth_helpers import get_password_hash
from app.utils.seeder import run_lookup_seeds
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy_utils import create_database, database_exists

TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL")

ALEMBIC_INI_PATH = Path(__file__).resolve().parent.parent / "alembic.ini"

if not TEST_DATABASE_URL:
    raise ValueError("TEST_DATABASE_URL environment variable is not set")

engine = create_engine(TEST_DATABASE_URL)
if not database_exists(engine.url):
    create_database(engine.url)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="session", autouse=True)
def setup_database_schema():
    """
    Runs once at the start of the entire test run.
    Wipes the schema and uses Alembic to build all tables and views.
    """
    # Wipe the database
    with engine.connect() as conn:
        conn.execute(sa.text("DROP SCHEMA public CASCADE;"))
        conn.execute(sa.text("CREATE SCHEMA public;"))
        conn.commit()

    # Run migrations
    alembic_cfg = Config(str(ALEMBIC_INI_PATH))
    alembic_cfg.set_main_option("sqlalchemy.url", str(TEST_DATABASE_URL))
    command.upgrade(alembic_cfg, "head")

    yield


@pytest.fixture(scope="function")
def db_session():
    """
    Creates a new database session for each test.
    It isolates changes by wrapping the test in a database
    transaction and rolling back at the end.
    """
    # Begin a database transaction
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)

    # Begin a nested transaction for each test
    nested = connection.begin_nested()

    # Wrap the test in a database transaction
    @event.listens_for(session, "after_transaction_end")
    def end_savepoint(session, transaction):
        nonlocal nested
        if not nested.is_active:
            nested = connection.begin_nested()

    yield session

    # Close the database session, rollback the transaction
    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture(autouse=True)
def seed_lookups_tables(db_session):
    """
    Seeds all static reference lookup tables.
    """
    run_lookup_seeds(db_session)


@pytest.fixture()
def client(db_session):
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
    test_user_status = (
        db_session.query(UserStatus).filter(UserStatus.code == "ACTIVE").first()
    )

    test_user = User(
        email="someemail@mail.com",
        password=hashed_password,
        name="Test User",
        status=test_user_status,
        role=test_user_role,
    )
    db_session.add(test_user)
    db_session.commit()
    db_session.refresh(test_user)
    return test_user


@pytest.fixture()
def seed_suspended_user(db_session):
    """
    Seeds a single suspended user into the test database.
    """
    hashed_password = get_password_hash("Correctpassword123!")
    test_user_role = db_session.query(UserRole).filter(UserRole.code == "USER").first()
    test_user_status = (
        db_session.query(UserStatus).filter(UserStatus.code == "SUSPENDED").first()
    )

    test_user = User(
        email="somesuspendedemail@mail.com",
        password=hashed_password,
        name="Test Suspended User",
        status=test_user_status,
        role=test_user_role,
    )
    db_session.add(test_user)
    db_session.commit()
    db_session.refresh(test_user)
    return test_user
