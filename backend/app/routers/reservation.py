"""
Reservation routers.
Handles creating, viewing, and updating reservations.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.reservation import Reservation, ReservationStatus, ReservationView
from app.models.tool import Tool, ToolStatus
from app.models.user import User
from app.schemas.common import DetailError, MessageResponse
from app.schemas.reservation import (
    APP_TIMEZONE,
    ReservationDetailsResponse,
    ReservationRequest,
    ReservationResponse,
    ReservationUpdateRequest,
)
from app.utils.dependencies import get_current_user

router = APIRouter(prefix="/api/reservations", tags=["Reservations"])


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    response_model=ReservationResponse,
    responses={
        401: {"model": DetailError},
        403: {"model": DetailError},
        400: {"model": DetailError},
        409: {"model": DetailError},
    },
)
def create_reservation(
    reservation_data: ReservationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Create a new tool reservation request.
    """
    # Verify the tool exists and is actually available for public borrowing
    tool = db.query(Tool).filter(Tool.id == reservation_data.tool_id).first()
    if not tool:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The requested tool does not exist.",
        )

    if tool.status != ToolStatus.AVAILABLE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This tool is currently not available and cannot be reserved.",
        )

    # Prevent users from booking their own tools
    if tool.owner_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot reserve your own tool.",
        )

    # There is the maximum number ofdays that the owner allows a user to request a tool
    if (
        reservation_data.end_date - reservation_data.start_date
    ).days > tool.loan_duration_limit:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"The maximum number of days for requesting for this tool is {tool.loan_duration_limit}.",
        )

    # Check for overlapping reservations
    # A conflict happens if: new_start < existing_end AND new_end > existing_start
    # We look for any conflicting blocks that are already requested or approved
    overlap = (
        db.query(Reservation)
        .filter(
            and_(
                Reservation.tool_id == reservation_data.tool_id,
                Reservation.status.in_(
                    [ReservationStatus.APPROVED, ReservationStatus.PICKED_UP]
                ),
                Reservation.start_date < reservation_data.end_date,
                Reservation.end_date > reservation_data.start_date,
            )
        )
        .first()
    )

    # If there is a conflict, raise an error
    if overlap:
        # Format the blocked dates back to local time strings to give a helpful error message
        local_start = overlap.start_date.astimezone(APP_TIMEZONE).date()
        local_end = overlap.end_date.astimezone(APP_TIMEZONE).date()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"The tool is already reserved from {local_start} to {local_end} during your selected window.",
        )

    # Build the new reservation entity
    new_reservation = Reservation(
        tool_id=reservation_data.tool_id,
        borrower_id=current_user.id,
        start_date=reservation_data.start_date,  # UTC
        end_date=reservation_data.end_date,  # UTC
        status=ReservationStatus.REQUESTED,
        pickup_notes=tool.pickup_notes,
        return_notes=tool.return_notes,
    )

    try:
        db.add(new_reservation)
        db.commit()
        db.refresh(new_reservation)
        return new_reservation

    except Exception as e:
        db.rollback()
        print(f"Database write failure during reservation creation pipeline: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save your reservation request.",
        )


@router.get(
    "",
    status_code=status.HTTP_200_OK,
    response_model=list[ReservationDetailsResponse],
    responses={
        401: {"model": DetailError},
        403: {"model": DetailError},
    },
)
def list_reservations(
    role: str | None = Query(
        default=None,
        description="'None' to get all user reservations; 'owner' to get the reservations for tools "
        "owned by the user; 'borrower' to get the reservations for tools borrowed by the user.",
    ),
    status_filter: str | None = Query(
        default=None,
        alias="status",
        description="'None' to get all reservations; or filter by reservation status (e.g., 'REQUESTED',"
        " 'APPROVED', 'DENIED', 'PICKED_UP', 'RETURNED', 'CANCELED')",
    ),
    limit: int = Query(default=10, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Retrieve a list of reservations involving the current user.
    """
    # Initialize query context pointed at the reservation view
    query = db.query(ReservationView)

    # Scope the view results dynamically based on context role
    if role is not None:
        if role.lower() == "owner":
            query = query.filter(ReservationView.owner_id == current_user.id)
        elif role.lower() == "borrower":
            query = query.filter(ReservationView.borrower_id == current_user.id)
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid role parameter: {role.lower()}. Choose 'owner', 'borrower', or omit it.",
            )
    else:
        # If role is None, get all records where user is either borrower OR owner
        query = query.filter(
            or_(
                ReservationView.borrower_id == current_user.id,
                ReservationView.owner_id == current_user.id,
            )
        )

    # Apply optional status filtering
    if status_filter:
        if status_filter.upper() in ReservationStatus:
            query = query.filter(
                ReservationView.reservation_status == status_filter.upper()
            )
        else:
            # If status_filter is not a valid status, raise an error
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status parameter: {status_filter.upper() if status_filter else 'None'}."
                " Choose 'REQUESTED', 'APPROVED', 'DENIED', 'PICKED_UP', 'RETURNED', 'CANCELED', or omit it.",
            )

    # Sort by creation date
    results = (
        query.order_by(ReservationView.reservation_created_at.desc())
        .limit(limit)
        .offset(offset)
        .all()
    )

    return results


@router.get(
    "/{reservation_id}",
    status_code=status.HTTP_200_OK,
    response_model=ReservationDetailsResponse,
    responses={
        401: {"model": DetailError},
        403: {"model": DetailError},
        404: {"model": DetailError},
    },
)
def get_reservation_by_id(
    reservation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Retrieve full details for a specific reservation by its unique identifier.
    """
    # Query the reservation view
    reservation = (
        db.query(ReservationView)
        .filter(ReservationView.reservation_id == reservation_id)
        .first()
    )

    if not reservation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reservation record not found.",
        )

    # Only the borrower or the tool owner can inspect this detail object
    is_borrower = bool(reservation.borrower_id == current_user.id)
    is_owner = bool(reservation.owner_id == current_user.id)

    if not is_borrower and not is_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have administrative permission to view this reservation.",
        )

    return reservation


