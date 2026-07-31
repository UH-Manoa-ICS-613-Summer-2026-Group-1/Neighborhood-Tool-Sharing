"""
Admin routers.
Handles user and tool suspension and activation. Generation basic reports.
"""

import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.admin_statistics import AdminOverviewStatistics
from app.models.invitation import InvitationHistory, InvitationStatus
from app.models.notification import NotificationCategory
from app.models.reservation import Reservation, ReservationStatus, ReservationView
from app.models.tool import Tool, ToolStatus, ToolView
from app.models.user import User, UserProfileView, UserStatus
from app.schemas.admin_statistics import (
    AdminOverviewStatisticsResponse,
    AdminTimeframeStatisticsResponse,
)
from app.schemas.common import DetailError, MessageResponse
from app.schemas.invitation import InvitationDetailsResponse
from app.schemas.reservation import (
    APP_TIMEZONE,
    APP_TIMEZONE_NAME,
    ReservationDetailsResponse,
)
from app.schemas.tool import ToolDetailsResponse
from app.schemas.user import CurrentUserProfileResponse
from app.utils.dependencies import get_admin_user
from app.utils.notification_helpers import create_notification

router = APIRouter(prefix="/api/admin", tags=["Admin"])


def cancel_reservations_for_suspended_tool(tool: Tool, db: Session):
    """
    Cancel active reservations when the tool is suspended.
    """

    # Cancel REQUESTED and APPROVED
    requested_and_approved_reservations = (
        db.query(Reservation)
        .filter(
            Reservation.tool_id == tool.id,
            Reservation.status.in_(
                [ReservationStatus.REQUESTED, ReservationStatus.APPROVED]
            ),
        )
        .all()
    )

    for reservation in requested_and_approved_reservations:
        reservation.status = ReservationStatus.CANCELED
        db.flush()

        # Notify borrower that their reservation was cancelled due to suspension
        create_notification(
            db=db,
            recipient_id=reservation.borrower_id,
            category=NotificationCategory.RESERVATION,
            title="Reservation cancelled",
            content=f"Your reservation for '{tool.title}' was cancelled because the listing was suspended by an administrator.",
            target_id=reservation.id,
            target_type="RESERVATION",
        )

    # Handle picked up reservations
    picked_up_reservations = (
        db.query(Reservation)
        .filter(
            Reservation.tool_id == tool.id,
            Reservation.status == ReservationStatus.PICKED_UP,
        )
        .all()
    )

    for reservation in picked_up_reservations:
        create_notification(
            db=db,
            recipient_id=reservation.borrower_id,
            category=NotificationCategory.RESERVATION,
            title="Reservation notice",
            content=f"The tool '{tool.title}' was suspended by an administrator. Please return the tool as agreed upon completion.",
            target_id=reservation.id,
            target_type="RESERVATION",
        )


def cancel_reservations_for_suspended_user(user: User, db: Session):
    """
    Cancel active reservations when the user is suspended.
    Notify related users that their reservation was cancelled.
    For picked up reservations, the tool owner is notified that the other party is suspended.
    """

    # Cancel REQUESTED and APPROVED reservations
    requested_and_approved_reservations = (
        db.query(Reservation)
        .join(Tool, Reservation.tool_id == Tool.id)
        .filter(
            or_(
                Reservation.borrower_id == user.id,
                Tool.owner_id == user.id,
            ),
            Reservation.status.in_(
                [ReservationStatus.REQUESTED, ReservationStatus.APPROVED]
            ),
        )
        .all()
    )

    for reservation in requested_and_approved_reservations:
        reservation.status = ReservationStatus.CANCELED
        db.flush()

        # Send notification based on who was suspended
        if reservation.borrower_id == user.id:
            # User was borrower, notify the tool owner
            recipient_id = reservation.tool.owner_id
            content = f"The reservation for your tool '{reservation.tool.title}' was cancelled because the borrower's account was suspended."
        else:
            # User was owner, notify the borrower
            recipient_id = reservation.borrower_id
            content = f"Your reservation for '{reservation.tool.title}' was cancelled because the tool owner's account was suspended."

        create_notification(
            db=db,
            recipient_id=recipient_id,
            category=NotificationCategory.RESERVATION,
            title="Reservation cancelled",
            content=content,
            target_id=reservation.id,
            target_type="RESERVATION",
        )

    picked_up_reservations = (
        db.query(Reservation)
        .join(Tool, Reservation.tool_id == Tool.id)
        .filter(
            or_(
                Reservation.borrower_id == user.id,
                Tool.owner_id == user.id,
            ),
            Reservation.status == ReservationStatus.PICKED_UP,
        )
        .all()
    )

    # Handle picked up reservations
    for reservation in picked_up_reservations:
        if reservation.borrower_id == user.id:
            # Borrower was suspended, Inform owner
            recipient_id = reservation.tool.owner_id
            content = f"The borrower for '{reservation.tool.title}' has been suspended. Please contact the support team if you experience any issues with the tool return."
        else:
            # Owner was suspended, inform borrower
            recipient_id = reservation.borrower_id
            content = f"The owner of '{reservation.tool.title}' has been suspended. Please return the tool as agreed upon completion."

        create_notification(
            db=db,
            recipient_id=recipient_id,
            category=NotificationCategory.RESERVATION,
            title="Reservation notice",
            content=content,
            target_id=reservation.id,
            target_type="RESERVATION",
        )


