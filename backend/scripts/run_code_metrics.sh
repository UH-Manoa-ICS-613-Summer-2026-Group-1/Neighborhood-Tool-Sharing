#!/usr/bin/env bash
set -euo pipefail

echo "generate python cyclomatic complexity using radon"
docker compose exec web \
python -m radon cc app -s -a

echo "generate python maintainability index using radon"
docker compose exec web \
python -m radon mi app -s

echo "generate python raw metrics using radon"
docker compose exec web \
python -m radon raw app

# echo "generate python halstead metrics using radon"
# docker compose exec web \
# python -m radon hal app
