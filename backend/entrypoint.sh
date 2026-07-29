#!/bin/sh
set -e

# Check that db is ready
echo "Waiting for database to be ready..."
python -c "
import time, os, sys
from sqlalchemy import create_engine, text

db_url = os.getenv('DATABASE_URL')
if not db_url:
    print('DATABASE_URL not set')
    sys.exit(1)

for attempt in range(1, 11):
    try:
        engine = create_engine(db_url)
        with engine.connect() as conn:
            conn.execute(text('SELECT 1'))
        print('Database connection successful.')
        sys.exit(0)
    except Exception as e:
        print(f'Database not ready yet (Attempt {attempt}/10). Retrying in 5s...')
        time.sleep(5)
print('Could not connect to Database after maximum retries.')
sys.exit(1)
"

# Run database migrations and seed data
if [ "$PRODUCTION" = "true" ]; then
  echo "Running database migrations..."
  alembic upgrade head
  echo "Seeding temporary test data..."
  python seed.py
fi

echo "Starting application..."
exec "$@"