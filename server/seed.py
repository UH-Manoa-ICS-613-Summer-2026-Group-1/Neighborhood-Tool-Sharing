import sys
from app.database import SessionLocal
from app.utils.seeder import run_lookup_seeds

def seed_lookup_tables():
    print("Seed: start seeding lookup tables (user_roles, user_statuses).")
    db = SessionLocal()
    try:
        run_lookup_seeds(db)
        print("Seed: finished seeding lookup tables.")
        
    except Exception as e:
        db.rollback()
        print(f"Seed: seeding failed: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    seed_lookup_tables()