#!/usr/bin/env bash
set -euo pipefail

# upgrade pip
python -m pip install --upgrade pip

# install QA tool dependencies
python -m pip install -r ./backend/qa/requirements-qa.txt

# Pytest with Docker
echo "Running pytest..."
# If the server is not running, remainder to start it.
if [ -z "$(docker compose ps web --services --status running)" ]; then
    echo "Start the server before the tests: docker-compose up"
    exit 1
fi
docker compose exec web pytest

echo "Running Ruff linter..."
python -m ruff check .

# echo "Running pip_audit linter..."
# python -m pip_audit

echo "Running SQLFluff linter..."
python -m sqlfluff lint .

echo "All checks passed."