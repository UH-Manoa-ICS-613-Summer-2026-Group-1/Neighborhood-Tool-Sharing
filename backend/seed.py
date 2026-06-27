import sys

from app.database import SessionLocal
from app.utils.seeder import run_admin_seeds, run_lookup_seeds, run_users_seeds


def seed_database():
    """
    Seed the database with initial data.
    """
    db = SessionLocal()
    try:
        print("Seed: start seeding lookup tables (user_roles, user_statuses).")
        run_lookup_seeds(db)
        print("Seed: start seeding users table.")
        run_users_seeds(db)
        print("Seed: start seeding admin in users table.")
        run_admin_seeds(db)
    except Exception as e:
        db.rollback()
        print(f"Seed: seeding failed: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
