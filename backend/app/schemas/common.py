from pydantic import BaseModel


class MessageResponse(BaseModel):
    message: str


class DetailError(BaseModel):
    detail: str
