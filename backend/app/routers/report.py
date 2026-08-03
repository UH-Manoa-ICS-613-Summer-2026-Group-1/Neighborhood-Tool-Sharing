"""
Report routers.
Handles creating reports for tools, reservations, and users.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.notification import NotificationCategory
from app.models.report import Report, ReportCategory, ReportTargetType
from app.models.reservation import Reservation
from app.models.tool import Tool
from app.models.user import User
from app.schemas.common import DetailError
from app.schemas.report import ReportCreateRequest, ReportResponse
from app.utils.dependencies import get_current_user
from app.utils.notification_helpers import create_notification

router = APIRouter(prefix="/api/reports", tags=["Reports"])


@router.get(
    "/target-types",
    response_model=list[str],
    status_code=status.HTTP_200_OK,
    responses={401: {"model": DetailError}, 403: {"model": DetailError}},
)
def get_report_target_types(
    current_user: User = Depends(get_current_user),
):
    """
    Retrieve a list of possible report target types.
    """

    return [target_type.value for target_type in ReportTargetType]


@router.get(
    "/categories",
    response_model=list[str],
    status_code=status.HTTP_200_OK,
    responses={401: {"model": DetailError}, 403: {"model": DetailError}},
)
def get_report_categories(
    current_user: User = Depends(get_current_user),
):
    """
    Retrieve a list of possible report categories.
    """
    return [category.value for category in ReportCategory]


@router.post(
    "",
    response_model=ReportResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        400: {"model": DetailError},
        401: {"model": DetailError},
        403: {"model": DetailError},
        404: {"model": DetailError},
    },
)
def create_report(
    report_data: ReportCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Submit a report about a reservation, tool, or user.
    """
    target_type = report_data.target_type
    target_id = report_data.target_id

    # Report a reservation
    if target_type == ReportTargetType.RESERVATION:
        # Fetch reservation and load associated tool to check owner_id
        reservation = (
            db.query(Reservation)
            .options(joinedload(Reservation.tool))
            .filter(Reservation.id == target_id)
            .first()
        )

        if not reservation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="The reservation not found.",
            )

        # Check if current user is borrower or tool owner
        is_borrower = reservation.borrower_id == current_user.id
        is_owner = reservation.tool.owner_id == current_user.id

        if not (is_borrower or is_owner):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only submit issue reports for reservations you are associated with.",
            )

    # Report a tool
    elif target_type == ReportTargetType.TOOL:
        tool = db.query(Tool).filter(Tool.id == target_id).first()
        if not tool:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="The tool not found.",
            )

    # Report a user
    elif target_type == ReportTargetType.USER:
        target_user = db.query(User).filter(User.id == target_id).first()
        if not target_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="The user not found.",
            )

        if target_user.id == current_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You cannot submit a report against yourself.",
            )

    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid target_type '{target_type}'. Allowed values: RESERVATION, TOOL, USER.",
        )

    # Create report
    new_report = Report(
        reporter_id=current_user.id,
        target_id=target_id,
        target_type=target_type,
        category=report_data.category,
        description=report_data.description,
    )

    db.add(new_report)

    try:
        # Create notification
        create_notification(
            db=db,
            recipient_id=current_user.id,
            category=NotificationCategory.REPORT,
            title="Report submitted",
            content=f"Your report has been submitted. Please wait for a response on your email address {current_user.email}.",
        )
        db.commit()
        db.refresh(new_report)
    except Exception as e:
        print(f"Failed creating report: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed creating report.",
        )

    return new_report
