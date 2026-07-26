import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.notification import NotificationCategory

# RESPONSE SCHEMAS


class NotificationResponse(BaseModel):
    id: uuid.UUID
    recipient_id: uuid.UUID
    category: NotificationCategory
    title: str
    content: str
    target_id: uuid.UUID | None
    target_type: str | None
    is_read: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
