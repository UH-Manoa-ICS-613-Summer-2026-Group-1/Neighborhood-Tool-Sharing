#!/usr/bin/env bash
set -euo pipefail

# determine the path of this script
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

# change to the repository root directory
cd "${SCRIPT_DIR}/../.."

# upgrade pip
python -m pip install --upgrade pip

# install QA tool dependencies
python -m pip install -r ./backend/qa/requirements-qa.txt

# Pytest with Docker
echo "Running pytest..."
# If the server is not running, remainder to start it.
if [ -z "$(docker compose ps web --services --status running)" ]; then
    echo "Start the server before the tests: docker compose up"
    exit 1
fi

# run tests and calculate test coverage
echo "running unit tests and calculating test coverage"
docker compose exec web pytest tests \
--cov=app \
--cov-branch \
--cov-report=term-missing  

echo "Checking Ruff formatting..."
python -m ruff format --check .

# include only medium and high severity, high confidence findings
echo "Running Bandit linter..."
docker compose exec web \
python -m bandit -r app -ll -iii

# echo "Running pip_audit linter..."
# python -m pip_audit

echo "Running mypy static type checker..."
python -m mypy app \
--check-untyped-defs \
--warn-unused-ignores

echo "Running SQLFluff linter..."
python -m sqlfluff lint .

echo "All checks passed."