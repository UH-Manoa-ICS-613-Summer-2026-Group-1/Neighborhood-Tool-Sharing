#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$(cd "$SCRIPT_DIR/../../frontend" && pwd)"

cd "$FRONTEND_DIR"

# check if frontend dependencies are installed
if [[ ! -d "node_modules" ]]; then
  echo "Frontend dependencies are not installed."
  echo "Running npm install"
  npm install
fi

echo "Running frontend tests..."
npm run test

echo "Running ESLint..."
npm run lint

echo "Running production build..."
npm run build

echo "All frontend checks passed."