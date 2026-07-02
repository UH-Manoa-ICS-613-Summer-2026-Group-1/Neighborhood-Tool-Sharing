from pydantic import BaseModel

# RESPONSE SCHEMAS


class MessageResponse(BaseModel):
    message: str


# ERROR SCHEMAS


class DetailError(BaseModel):
    detail: str
