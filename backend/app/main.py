from fastapi import FastAPI

from app.routers import auth, invitation, tool, user

app = FastAPI(title="Neighborhood Tool Sharing API")
app.include_router(auth.router)
app.include_router(invitation.router)
app.include_router(user.router)
app.include_router(tool.router)
