import os
import uuid
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.reservation import ReservationStatus
from app.schemas.photo import PhotoSchema

from .common import CleanStr

# Frontend gives UTC datetime to the backend.
# The datetime in the database is in UTC.
# We need to convert the datetime to the local timezone to calculate some reservation metrics.
APP_TIMEZONE_NAME = os.getenv("APP_TIMEZONE_NAME", "Pacific/Honolulu")
APP_TIMEZONE = ZoneInfo(APP_TIMEZONE_NAME)

# REQUEST SCHEMAS


class ReservationRequest(BaseModel):
    tool_id: uuid.UUID = Field(
        ..., description="The unique identifier of the tool to borrow."
    )
    start_date: datetime = Field(
        ...,
        description="The requested beginning date and time of the reservation (datetime with timezone).",
    )
    end_date: datetime = Field(
        ...,
        description="The requested calendar end date and time of reservation (datetime with timezone)",
    )

    @field_validator("start_date", "end_date")
    @classmethod
    def ensure_future_dates(cls, date: datetime) -> datetime:
        """
        US 2 Scenario 6: Reservation request contains past dates.
        Ensure reservation dates are in the future.
        """
        # Local date
        local_today_date = datetime.now(timezone.utc).astimezone(APP_TIMEZONE).date()

        # Convert UTC reservation timestamp to the local timezone
        incoming_local_date = date.astimezone(APP_TIMEZONE).date()

        # Check if the incoming date is in the past
        if incoming_local_date < local_today_date:
            raise ValueError(
                f"Reservation dates cannot be in the past. "
                f"In {APP_TIMEZONE_NAME}, today is {local_today_date}, but you requested {incoming_local_date}."
            )

        return date

    @model_validator(mode="after")
    def validate_date_bounds(self) -> "ReservationRequest":
        # US 2 Scenario 2: End date before start date validation
        if self.end_date < self.start_date:
            raise ValueError("The reservation end date must be after the start date.")
        return self


class ReservationUpdateRequest(BaseModel):
    pickup_notes: CleanStr | None = Field(default=None, max_length=2000)
    return_notes: CleanStr | None = Field(default=None, max_length=2000)


# RESPONSE SCHEMAS


class ReservationResponse(BaseModel):
    id: uuid.UUID
    tool_id: uuid.UUID
    borrower_id: uuid.UUID
    loan_duration_limit: int
    pickup_notes: str | None
    return_notes: str | None
    status: ReservationStatus
    start_date: datetime
    end_date: datetime
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ReservationDetailsResponse(BaseModel):
    """
    Reservation response schema matching only the necessary fields from the reservations_v view.
    """

    reservation_id: uuid.UUID
    reservation_status: ReservationStatus
    reservation_start_date: datetime
    reservation_end_date: datetime
    reservation_loan_duration_limit: int
    reservation_pickup_notes: str | None
    reservation_return_notes: str | None
    reservation_created_at: datetime

    tool_id: uuid.UUID
    tool_title: str
    tool_description: str
    tool_condition: str
    tool_type_id: int
    tool_type_code: str
    tool_type_name: str

    borrower_id: uuid.UUID
    borrower_first_name: str
    borrower_last_name: str
    borrower_middle_name: str | None

    owner_id: uuid.UUID
    owner_first_name: str
    owner_last_name: str
    owner_middle_name: str | None

    tool_photos: list[PhotoSchema]

    model_config = ConfigDict(from_attributes=True)
