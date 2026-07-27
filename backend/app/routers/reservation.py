"""
Reservation routers.
Handles creating, viewing, and updating reservations.
Also, reviewing and messaging within reservations.
"""

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.message import Message
from app.models.notification import NotificationCategory
from app.models.reservation import Reservation, ReservationStatus, ReservationView
from app.models.review import Review, ReviewView
from app.models.tool import Tool, ToolStatus
from app.models.user import User
from app.schemas.common import DetailError, MessageResponse
from app.schemas.message import MessageCreate, MessageResponse
from app.schemas.reservation import (
    APP_TIMEZONE,
    ReservationDetailsResponse,
    ReservationRequest,
    ReservationResponse,
    ReservationUpdateRequest,
)
from app.schemas.review import ReviewDetailsResponse, ReviewRequest, ReviewResponse
from app.utils.dependencies import get_current_user
from app.utils.notification_helpers import create_notification

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
        loan_duration_limit=tool.loan_duration_limit,
        pickup_notes=tool.pickup_notes,
        return_notes=tool.return_notes,
    )

    try:
        # Add the new reservation
        db.add(new_reservation)

        # flash() to use new_reservation.id as the target_id
        db.flush()

        # Add the notification
        create_notification(
            db=db,
            recipient_id=tool.owner_id,
            category=NotificationCategory.RESERVATION,
            title="New reservation request",
            content=f"{current_user.first_name} {current_user.last_name} has requested to borrow your tool '{tool.title}'.",
            target_id=new_reservation.id,
            target_type="RESERVATION",
        )
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
        # Add the notification
        create_notification(
            db=db,
            recipient_id=reservation.borrower_id,
            category=NotificationCategory.RESERVATION,
            title="Reservation notes updated",
            content=f"{reservation.tool.owner.first_name} {reservation.tool.owner.last_name} has updated reservation notes.",
            target_id=reservation.id,
            target_type="RESERVATION",
        )
        db.commit()

        return reservation

    except Exception as e:
        db.rollback()
        print(f"Database write failure during reservation PATCH pipeline: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update reservation notes.",
        )


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
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Reservation not found."
        )

    # Ensure the person approving it owns the tool
    if reservation.tool.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the tool owner can approve requests.",
        )

    # Check if the reseravation is not in status REQUESTED
    if reservation.status != ReservationStatus.REQUESTED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"You cannot approve this reservation. The status of the reservation is {reservation.status.value}.",
        )

    try:
        # Update this request to APPROVED
        reservation.status = ReservationStatus.APPROVED
        db.flush()

        # add approve notification
        create_notification(
            db=db,
            recipient_id=reservation.borrower_id,
            category=NotificationCategory.RESERVATION,
            title="Reservation approved",
            content=f"Your request for '{reservation.tool.title}' has been approved.",
            target_id=reservation.id,
            target_type="RESERVATION",
        )

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

            # Add auto-deny notification
            create_notification(
                db=db,
                recipient_id=competing_reservation.borrower_id,
                category=NotificationCategory.RESERVATION,
                title="Reservation request denied",
                content=f"Your request for '{reservation.tool.title}' was auto-denied due to an overlapping approved reservation.",
                target_id=competing_reservation.id,
                target_type="RESERVATION",
            )

        db.commit()
        return {
            "message": f"Reservation approved. {len(competing_reservations)} overlapping requests were auto-denied."
        }

    except Exception as e:
        db.rollback()
        print(f"Failed to process approval action: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process approval action.",
        )


