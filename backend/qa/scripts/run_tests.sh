#!/usr/bin/env bash
set -euo pipefail

# upgrade pip
python -m pip install --upgrade pip

# install QA tool dependencies
python -m pip install -r ./backend/qa/requirements-qa.txt

echo "Running pytest..."
python -m pytest

echo "Running Ruff linter..."
python -m ruff check .

# echo "Running pip_audit linter..."
# python -m pip_audit

echo "Running SQLFluff linter..."
python -m sqlfluff lint --dialect postgres .

echo "All checks passed."