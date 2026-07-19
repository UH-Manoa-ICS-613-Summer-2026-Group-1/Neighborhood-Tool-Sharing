from typing import Any

from pydantic import BaseModel, Field

# REQUEST SCHEMAS


class MediaUploadRequest(BaseModel):
    filename: str = Field(
        ...,
        description="The original name of the file from the user's device",
        examples=["lawnmower.png"],
    )


# RESPONSE SCHEMAS


class MediaResponse(BaseModel):
    upload_target: str
    upload_fields: dict[str, Any]
    url: str
