# Neighborhood Tool Sharing Web App

## Overview
This project is a web application that allows community members to list tools, request reservations, coordinate exchanges, and build trust through reviews and ratings. The system serves tool owners, borrowers, and administrators. This project is being developed for the semester project for UH Manoa's 2026 Summer Session for the ICS 613 course.

## Resources
-   [Google Drive Project Folder](https://drive.google.com/drive/folders/0AAv4SV03KLfVUk9PVA)

## QA Tests
-   This project implements automated testing on-demand from a developer's workstation as well as using GitHub actions during specific events: pull requests, merging changes to main branch
-   On-Demand tests:
    -   Using bash (or git-bash), change to the root directory of the working copy of the repository
    -   Then execute the following command: `bash ./backend/qa/scripts/run_tests.sh`
    -   This will automatically execute all of the define automated tests
-   Automated GitHub tests:
    -   The workflow definition is defined in [ci.yml](./.github/workflows/ci.yml)
    -   The [run_tests.sh](./backend/qa/scripts/run_tests.sh) and ci.yml files should stay in-sync to ensure the tests are consistent
-   Testing Types:
    -   Backend:
        -   [pytest](https://docs.pytest.org/en/stable/)
        -   [ruff](https://docs.astral.sh/ruff/): python linter
        -   [SQLFluff](https://pypi.org/project/sqlfluff/): PostgreSQL linter
    -   Frontend:
        -   No frontend tests have been implemented yet