@router.post(
    "/{reservation_id}/deny",
    status_code=status.HTTP_200_OK,
    response_model=MessageResponse,
    responses={
        400: {"model": DetailError},
        401: {"model": DetailError},
        403: {"model": DetailError},
        404: {"model": DetailError},
    },
)
def deny_reservation(
    reservation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Update the status of a reservation to "DENIED".
    """
    # Fetch the targeted reservation
    reservation = db.query(Reservation).filter(Reservation.id == reservation_id).first()
    if not reservation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Reservation not found."
        )

    # Ensure the person denying it owns the tool
    if reservation.tool.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the tool owner can approve requests.",
        )

    # Check if the reseravation is not in status REQUESTED
    if reservation.status != ReservationStatus.REQUESTED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"You cannot deny this reservation. The status of the reservation is {reservation.status.value}.",
        )

    try:
        # Update this request to DENIED
        reservation.status = ReservationStatus.DENIED

        #  Add the notification
        create_notification(
            db=db,
            recipient_id=reservation.borrower_id,
            category=NotificationCategory.RESERVATION,
            title="Reservation request denied",
            content=f"Your request for '{reservation.tool.title}' was denied by the tool owner.",
            target_id=reservation.id,
            target_type="RESERVATION",
        )

        db.commit()
        return {"message": "Reservation has been denied."}

    except Exception as e:
        db.rollback()
        print(f"Failed to process denial action: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process denial action.",
        )


@router.post(
    "/{reservation_id}/pickup",
    status_code=status.HTTP_200_OK,
    response_model=MessageResponse,
    responses={
        400: {"model": DetailError},
        401: {"model": DetailError},
        403: {"model": DetailError},
        404: {"model": DetailError},
    },
)
def pickup_reservation(
    reservation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Update the status of a reservation to "PICKED_UP".
    """
    # Fetch the targeted reservation
    reservation = db.query(Reservation).filter(Reservation.id == reservation_id).first()
    if not reservation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Reservation not found."
        )

    # Only the borrower can mark as picked up
    if reservation.borrower_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the borrowing user can confirm this tool pickup.",
        )

    # Can only pick up from APPROVED status
    if reservation.status != ReservationStatus.APPROVED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"You cannot pick up this reservation. The status of the reservation is {reservation.status.value}.",
        )

    # Get the current datetime UTC (reservation datetimes is in UTC also)
    now = datetime.now(timezone.utc)

    # Check if we are trying to pick up before the start date or after the end date
    if now < reservation.start_date or now > reservation.end_date:
        local_start = reservation.start_date.astimezone(APP_TIMEZONE).date()
        local_end = reservation.end_date.astimezone(APP_TIMEZONE).date()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Pickup can only be confirmed during the scheduled reservation period: from {local_start} to {local_end}.",
        )

    try:
        # Update this request to PICKED_UP
        reservation.status = ReservationStatus.PICKED_UP

        #  Add the notification
        create_notification(
            db=db,
            recipient_id=reservation.tool.owner_id,
            category=NotificationCategory.RESERVATION,
            title="Tool picked up",
            content=f"{current_user.first_name} {current_user.last_name} has marked '{reservation.tool.title}' as picked up.",
            target_id=reservation.id,
            target_type="RESERVATION",
        )

        db.commit()

        return {"message": "Tool pickup successfully registered."}

    except Exception as e:
        db.rollback()
        print(f"Failed to process pickup action: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process pickup action.",
        )


