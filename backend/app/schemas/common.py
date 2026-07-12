from typing import Annotated

from pydantic import BaseModel, BeforeValidator

from app.utils.auth_helpers import strip_spaces

# Define a custom Type
# We want that pydantic catchs the min length when the field consist of only spaces
# This prevent a bug when a user registers with a spaces in their first and last names
CleanStr = Annotated[str, BeforeValidator(strip_spaces)]

# RESPONSE SCHEMAS


class MessageResponse(BaseModel):
    message: str


# ERROR SCHEMAS


class DetailError(BaseModel):
    detail: str
