import os
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest
import sqlalchemy as sa
from alembic import command
from alembic.config import Config
from app.database import get_db
from app.main import app
from app.models.invitation import Invitation
from app.models.photo import Photo, ToolPhoto
from app.models.reservation import Reservation
from app.models.tool import Tool, ToolType
from app.models.user import User, UserRole, UserStatus
from app.schemas.reservation import APP_TIMEZONE
from app.utils.auth_helpers import create_access_token, get_password_hash
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


@pytest.fixture
def get_auth_headers():
    """
    Returns a helper function to generate auth headers instantly
    without hitting the database or hashing passwords to speed up tests.
    """

    def _headers(user_id: str | uuid.UUID):
        # Manually generate the JWT
        token = create_access_token(data={"sub": str(user_id)})
        return {"Authorization": f"Bearer {token}"}

    return _headers


@pytest.fixture(scope="session")
def hashed_password():
    """
    Computes the hash once per entire test suite run.
    """
    return get_password_hash("Correctpassword123!")


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
    This fixture provides a TestClient instance for making requests.
    It overrides the get_db dependency to use a test database session.
    'client' fixture takes 'db_session' as a dependency.
    Therefore, whenever you include 'client' in a test,
    the database is automatically clean first.
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
def seed_user(db_session, hashed_password):
    """
    Seeds a single valid user into the test database.
    """
    test_user_role = db_session.query(UserRole).filter(UserRole.code == "USER").first()
    test_user_status = (
        db_session.query(UserStatus).filter(UserStatus.code == "ACTIVE").first()
    )

    test_user = User(
        email="someemail@mail.com",
        password=hashed_password,
        first_name="UserFirst",
        last_name="UserLast",
        status=test_user_status,
        role=test_user_role,
    )
    db_session.add(test_user)
    db_session.commit()
    db_session.refresh(test_user)
    return test_user


@pytest.fixture()
def seed_user2(db_session, hashed_password):
    """
    Seeds a single valid user into the test database.
    Usually used for testing as the second participant in reserveation, messages, reviews.
    """
    test_user_role = db_session.query(UserRole).filter(UserRole.code == "USER").first()
    test_user_status = (
        db_session.query(UserStatus).filter(UserStatus.code == "ACTIVE").first()
    )

    test_user = User(
        email="someemail2@mail.com",
        password=hashed_password,
        first_name="UserFirst2",
        last_name="UserLast2",
        status=test_user_status,
        role=test_user_role,
    )
    db_session.add(test_user)
    db_session.commit()
    db_session.refresh(test_user)
    return test_user


@pytest.fixture()
def seed_user3(db_session, hashed_password):
    """
    Seeds a single valid user into the test database.
    Usually used for testing that the user who is not related to the tool/reservation/message/review cannot access them.
    """
    test_user_role = db_session.query(UserRole).filter(UserRole.code == "USER").first()
    test_user_status = (
        db_session.query(UserStatus).filter(UserStatus.code == "ACTIVE").first()
    )

    test_user = User(
        email="someemail3@mail.com",
        password=hashed_password,
        first_name="UserFirst3",
        last_name="UserLast3",
        status=test_user_status,
        role=test_user_role,
    )
    db_session.add(test_user)
    db_session.commit()
    db_session.refresh(test_user)
    return test_user


@pytest.fixture()
def seed_suspended_user(db_session, hashed_password):
    """
    Seeds a single suspended user into the test database.
    """
    test_user_role = db_session.query(UserRole).filter(UserRole.code == "USER").first()
    test_user_status = (
        db_session.query(UserStatus).filter(UserStatus.code == "SUSPENDED").first()
    )

    test_user = User(
        email="somesuspendedemail@mail.com",
        password=hashed_password,
        first_name="Firstname Test Suspended User",
        last_name="Lastname Test Suspended User",
        status=test_user_status,
        role=test_user_role,
    )
    db_session.add(test_user)
    db_session.commit()
    db_session.refresh(test_user)
    return test_user


@pytest.fixture()
def seed_invitation(db_session, seed_user):
    """
    Seeds a single invitation into the test database.
    """
    # Create an invite for a new user
    invite = Invitation(
        sender_id=seed_user.id,
        recipient_email="newuser@mail.com",
        invitation_token="valid-invite-token",
        status="PENDING",
    )
    db_session.add(invite)
    db_session.commit()
    db_session.refresh(invite)
    return invite


@pytest.fixture
def seed_tool(db_session, seed_user):
    """
    Seed a tool into the test database.
    The owner of the tool a seed_user ("someemail@mail.com", "Correctpassword123!").
    """
    tool_type = db_session.query(ToolType).filter(ToolType.code == "GARDENING").first()
    tool = Tool(
        owner_id=seed_user.id,
        tool_type_id=tool_type.id,
        title="Stihl Grass Eater",
        description="Gas trimmer engine edger.",
        condition="GOOD",
        loan_duration_limit=3,
        return_notes="Clean grass off guards.",
        pickup_notes="Meet by garage.",
    )

    db_session.add(tool)
    db_session.flush()  # Generates new_tool.id within the open transaction
    tool_photo = Photo(
        url="https://images.unsplash.com/photo-1617576683096-00fc8eecb3af"
    )
    db_session.add(tool_photo)
    db_session.flush()  # Generates db_photo.id

    # Form relationship link row in intersection table
    db_link = ToolPhoto(tool_id=tool.id, photo_id=tool_photo.id)
    db_session.add(db_link)
    db_session.commit()
    db_session.refresh(tool)
    return tool


@pytest.fixture()
def seed_reservation(db_session, seed_tool, seed_user2):
    """
    Seeds a single reservation with REQUESTED status into the test database.
    """
    # Create a reservation
    reservation = Reservation(
        tool_id=seed_tool.id,  # The owner is seed_user
        borrower_id=seed_user2.id,
        loan_duration_limit=seed_tool.loan_duration_limit,
        # Get current local datetime; set time to 00:00; convert to UTC
        start_date=datetime.now(APP_TIMEZONE)
        .replace(hour=0, minute=0, second=0)
        .astimezone(ZoneInfo("UTC")),
        # Get current local datetime; set time to 23:59; convert to UTC + 1 day
        end_date=datetime.now(APP_TIMEZONE)
        .replace(hour=23, minute=59, second=59)
        .astimezone(ZoneInfo("UTC"))
        + timedelta(days=1),
    )
    db_session.add(reservation)
    db_session.commit()
    db_session.refresh(reservation)
    return reservation
