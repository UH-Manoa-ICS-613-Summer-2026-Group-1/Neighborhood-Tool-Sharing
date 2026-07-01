#!/usr/bin/env bash
set -euo pipefail

echo "Building and spinning up dockerized environment..."
# Alsways start the containers in detached mode and build the images
docker compose up -d --build

echo "Updating the database..."
docker compose exec -T web alembic upgrade head

echo "Seeding temporary test data..."
docker compose exec -T web python seed.py

echo "Executing backend tests..."
source ./qa/scripts/run_backend_qa_checks.sh
echo "NOTE: Docker containers are left running for manual testing."
echo "    - Local Server: http://localhost:5000"
echo "    - API Docs:     http://localhost:5000/docs"
echo "    - To stop the containers, run: docker compose down"