@router.post(
    "/{reservation_id}/approve",
    status_code=status.HTTP_200_OK,
    response_model=MessageResponse,
    responses={
        400: {"model": DetailError},
        401: {"model": DetailError},
        403: {"model": DetailError},
        404: {"model": DetailError},
    },
)
def approve_reservation(
    reservation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Update the status of a reservation to "APPROVED".
    """
    # Fetch the targeted reservation
    reservation = db.query(Reservation).filter(Reservation.id == reservation_id).first()
    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found.")

    # Ensure the person approving it owns the tool
    if reservation.tool.owner_id != current_user.id:
        raise HTTPException(
            status_code=403, detail="Only the tool owner can approve requests."
        )

    # Check if the reseravation is not in status REQUESTED
    if reservation.status != ReservationStatus.REQUESTED:
        raise HTTPException(
            status_code=400,
            detail=f"You cannot approve this reservation. The status of the reservation is {reservation.status.value}.",
        )

    try:
        # Update this request to APPROVED
        reservation.status = ReservationStatus.APPROVED
        db.flush()

        # Auto-deny competing REQUESTED reservations that overlap
        competing_reservations = (
            db.query(Reservation)
            .filter(
                and_(
                    Reservation.tool_id == reservation.tool_id,
                    # Don't reject the one we just approved
                    Reservation.id != reservation.id,
                    Reservation.status == ReservationStatus.REQUESTED,
                    # If both conditions are true, the dates overlap
                    Reservation.start_date < reservation.end_date,
                    Reservation.end_date > reservation.start_date,
                )
            )
            .all()
        )

        for competing_reservation in competing_reservations:
            competing_reservation.status = ReservationStatus.DENIED

        db.commit()
        return {
            "message": f"Reservation approved. {len(competing_reservations)} overlapping requests were auto-denied."
        }

    except Exception as e:
        db.rollback()
        print(f"Failed to process approval action: {e}")
        raise HTTPException(
            status_code=500, detail="Failed to process approval action."
        )


@router.patch(
    "/{reservation_id}",
    status_code=status.HTTP_200_OK,
    response_model=ReservationResponse,
    responses={
        400: {"model": DetailError},
        401: {"model": DetailError},
        403: {"model": DetailError},
        404: {"model": DetailError},
    },
)
def update_reservation(
    reservation_id: uuid.UUID,
    patch_data: ReservationUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Update a reservation.
    """
    # Fetch the reservation entity
    reservation = db.query(Reservation).filter(Reservation.id == reservation_id).first()
    if not reservation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reservation record not found.",
        )

    # Only the tool owner can modify these notes
    is_owner = bool(reservation.tool.owner_id == current_user.id)

    if not is_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to modify this reservation.",
        )

    # Prevent modifications on inactive (canceled, denied, returned) reservations
    inactive_statuses = {
        ReservationStatus.DENIED,
        ReservationStatus.CANCELED,
        ReservationStatus.RETURNED,
    }
    if reservation.status in inactive_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot update loan notes on a reservation with a status of '{reservation.status.value}'.",
        )

    # Apply partial updates (only if the field is explicitly provided in the request)
    # Also prevent saving empty strings; if empty stirings are provided -> save None
    if patch_data.pickup_notes is not None:
        reservation.pickup_notes = (
            patch_data.pickup_notes if patch_data.pickup_notes != "" else None
        )

    if patch_data.return_notes is not None:
        reservation.return_notes = (
            patch_data.return_notes if patch_data.return_notes != "" else None
        )

    try:
        db.commit()

        return reservation

    except Exception as e:
        db.rollback()
        print(f"Database write failure during reservation PATCH pipeline: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update reservation notes.",
        )
