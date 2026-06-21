from fastapi import FastAPI
from app.routers import auth

app = FastAPI(title="Neighborhood Tool Sharing API")
app.include_router(auth.router)