@router.post(
    "/{reservation_id}/return",
    status_code=status.HTTP_200_OK,
    response_model=MessageResponse,
    responses={
        400: {"model": DetailError},
        401: {"model": DetailError},
        403: {"model": DetailError},
        404: {"model": DetailError},
    },
)
def return_reservation(
    reservation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Update the status of a reservation to "RETURNED".
    """
    # Fetch the targeted reservation
    reservation = db.query(Reservation).filter(Reservation.id == reservation_id).first()
    if not reservation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Reservation not found."
        )

    # Only the owner can mark as returned
    if reservation.tool.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the tool owner can confirm return.",
        )

    # Can only return from picked up status
    if reservation.status != ReservationStatus.PICKED_UP:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"You cannot return this reservation. The status of the reservation is {reservation.status.value}.",
        )

    try:
        # Update this request to RETURNED
        reservation.status = ReservationStatus.RETURNED

        #  Add the notification
        create_notification(
            db=db,
            recipient_id=reservation.borrower_id,
            category=NotificationCategory.RESERVATION,
            title="Tool return confirmed",
            content=f"Return confirmed for '{reservation.tool.title}'. Don't forget to leave a review.",
            target_id=reservation.id,
            target_type="RESERVATION",
        )

        db.commit()

        return {"message": "Tool return successfully registered."}

    except Exception as e:
        db.rollback()
        print(f"Failed to process return action: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process return action.",
        )


@router.post(
    "/{reservation_id}/cancel",
    status_code=status.HTTP_200_OK,
    response_model=MessageResponse,
    responses={
        400: {"model": DetailError},
        401: {"model": DetailError},
        403: {"model": DetailError},
        404: {"model": DetailError},
    },
)
def cancel_reservation(
    reservation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Update the status of a reservation to "CANCELLED".
    """
    # Fetch the targeted reservation
    reservation = db.query(Reservation).filter(Reservation.id == reservation_id).first()
    if not reservation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Reservation not found."
        )

    # Only the owner or the borrower can cancel
    is_owner = bool(reservation.tool.owner_id == current_user.id)
    is_borrower = bool(reservation.borrower_id == current_user.id)

    if not (is_owner or is_borrower):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to cancel this reservation.",
        )

    # Can only cancel from requested or approved status
    if reservation.status not in [
        ReservationStatus.REQUESTED,
        ReservationStatus.APPROVED,
    ]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"You cannot cancal this reservation. The status of the reservation is {reservation.status.value}.",
        )

    try:
        # Update this request to CANCELLED
        reservation.status = ReservationStatus.CANCELED

        # If the current user is the borrower, the recipient is the owner, and vice versa.
        if is_borrower:
            recipient_id = reservation.tool.owner_id
        else:
            recipient_id = reservation.borrower_id

        # Add the notification
        create_notification(
            db=db,
            recipient_id=recipient_id,
            category=NotificationCategory.RESERVATION,
            title="Reservation cancelled",
            content=f"The reservation for '{reservation.tool.title}' was cancelled by {current_user.first_name} {current_user.last_name}.",
            target_id=reservation.id,
            target_type="RESERVATION",
        )
        db.commit()

        return {"message": "Reservation has been cancelled."}

    except Exception as e:
        db.rollback()
        print(f"Failed to process cancel action: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process cancel action.",
        )


@router.post(
    "/{reservation_id}/reviews",
    response_model=ReviewResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        400: {"model": DetailError},
        401: {"model": DetailError},
        403: {"model": DetailError},
        404: {"model": DetailError},
    },
)
def submit_reservation_review(
    reservation_id: uuid.UUID,
    review_data: ReviewRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Submit a peer review for a completed reservation listing.
    """
    # Verify the reservation exists
    reservation = db.query(Reservation).filter(Reservation.id == reservation_id).first()
    if not reservation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reservation not found.",
        )

    # Verify the reservation is complete
    if reservation.status != "RETURNED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reviews can only be submitted for completed reservations.",
        )

    # Ensure the current user is actually part of this reservation
    is_borrower = reservation.borrower_id == current_user.id
    is_lender = reservation.tool.owner_id == current_user.id

    if not (is_borrower or is_lender):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to review a reservation you were not a party to.",
        )

    # If already reviewed
    already_reviewed = (
        db.query(Review)
        .filter(
            Review.reservation_id == reservation_id,
            Review.reviewer_id == current_user.id,
        )
        .first()
    )
    if already_reviewed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already submitted a review for this reservation.",
        )

    # Determine the reviewee
    # If the current user is the borrower, the reviewee is the owner, and vice versa.
    if is_borrower:
        reviewee_id = reservation.tool.owner_id
    else:
        reviewee_id = reservation.borrower_id

    # Handle comment field
    comment = None
    if review_data.comment is not None:
        comment = review_data.comment if review_data.comment != "" else None

    # Build and save the review record
    new_review = Review(
        reservation_id=reservation_id,
        reviewer_id=current_user.id,
        reviewee_id=reviewee_id,
        rating=review_data.rating,
        comment=comment,
    )

    try:
        db.add(new_review)
        db.flush()

        # Add the notification
        create_notification(
            db=db,
            recipient_id=reviewee_id,
            category=NotificationCategory.REVIEW,
            title="New review received",
            content=f"{current_user.first_name} {current_user.last_name} gave you a {new_review.rating}-star review for '{reservation.tool.title}'.",
            target_id=reservation_id,
            target_type="RESERVATION",
        )
        db.commit()
        db.refresh(new_review)
        return new_review
    except Exception as e:
        db.rollback()
        print(f"Failed to save review: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save review.",
        )


@router.get(
    "/{reservation_id}/reviews",
    response_model=list[ReviewDetailsResponse],
    status_code=status.HTTP_200_OK,
    responses={
        401: {"model": DetailError},
        403: {"model": DetailError},
        404: {"model": DetailError},
    },
)
def get_reservation_reviews(
    reservation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Retrieve all reviews (0 to 2) associated with a given reservation.
    """
    # Verify reservation exists
    reservation = db.query(Reservation).filter(Reservation.id == reservation_id).first()
    if not reservation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reservation record not found.",
        )

    # Fetch from the view filtered by reservation_id
    reviews = (
        db.query(ReviewView).filter(ReviewView.reservation_id == reservation_id).all()
    )

    # Return a list of reviews
    return [review for review in reviews]


