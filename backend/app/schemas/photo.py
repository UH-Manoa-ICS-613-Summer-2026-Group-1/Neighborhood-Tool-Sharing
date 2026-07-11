import uuid

from pydantic import BaseModel, ConfigDict

# RESPONSE SCHEMAS


class PhotoSchema(BaseModel):
    id: uuid.UUID
    url: str

    model_config = ConfigDict(from_attributes=True)