@router.post(
    "/tools/{id}/suspend",
    status_code=status.HTTP_200_OK,
    response_model=MessageResponse,
    responses={
        401: {"model": DetailError},
        403: {"model": DetailError},
        404: {"model": DetailError},
        400: {"model": DetailError},
    },
)
def suspend_tool(
    id: uuid.UUID,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    """
    Admin suspend a tool listing.
    """
    tool = db.query(Tool).filter(Tool.id == id).first()

    # Tool listing does not exist
    if not tool:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tool listing not found.",
        )

    # Tool listing already suspended
    if tool.status == ToolStatus.SUSPENDED or tool.status == ToolStatus.DELETED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tool listing is already suspended or deleted.",
        )

    # Suspend the tool
    tool.status = ToolStatus.SUSPENDED
    try:
        db.flush()
        # Add notification for tool owner
        create_notification(
            db=db,
            recipient_id=tool.owner_id,
            category=NotificationCategory.SYSTEM,
            title="Tool suspended",
            content=f"Your tool '{tool.title}' has been suspended.",
            target_id=tool.id,
            target_type="TOOL",
        )
        # Cancel active reservations for the tool and notify the borrowers
        cancel_reservations_for_suspended_tool(tool=tool, db=db)
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Failed to suspend a tool. Error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to suspend a tool. Error: {str(e)}",
        )

    return {"message": f"Tool '{tool.title}' has been successfully suspended."}


@router.post(
    "/tools/{id}/activate",
    status_code=status.HTTP_200_OK,
    response_model=MessageResponse,
    responses={
        401: {"model": DetailError},
        403: {"model": DetailError},
        404: {"model": DetailError},
        400: {"model": DetailError},
    },
)
def activate_tool(
    id: uuid.UUID,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    """
    Admin activate a suspended tool. Sets status to HIDDEN so the owner
    must manually unhide it.
    """
    tool = db.query(Tool).filter(Tool.id == id).first()

    # Tool listing does not exist
    if not tool:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tool listing not found.",
        )

    # Tool listing is not suspended
    if tool.status != ToolStatus.SUSPENDED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot activate tool that is in '{tool.status.value}' status. Tool must be SUSPENDED.",
        )

    # Prevent admins from activating suspended user tool
    suspended_user_status = (
        db.query(UserStatus).filter(UserStatus.code == "SUSPENDED").first()
    )
    if tool.owner.status == suspended_user_status:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot activate a tool that is owned by a suspended user.",
        )
    # Activate the tool (set status to HIDDEN)
    tool.status = ToolStatus.HIDDEN
    try:
        db.flush()
        # Add notification for tool owner
        create_notification(
            db=db,
            recipient_id=tool.owner_id,
            category=NotificationCategory.SYSTEM,
            title="Tool activated",
            content=f"Your tool '{tool.title}' has been activated. Now the tool is hidden from public view and can be manually unhidden by the owner.",
            target_id=tool.id,
            target_type="TOOL",
        )
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Failed to activate a tool. Error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to activate a tool. Error: {str(e)}",
        )

    return {
        "message": f"Tool '{tool.title}' activated and set to HIDDEN. The owner must activate it manually."
    }


