# Neighborhood Tool Sharing Web App

## Overview
This project is a web application that allows community members to list tools, request reservations, coordinate exchanges, and build trust through reviews and ratings. The system serves tool owners, borrowers, and administrators. This project is being developed for the semester project for UH Manoa's 2026 Summer Session for the ICS 613 course.

## Resources
-   [Google Drive Project Folder](https://drive.google.com/drive/folders/0AAv4SV03KLfVUk9PVA)
## Local Backend Setup
Follow these steps to run the backend API locally on your machine.

Navigate to the server directory:
```Bash
cd server
```
Create and activate the virtual environment.

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
The project uses a `.env` file.
Create a personal .env file using the provided template ".env.example"

Run the development server:
```Bash
uvicorn app.main:app --reload --port 5000
```
The server will start locally at: http://127.0.0.1:5000

To stop the server, press `Ctrl + C` in the same terminal.

## API Specifications
Open http://127.0.0.1:5000/docs