@router.get(
    "/{reservation_id}/messages",
    response_model=list[MessageResponse],
    status_code=status.HTTP_200_OK,
    responses={
        401: {"model": DetailError},
        403: {"model": DetailError},
        404: {"model": DetailError},
    },
)
def get_messages(
    reservation_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrive the entire chat history between the owner and borrower for a reservation.
    """
    # Fetch the reservation
    reservation = db.query(Reservation).filter(Reservation.id == reservation_id).first()
    if not reservation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reservation not found.",
        )

    # Only the owner and borrower can view messages
    if current_user.id not in (
        reservation.borrower_id,
        reservation.tool.owner_id,
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to view messages for this reservation.",
        )

    # Fetch all messages in the reservation in ascending order
    messages = (
        db.query(Message)
        .filter(Message.reservation_id == reservation_id)
        .order_by(Message.created_at.asc())
        .all()
    )

    # Get incoming messages sent by the other party as read
    unread_incoming = [
        msg for msg in messages if not msg.is_read and msg.sender_id != current_user.id
    ]
    # Mark incoming messages as read
    if unread_incoming:
        for msg in unread_incoming:
            msg.is_read = True
        try:
            db.commit()
        except Exception as e:
            db.rollback()
            print(f"Failed to mark messages as read: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to mark messages as read.",
            )

    return messages


@router.post(
    "/{reservation_id}/messages",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        400: {"model": DetailError},
        401: {"model": DetailError},
        403: {"model": DetailError},
        404: {"model": DetailError},
    },
)
def create_message(
    reservation_id: uuid.UUID,
    message_data: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Append a new message to a reservation message thread.
    """
    # Fetch the reservation
    reservation = db.query(Reservation).filter(Reservation.id == reservation_id).first()
    if not reservation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reservation not found.",
        )

    # Only the owner and borrower can send messages
    if current_user.id not in (
        reservation.borrower_id,
        reservation.tool.owner_id,
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to send messages for this reservation.",
        )

    # The messaging allows only for requested, approved, picked up, and returned* reservation.
    # Or until the reservation ends datetime + 24 hours for returned reservations
    if (
        reservation.status
        not in (
            ReservationStatus.REQUESTED,
            ReservationStatus.APPROVED,
            ReservationStatus.PICKED_UP,
            ReservationStatus.RETURNED,
        )
    ) or (
        reservation.status == ReservationStatus.RETURNED
        and reservation.end_date + timedelta(days=1) < datetime.now(timezone.utc)
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot send messages for finished reservations.",
        )

    new_message = Message(
        reservation_id=reservation_id,
        sender_id=current_user.id,
        content=message_data.content,
        is_read=False,
    )

    db.add(new_message)
    try:
        db.commit()
        db.refresh(new_message)
    except Exception as e:
        db.rollback()
        print(f"Failed to save message: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save message.",
        )

    return new_message
