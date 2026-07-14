from fastapi import FastAPI

from app.routers import auth, invitation, media, reservation, tool, user
from app.utils.startup import lifespan

app = FastAPI(lifespan=lifespan, title="Neighborhood Tool Sharing API")
app.include_router(auth.router)
app.include_router(invitation.router)
app.include_router(user.router)
app.include_router(tool.router)
app.include_router(reservation.router)
app.include_router(media.router)
