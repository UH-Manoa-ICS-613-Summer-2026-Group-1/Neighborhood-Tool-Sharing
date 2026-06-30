# Neighborhood Tool Sharing Web App

## Overview
This project is a web application that allows community members to list tools, request reservations, coordinate exchanges, and build trust through reviews and ratings. The system serves tool owners, borrowers, and administrators. This project is being developed for the semester project for UH Manoa's 2026 Summer Session for the ICS 613 course.

## Resources
-   [Google Drive Project Folder](https://drive.google.com/drive/folders/0AAv4SV03KLfVUk9PVA)
## Prerequisites
- Download and install Docker Desktop from the [Docker website](https://www.docker.com/get-started/)

## Local Backend Setup

The project uses '.env' file. Create your personal '.env' file using the provided template '.env.example'

Follow these steps to run the backend API locally on your machine.

Navigate to the project root directory.

For the first setup, or after modifying requirements.txt or Dockerfile start docker container using:
```bash
docker-compose up --build
```

For a normal start:
```bash
docker-compose up
```
These commands will start a server in your terminal.

To stop the server press `Ctrl + C` in the termial. 

## Database Migrations
Alembic is used to manage database versions.

Initially, you need to create tables in the database by applying migraion.

Before making or applying migrations, run the docker container.

Open a new terminal and follow next instructions to manage migrations.

To apply the latest version of migration, run:
```bash
docker-compose exec web alembic upgrade head
```

When you modify SQLAlchemy models, import a new moodel in backend/app/models/__init__.py and create a new migration:
```bash
docker-compose exec web alembic revision --autogenerate -m "description of changes"
```

To undo the very last database migration that was applied use:
```bash
docker-compose exec web alembic downgrade -1
```

## Seed Data

Run docker container and use the following command in separate terminal to seed the database:
```bash
docker-compose exec web python seed.py
```
Seed include: user_roles, user_statuses, users

## Backend Tests

Run docker container and use the following command in separate terminal to start pytest:

```bash
docker-compose exec web pytest
```

## Virtual Enviroment

To create and activate the virtual environment:

macOS / Linux (bash):
```bash
python3 -m venv .venv && source .venv/bin/activate
```
Windows (bash):
```bash
python -m venv .venv && source ".venv/Scripts/activate"
```
Install dependencies:
```Bash
pip install -r requirements.txt
```

## API Specifications
Open http://127.0.0.1:5000/docs

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

## Data Dictionary
-   The [data_dictionary_queries.sql](./backend/SQL/data_dictionary_queries.sql) script contains the DDL necessary to define the data dictionary views in the PostgreSQL database
-   ### Updating the Data Dictionary
    -   The data dictionary can be updated to define comments on tables, views, and columns. Once these comments are defined they can be retrieved by the custom [data dictionary views](#data-dictionary-views)
    -   There are multiple ways to define database object comments:
        -   Comments can be defined using sqlalchemy ([reference](https://docs.sqlalchemy.org/en/21/changelog/migration_12.html): under the "Support for SQL Comments on Table, Column, includes DDL, reflection" heading)
        -   Comments can be defined using SQL DDL commands:
            -   [DDL_helper.ods](./backend/SQL/DDL_helper.ods) has formulas defined to generate column comment DDL statements based on the values defined in Columns A - C
            -   The generated value in column D can be executed to define the corresponding column comment
            -   Table comments can be defined using the following DDL, where \[TABLE\_NAME\] is the name of the table and \[COMMENT\] is the comment for the specified table:
                -   `COMMENT ON TABLE [TABLE_NAME] IS '[COMMENT]';`
            -   The DDL can be saved and versioned by using the DDL to define an Alembic migration
-   ### Data Dictionary Views
    -   Data Dictionary Objects (data_dictionary_objects_v): this view returns the Object (Table, View, Materialized Views) and Column metadata
    -   Data Dictionary Relationships (data_dictionary_relationships_v): this view returns the foreign key relationships between tables
-   ### Export Procedure
    -   \*Note: Comments defined on the tables/columns will be included in the data dictionary views
    -   Define the data dictionary views ([data_dictionary_queries.sql](./backend/SQL/data_dictionary_queries.sql))
    -   Using a database client (e.g. pgadmin, DBeaver) export the results of the [data dictionary views](#data-dictionary-views) into separate tabs/worksheets of the spreadsheet
        -   \*Note: to export the Data Dictionary Objects view execute the following query: `SELECT * FROM public.data_dictionary_objects_v;`