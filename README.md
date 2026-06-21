# Neighborhood Tool Sharing Web App

## Overview
This project is a web application that allows community members to list tools, request reservations, coordinate exchanges, and build trust through reviews and ratings. The system serves tool owners, borrowers, and administrators. This project is being developed for the semester project for UH Manoa's 2026 Summer Session for the ICS 613 course.

## Resources
-   [Google Drive Project Folder](https://drive.google.com/drive/folders/0AAv4SV03KLfVUk9PVA)
## Prerequisites
- Download and install Docker Desktop from the [Docker website](https://www.docker.com/get-started/)

## Local Backend Setup
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

## Backend Tests

Run docker container and use the following command in separate terminal to start pytest:

```bash
docker-compose exec web pytest
```

## Database Migrations
Alembic is used to manage database schema versions.

Before making or applying migrations, run the docker container.

Open a new terminal and follow next instructions to manage migrations.

To update your database to the latest vesion, run:
```bash
docker-compose exec web alembic upgrade head
```

When you modify SQLAlchemy models, import a new moodel in server/app/models/__init__.py and create a new migration:
```bash
docker-compose exec web alembic revision --autogenerate -m "description of changes"
```

To undo the very last database migration that was applied use:
```bash
docker-compose exec web alembic downgrade -1
```

## API Specifications
Open [localhost:5000/docs](http://localhost:5000/docs)