@router.post(
    "/users/{id}/suspend",
    status_code=status.HTTP_200_OK,
    response_model=MessageResponse,
    responses={
        401: {"model": DetailError},
        403: {"model": DetailError},
        404: {"model": DetailError},
        400: {"model": DetailError},
    },
)
def suspend_user(
    id: uuid.UUID,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    """
    Admin suspend a user account.
    All suspended user tools become hidden from public view (HIDDEN status).
    """
    user = db.query(User).filter(User.id == id).first()

    # User does not exist
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User account not found.",
        )

    # Prevent admins from suspending themselves
    if user.id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Administrators cannot suspend their own accounts -_-",
        )

    # User already suspended
    if user.status and user.status.code == "SUSPENDED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User account is already suspended.",
        )

    # Fetch the SUSPENDED status
    suspended_status = (
        db.query(UserStatus).filter(UserStatus.code == "SUSPENDED").first()
    )

    # Suspend the user
    if suspended_status is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to suspend a user. User status not found.",
        )
    user.status = suspended_status
    try:
        db.flush()
        # Add notification for suspended user
        create_notification(
            db=db,
            recipient_id=user.id,
            category=NotificationCategory.SYSTEM,
            title="Account suspended",
            content="Your account has been suspended. Please contact support.",
            target_id=user.id,
            target_type="USER",
        )
        # Cancel active reservations for the user and notify them
        cancel_reservations_for_suspended_user(user=user, db=db)

        # Hide all suspended user tools
        tools = db.query(Tool).filter(Tool.owner_id == user.id).all()
        for tool in tools:
            # Only hide available tools, in case the tool is suspended
            if tool.status == ToolStatus.AVAILABLE:
                tool.status = ToolStatus.HIDDEN
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Failed to suspend a user. Error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to suspend a user. Error: {str(e)}",
        )

    return {"message": f"User account '{user.email}' has been suspended."}


@router.post(
    "/users/{id}/activate",
    status_code=status.HTTP_200_OK,
    response_model=MessageResponse,
    responses={
        401: {"model": DetailError},
        403: {"model": DetailError},
        404: {"model": DetailError},
        400: {"model": DetailError},
    },
)
def activate_user(
    id: uuid.UUID,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    """
    Admin activate a suspended user account.
    """
    user = db.query(User).filter(User.id == id).first()

    # User does not exist
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User account not found.",
        )

    # Prevent admins from activating themselves
    if user.id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Administrators cannot activate their own accounts -_-",
        )

    # User already active
    if user.status and user.status.code == "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User account is already active.",
        )

    # Fetch the ACTIVE status ID from user_statuses table
    active_status = db.query(UserStatus).filter(UserStatus.code == "ACTIVE").first()

    # Activate the user account
    if active_status is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to activate a user. User status not found.",
        )
    user.status = active_status
    try:
        db.flush()
        # Add notification for reactivated user
        create_notification(
            db=db,
            recipient_id=user.id,
            category=NotificationCategory.SYSTEM,
            title="Account activated",
            content="Your account has been activated. Welcome back!",
            target_id=user.id,
            target_type="USER",
        )
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Failed to activate a user account. Error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to activate a user account. Error: {str(e)}",
        )
    return {"message": f"User account '{user.email}' has been activated."}


@router.get(
    "/statistics/overview",
    status_code=status.HTTP_200_OK,
    response_model=AdminOverviewStatisticsResponse,
    responses={
        401: {"model": DetailError},
        403: {"model": DetailError},
    },
)
def get_statistics_overview(
    db: Session = Depends(get_db), admin: User = Depends(get_admin_user)
):
    """
    Admin views statistics overview.
    """
    overview_statistics = db.query(AdminOverviewStatistics).first()
    return overview_statistics


