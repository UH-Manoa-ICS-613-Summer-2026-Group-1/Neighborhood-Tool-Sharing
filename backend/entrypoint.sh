#!/bin/sh
set -e

if [ "$PRODUCTION" = "true" ]; then
  echo "Running database migrations..."
  alembic upgrade head
  echo "Seeding temporary test data..."
  python seed.py
fi

echo "Starting application..."
exec "$@"