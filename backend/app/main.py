from fastapi import FastAPI

from app.routers import auth, user

app = FastAPI(title="Neighborhood Tool Sharing API")
app.include_router(auth.router)
app.include_router(user.router)