@router.get(
    "/statistics/timeseries",
    status_code=status.HTTP_200_OK,
    response_model=AdminTimeframeStatisticsResponse,
    responses={
        401: {"model": DetailError},
        403: {"model": DetailError},
    },
)
def get_statistics_timeseries(
    timeframe: int = Query(
        default=30,
        description="Timeframe in days",
        ge=1,
        le=365,
    ),
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    """
    Admin views statistics timeseries metrics filtered by timeframe in days.
    """
    local_today_midnight = datetime.now(APP_TIMEZONE).replace(
        hour=0, minute=0, second=0
    )
    start_date = local_today_midnight - timedelta(days=timeframe - 1)

    # New users grouped by day
    users_per_day_query = (
        db.query(
            func.date(func.timezone(APP_TIMEZONE_NAME, User.created_at)).label("date"),
            func.count(User.id).label("total"),
        )
        .filter(User.created_at >= start_date)
        .group_by(func.date(func.timezone(APP_TIMEZONE_NAME, User.created_at)))
        .order_by("date")
        .all()
    )

    # Tools grouped by day
    tools_per_day_query = (
        db.query(
            func.date(func.timezone(APP_TIMEZONE_NAME, Tool.created_at)).label("date"),
            func.count(Tool.id).label("total"),
        )
        .filter(Tool.created_at >= start_date)
        .group_by(func.date(func.timezone(APP_TIMEZONE_NAME, Tool.created_at)))
        .order_by("date")
        .all()
    )

    # Reservations grouped by day
    res_per_day_query = (
        db.query(
            func.date(func.timezone(APP_TIMEZONE_NAME, Reservation.created_at)).label(
                "date"
            ),
            func.count(Reservation.id).label("total"),
        )
        .filter(Reservation.created_at >= start_date)
        .group_by(func.date(func.timezone(APP_TIMEZONE_NAME, Reservation.created_at)))
        .order_by("date")
        .all()
    )

    # All-time totals
    all_time_users = db.query(func.count(User.id)).scalar() or 0
    all_time_tools = db.query(func.count(Tool.id)).scalar() or 0
    all_time_reservations = db.query(func.count(Reservation.id)).scalar() or 0

    # Calculate timeframe totals from queries
    timeframe_new_users = sum(row.total for row in users_per_day_query)
    timeframe_new_tools = sum(row.total for row in tools_per_day_query)
    timeframe_new_reservations = sum(row.total for row in res_per_day_query)

    return {
        "all_time_users": all_time_users,
        "all_time_tools": all_time_tools,
        "all_time_reservations": all_time_reservations,
        "timeframe_new_users": timeframe_new_users,
        "timeframe_new_tools": timeframe_new_tools,
        "timeframe_new_reservations": timeframe_new_reservations,
        "new_users_per_day": [
            {"date": str(row.date), "count": row.total} for row in users_per_day_query
        ],
        "new_tools_per_day": [
            {"date": str(row.date), "count": row.total} for row in tools_per_day_query
        ],
        "reservations_per_day": [
            {"date": str(row.date), "count": row.total} for row in res_per_day_query
        ],
    }


@router.get(
    "/invitations",
    status_code=status.HTTP_200_OK,
    response_model=list[InvitationDetailsResponse],
    responses={
        401: {"model": DetailError},
        403: {"model": DetailError},
        404: {"model": DetailError},
        400: {"model": DetailError},
    },
)
def get_invitations(
    email: str | None = Query(
        default=None,
        description="Email to filter by",
    ),
    status_filter: str | None = Query(
        default=None,
        alias="status",
        description="'None' to get all invitations; or filter by invitation status (e.g., 'PENDING',"
        " 'USED', 'EXPIRED', 'REVOKED')",
    ),
    limit: int = Query(default=10, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    """
    Retrive all invitations.
    """
    query = db.query(InvitationHistory)

    if email:
        query = query.filter(
            InvitationHistory.recipient_email.ilike(f"%{email.strip()}%")
        )

    # Apply optional status filtering
    if status_filter:
        if status_filter.upper() in InvitationStatus:
            query = query.filter(InvitationHistory.status == status_filter.upper())
        else:
            # If status_filter is not a valid status, raise an error
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status parameter: {status_filter.upper() if status_filter else 'None'}."
                " Choose from 'PENDING', 'USED', 'EXPIRED', 'REVOKED' or ommit it.",
            )

    # Sort by creation date
    results = (
        query.order_by(InvitationHistory.created_at.desc())
        .limit(limit)
        .offset(offset)
        .all()
    )

    return results


@router.get(
    "/reservations",
    status_code=status.HTTP_200_OK,
    response_model=list[ReservationDetailsResponse],
    responses={
        401: {"model": DetailError},
        403: {"model": DetailError},
        404: {"model": DetailError},
        400: {"model": DetailError},
    },
)
def get_reservations(
    user_id: uuid.UUID | None = Query(
        default=None,
        description="User ID to filter by",
    ),
    status_filter: str | None = Query(
        default=None,
        alias="status",
        description="'None' to get all reservations; or filter by reservation status (e.g., 'REQUESTED',"
        " 'APPROVED', 'DENIED', 'PICKED_UP', 'RETURNED', 'CANCELED')",
    ),
    limit: int = Query(default=10, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    """
    Retrive all reservations.
    """
    query = db.query(ReservationView)

    if user_id:
        user_exists = db.query(User).filter(User.id == user_id).first() is not None
        if not user_exists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found.",
            )
        query = query.filter(
            or_(
                ReservationView.owner_id == user_id,
                ReservationView.borrower_id == user_id,
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
    "/tools",
    status_code=status.HTTP_200_OK,
    response_model=list[ToolDetailsResponse],
    responses={
        401: {"model": DetailError},
        403: {"model": DetailError},
        404: {"model": DetailError},
        400: {"model": DetailError},
    },
)
def get_tools(
    user_id: uuid.UUID | None = Query(
        default=None,
        description="User ID to filter by",
    ),
    tool_id: uuid.UUID | None = Query(
        default=None,
        description="Tool ID to filter by",
    ),
    status_filter: str | None = Query(
        default=None,
        alias="status",
        description="'None' to get all tools; or filter by tool status (e.g., 'AVAILABLE',"
        " 'SUSPENDED', 'HIDDEN')",
    ),
    tool_type: str | None = Query(
        default=None, description="Filter by tool type code (e.g. 'POWER_TOOLS')"
    ),
    tool_condition: str | None = Query(
        default=None, description="Filter by tool condition"
    ),
    search: str | None = Query(
        default=None, description="Keywords to search in title or description"
    ),
    limit: int = Query(default=10, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """
    Retrieve all tools.
    """
    # There is no DELETED tools in the view since we fileter it out in view creation

    # Initialize query context pointed at tool_v
    query = db.query(ToolView)

    if user_id:
        user_exists = db.query(User).filter(User.id == user_id).first() is not None
        if not user_exists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found.",
            )
        query = query.filter(ToolView.owner_id == user_id)

    if tool_id:
        tool_exists = db.query(Tool).filter(Tool.id == tool_id).first() is not None
        if not tool_exists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Tool not found.",
            )
        query = query.filter(ToolView.tool_id == tool_id)

    # Apply optional status filtering
    if status_filter:
        if status_filter.upper() in ToolStatus:
            query = query.filter(ToolView.tool_status == status_filter.upper())
        else:
            # If status_filter is not a valid status, raise an error
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status parameter: {status_filter.upper() if status_filter else 'None'}."
                " Choose 'AVAILABLE', 'SUSPENDED', 'HIDDEN', or omit it.",
            )
    # Filter view by optional category type
    if tool_type:
        query = query.filter(ToolView.tool_type_code == tool_type.upper())

    # Filter view by optional tool condition
    if tool_condition:
        query = query.filter(ToolView.tool_condition == tool_condition.upper())

    # Filter view by optional search by keywords in title or description (case-insensitive)
    if search:
        search_pattern = f"%{search.strip()}%"
        query = query.filter(
            (ToolView.tool_title.ilike(search_pattern))
            | (ToolView.tool_description.ilike(search_pattern))
        )

    results = (
        query.order_by(ToolView.tool_created_at.desc())
        .limit(limit)
        .offset(offset)
        .all()
    )

    return results


@router.get(
    "/users",
    status_code=status.HTTP_200_OK,
    response_model=list[CurrentUserProfileResponse],
    responses={
        401: {"model": DetailError},
        403: {"model": DetailError},
        404: {"model": DetailError},
        400: {"model": DetailError},
    },
)
def get_user_profiles(
    user_id: uuid.UUID | None = Query(
        default=None,
        description="User ID to filter by",
    ),
    status_filter: str | None = Query(
        default=None,
        alias="status",
        description="'None' to get all users; or filter by user status (e.g., 'ACTIVE',"
        " 'SUSPENDED')",
    ),
    limit: int = Query(default=10, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """
    Retrieve all user profiles.
    """
    query = db.query(UserProfileView)

    if user_id:
        user_exists = db.query(User).filter(User.id == user_id).first() is not None
        if not user_exists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found.",
            )
        query = query.filter(UserProfileView.user_id == user_id)

    # Apply optional status filtering
    if status_filter:
        status_exists = (
            db.query(UserStatus)
            .filter(UserStatus.code == status_filter.upper())
            .first()
        ) is not None
        if status_exists:
            query = query.filter(UserProfileView.status_code == status_filter.upper())
        else:
            # If status_filter is not a valid status, raise an error
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status parameter: {status_filter.upper() if status_filter else 'None'}."
                " Choose 'ACTIVE', 'SUSPENDED', or omit it.",
            )

    results = (
        query.order_by(UserProfileView.user_created_at.desc())
        .limit(limit)
        .offset(offset)
        .all()
    )

    return results
