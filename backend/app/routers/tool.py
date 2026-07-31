"""
Tool routers.
Handles creating, viewing, updating, and deleting tools. Also handles getting tool types, conditions, and availability.
"""

import uuid
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, case
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.photo import Photo, ToolPhoto
from app.models.reservation import Reservation, ReservationStatus
from app.models.tool import Tool, ToolCondition, ToolStatus, ToolType, ToolView
from app.models.user import User
from app.schemas.common import DetailError, MessageResponse
from app.schemas.reservation import APP_TIMEZONE
from app.schemas.tool import (
    ToolDetailsResponse,
    ToolRequest,
    ToolResponse,
    ToolTypeResponse,
    ToolUpdateRequest,
)
from app.utils.dependencies import get_current_user, validate_urls_ownership
from app.utils.storage import BUCKET_NAME, internal_s3

router = APIRouter(prefix="/api/tools", tags=["Tools"])


@router.get(
    "/conditions",
    status_code=status.HTTP_200_OK,
    response_model=list[str],
    responses={
        401: {"model": DetailError},
        403: {"model": DetailError},
    },
)
def get_tool_conditions(current_user: User = Depends(get_current_user)):
    """
    Retrive a list of tool conditions.
    """
    return [condition.value for condition in ToolCondition]


@router.get(
    "/types",
    status_code=status.HTTP_200_OK,
    response_model=list[ToolTypeResponse],
    responses={
        401: {"model": DetailError},
        403: {"model": DetailError},
    },
)
def get_tool_types(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """
    Retrive a list of tool types.
    """
    tool_types = db.query(ToolType).all()
    return tool_types


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    response_model=ToolResponse,
    responses={
        401: {"model": DetailError},
        403: {"model": DetailError},
        400: {"model": DetailError},
    },
)
def create_tool(
    tool_data: ToolRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Create a tool.
    """
    # Verify the tool_type_id actually exists in the database
    # Frontend has the ability to see all tool types with IDs (GET api/toos/types)
    tool_type_exists = (
        db.query(ToolType).filter(ToolType.code == tool_data.tool_type_code).first()
    )

    if not tool_type_exists:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid tool_type_code: {tool_data.tool_type_code}. Category not found.",
        )

    # Tool cannot be added without at least one photo
    if not tool_data.photo_urls or len(tool_data.photo_urls) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A tool listing requires at least one uploaded photo.",
        )

    # Handle optional fields: pickup_notes, return_notes
    pickup_notes = None
    if tool_data.pickup_notes is not None:
        pickup_notes = tool_data.pickup_notes if tool_data.pickup_notes != "" else None
    return_notes = None
    if tool_data.return_notes is not None:
        return_notes = tool_data.return_notes if tool_data.return_notes != "" else None

    new_tool = Tool(
        tool_type_id=tool_type_exists.id,
        title=tool_data.title,
        description=tool_data.description,
        condition=tool_data.condition,
        pickup_notes=pickup_notes,
        return_notes=return_notes,
        loan_duration_limit=tool_data.loan_duration_limit,
        owner_id=current_user.id,
    )

    # Check that the currecnt user does not use someone else's photo from storage
    validate_urls_ownership(current_user, tool_data.photo_urls)

    # Add new tool to database
    db.add(new_tool)
    db.flush()  # Generates new_tool.id within the open transaction

    # Iterate through provided URL records and create photo entities
    for url in tool_data.photo_urls:
        db_photo = Photo(url=url)
        db.add(db_photo)  # Add to database
        db.flush()  # Generates db_photo.id

        # Form relationship link row in intersection table
        db_link = ToolPhoto(tool_id=new_tool.id, photo_id=db_photo.id)
        db.add(db_link)
    try:
        # Commit
        db.commit()
        # Fetch new tool with photos
        new_tool_with_photos = (
            db.query(Tool)
            .options(joinedload(Tool.photos))
            .filter(Tool.id == new_tool.id)
            .first()
        )

        return new_tool_with_photos

    # Rollback if any part of the transaction fails
    except Exception as e:
        db.rollback()

        print(f"Database write failure during tool creation pipeline: {str(e)}")

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save tool listing and associated assets.",
        )


@router.get(
    "",
    status_code=status.HTTP_200_OK,
    response_model=list[ToolDetailsResponse],
    responses={401: {"model": DetailError}, 403: {"model": DetailError}},
)
def list_tools(
    is_mine: bool = Query(
        default=True,
        description="True for the user's listings; False for all users listings.",
    ),
    limit: int = Query(default=10, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    tool_type: str | None = Query(
        default=None, description="Filter by tool type code (e.g. 'POWER_TOOLS')"
    ),
    tool_condition: str | None = Query(
        default=None, description="Filter by tool condition"
    ),
    search: str | None = Query(
        default=None, description="Keywords to search in title or description"
    ),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Retrieve a filtered list of tools.
    """
    # There is no DELETED tools in the view since we fileter it out in view creation

    # Initialize query context pointed at tool_v
    query = db.query(ToolView)

    # Filter view by current user if 'is_mine' is True
    if is_mine:
        query = query.filter(ToolView.owner_id == current_user.id)
    else:
        # Public browsing only reveals available tools (no hidden or suspened)
        # And not includes tools owned by the current user
        query = query.filter(
            and_(
                ToolView.tool_status == ToolStatus.AVAILABLE,
                ToolView.owner_id != current_user.id,
            )
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

    # Status priority
    status_priority = case(
        (ToolView.tool_status == ToolStatus.AVAILABLE, 1),
        (ToolView.tool_status == ToolStatus.HIDDEN, 2),
        (ToolView.tool_status == ToolStatus.SUSPENDED, 3),
        else_=4,
    )

    # Apply order by status priority index first, then show the newest listings within each priority group
    results = (
        query.order_by(status_priority.asc(), ToolView.tool_created_at.desc())
        .limit(limit)
        .offset(offset)
        .all()
    )

    return results


@router.get(
    "/{tool_id}",
    response_model=ToolDetailsResponse,
    responses={401: {"model": DetailError}, 403: {"model": DetailError}},
)
def get_tool_by_id(
    tool_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Retrieve full details for a specific tool by its unique identifier.
    """
    # There is no DELETED tools in the view since we fileter it out in view creation

    # Query tools_v by tool_id
    tool = db.query(ToolView).filter(ToolView.tool_id == tool_id).first()

    # Check if the tool exists
    if not tool:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tool listing not found or is currently unavailable.",
        )

    # Check if the tool is owned by the current user
    is_owner = bool(tool.owner_id == current_user.id)

    # Check if the tool is available
    is_available = bool(tool.tool_status == ToolStatus.AVAILABLE)

    # The current user cannot view a tool that is not owned by them and not available (hidden or suspended)
    if not is_owner and not is_available:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tool listing not found or is currently unavailable.",
        )

    return tool


@router.get(
    "/{tool_id}/availability",
    status_code=status.HTTP_200_OK,
    response_model=list[
        str
    ],  # Returns a list like ["2026-07-14", "2026-07-15"] ('YYYY-MM-DD')
    responses={
        401: {"model": DetailError},
        403: {"model": DetailError},
        404: {"model": DetailError},
    },
)
def get_tool_availability(
    tool_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Retrive a list of "APPROVED" or "PICKED_UP" dates to block out on the frontend calendar UI.
    Format ('YYYY-MM-DD').
    """
    # Verify the tool exists
    tool_exists = db.query(Tool).filter(Tool.id == tool_id).first()
    if not tool_exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tool not found.",
        )

    # Grab the APPROVED adn PICKED_UP reservations for the tool
    active_reservations = (
        db.query(Reservation)
        .filter(
            and_(
                Reservation.tool_id == tool_id,
                Reservation.status.in_(
                    [
                        ReservationStatus.APPROVED,
                        ReservationStatus.PICKED_UP,
                    ]
                ),
            )
        )
        .all()
    )

    # Transforms datetime blocks into an array of individual 'YYYY-MM-DD' strings.
    # This tells the frontend calendar exactly which grid boxes to disable. All dates are in the local timezone.
    blocked_dates = set()
    for reservation in active_reservations:
        # Convert UTC back to the app's regional local time matrix
        local_start = reservation.start_date.astimezone(APP_TIMEZONE).date()
        local_end = reservation.end_date.astimezone(APP_TIMEZONE).date()

        # Loop through every day from start to end inclusive and append it
        current_day = local_start
        while current_day <= local_end:
            blocked_dates.add(current_day.isoformat())
            current_day += timedelta(days=1)

    return sorted(list(blocked_dates))


@router.delete(
    "/{tool_id}",
    status_code=status.HTTP_200_OK,
    response_model=MessageResponse,
    responses={
        401: {"model": DetailError},
        403: {"model": DetailError},
        404: {"model": DetailError},
        400: {"model": DetailError},
    },
)
def delete_tool(
    tool_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Delete a tool (soft deleting).
    """
    # Fetch the tool entity
    tool = db.query(Tool).filter(Tool.id == tool_id).first()

    # If it doesn't exist or is already marked as deleted, return a 404
    if not tool or tool.status == ToolStatus.DELETED:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tool listing not found or has already been deleted.",
        )

    # Verify ownership
    if tool.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have administrative permission to delete this tool listing.",
        )

    # Check for active reservations before allowing a soft delete
    active_reservation = (
        db.query(Reservation)
        .filter(
            and_(
                Reservation.tool_id == tool_id,
                Reservation.status.in_(
                    [ReservationStatus.APPROVED, ReservationStatus.PICKED_UP]
                ),
            )
        )
        .first()
    )

    if active_reservation:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete this tool. The tool currently has an active approved or picked up reservation.",
        )

    try:
        # Perform the soft delete
        tool.status = ToolStatus.DELETED
        db.commit()

        return {"message": "Tool listing was successfully removed from the platform."}

    except Exception as e:
        db.rollback()
        print(f"Database write failure during tool DELETE pipeline: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete the tool listing due to an internal server error.",
        )


@router.post(
    "/{tool_id}/hide",
    status_code=status.HTTP_200_OK,
    response_model=ToolResponse,
    responses={
        400: {"model": DetailError},
        401: {"model": DetailError},
        403: {"model": DetailError},
        404: {"model": DetailError},
    },
)
def hide_tool(
    tool_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Hide the tool from the public view.
    The tool cannot be reserved by other users.
    However, active reservations related to the tool can still be processed.
    """
    # Fetch the tool entity (excluding deleted listings)
    tool = (
        db.query(Tool)
        .filter(and_(Tool.id == tool_id, Tool.status != ToolStatus.DELETED))
        .first()
    )
    if not tool:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tool listing not found or has been deleted.",
        )

    # Only the owner can unhide the tool
    if tool.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have administrative permission to hide this tool listing.",
        )

    # Hiding if already hidden
    if tool.status == ToolStatus.HIDDEN:
        return tool

    # Hide the tool
    tool.status = ToolStatus.HIDDEN
    db.commit()
    db.refresh(tool)
    return tool


@router.post(
    "/{tool_id}/unhide",
    status_code=status.HTTP_200_OK,
    response_model=ToolResponse,
    responses={
        400: {"model": DetailError},
        401: {"model": DetailError},
        403: {"model": DetailError},
        404: {"model": DetailError},
    },
)
def unhide_tool(
    tool_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """ "
    Unhide the tool. The tool can be visivle in public view and reserved by other users.
    """
    # Fetch the tool entity (excluding deleted listings)
    tool = (
        db.query(Tool)
        .filter(and_(Tool.id == tool_id, Tool.status != ToolStatus.DELETED))
        .first()
    )
    if not tool:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tool listing not found or has been deleted.",
        )

    # Only the owner can unhide the tool
    if tool.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have administrative permission to unhide this tool listing.",
        )

    # Unhiding if already unhidden
    if tool.status == ToolStatus.AVAILABLE:
        return tool

    # Hide the tool
    tool.status = ToolStatus.AVAILABLE
    db.commit()
    db.refresh(tool)
    return tool


@router.patch(
    "/{tool_id}",
    status_code=status.HTTP_200_OK,
    response_model=ToolResponse,
    responses={
        400: {"model": DetailError},
        401: {"model": DetailError},
        403: {"model": DetailError},
        404: {"model": DetailError},
    },
)
def patch_tool(
    tool_id: uuid.UUID,
    tool_data: ToolUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Update a tool.
    """
    # Fetch the tool entity (excluding deleted listings)
    tool = (
        db.query(Tool)
        .filter(and_(Tool.id == tool_id, Tool.status != ToolStatus.DELETED))
        .first()
    )
    if not tool:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tool listing not found or has been deleted.",
        )

    # Only the owner can modify this tool
    if tool.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have administrative permission to modify this tool listing.",
        )

    # Check if the tool has active reservations
    active_reservation = (
        db.query(Reservation)
        .filter(
            and_(
                Reservation.tool_id == tool_id,
                Reservation.status.in_(
                    [ReservationStatus.APPROVED, ReservationStatus.PICKED_UP]
                ),
            )
        )
        .first()
    )

    # If threre is an active reservation, and tool data consist of any of the restricted fields, deny the request
    if active_reservation:
        restricted_fields_attempted = [
            tool_data.tool_type_code,
            tool_data.title,
            tool_data.description,
            tool_data.condition,
        ]
        if any(field is not None for field in restricted_fields_attempted):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This tool is currently linked to an active reservation. "
                "You can only modify the loan duration limit, pickup notes, return notes, and photos.",
            )

    # If there is no active reservation, update the tool
    if not active_reservation:
        if tool_data.tool_type_code is not None:
            tool_type_exists = (
                db.query(ToolType)
                .filter(ToolType.code == tool_data.tool_type_code)
                .first()
            )
            if not tool_type_exists:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid tool_type_code: {tool_data.tool_type_code}. Category not found.",
                )
            tool.tool_type_id = tool_type_exists.id

        if tool_data.title is not None:
            tool.title = tool_data.title
        if tool_data.description is not None:
            tool.description = tool_data.description
        if tool_data.condition is not None:
            tool.condition = tool_data.condition

    #  Update the fields that are always can be updated (regardless of reservation state)

    # Prepare a list of URLs to delete
    urls_to_delete_from_storage = []

    # Handle updating photos if provided
    if tool_data.photo_urls is not None:
        if len(tool_data.photo_urls) == 0:
            raise HTTPException(
                status_code=400,
                detail="A tool listing requires at least one photo.",
            )

        # Check that the currecnt user does not use someone else's photo from storage
        validate_urls_ownership(current_user, tool_data.photo_urls)

        # Fetch old photos
        old_photos = (
            db.query(Photo)
            .join(ToolPhoto, ToolPhoto.photo_id == Photo.id)
            .filter(ToolPhoto.tool_id == tool.id)
            .all()
        )

        # Identify items to delete from storage
        urls_to_delete_from_storage = [
            photo.url for photo in old_photos if photo.url not in tool_data.photo_urls
        ]

        # Wipe old links to photos
        db.query(ToolPhoto).filter(ToolPhoto.tool_id == tool.id).delete()

        # Delete the orphan records from the photos table
        if old_photos:
            old_photo_ids = [photo.id for photo in old_photos]
            db.query(Photo).filter(Photo.id.in_(old_photo_ids)).delete(
                synchronize_session=False
            )

        # Build new photo mappings
        for url in tool_data.photo_urls:
            db_photo = Photo(url=url)
            db.add(db_photo)
            db.flush()
            db.add(ToolPhoto(tool_id=tool.id, photo_id=db_photo.id))

    if tool_data.loan_duration_limit is not None:
        tool.loan_duration_limit = tool_data.loan_duration_limit

    if tool_data.pickup_notes is not None:
        tool.pickup_notes = (
            tool_data.pickup_notes if tool_data.pickup_notes != "" else None
        )

    if tool_data.return_notes is not None:
        tool.return_notes = (
            tool_data.return_notes if tool_data.return_notes != "" else None
        )

    try:
        db.commit()

        # Delete the orphan records from storage
        if urls_to_delete_from_storage:
            for url in urls_to_delete_from_storage:
                try:
                    # check if the required BUCKET_NAME variable is undefined or blank
                    if BUCKET_NAME is None or BUCKET_NAME.strip() == "":
                        raise RuntimeError(
                            f"Missing required environment variable {BUCKET_NAME}"
                        )

                    # Get the object name
                    object_name = f"{current_user.id}/{url.split('/')[-1]}"

                    # Remove the object
                    internal_s3.delete_object(Bucket=BUCKET_NAME, Key=object_name)
                    print(
                        f"Successfully deleted orphan asset {object_name} from storage."
                    )
                except Exception as e:
                    print(f"Failed to remove asset {url} from storage: {str(e)}")

        # Return the updated tool
        updated_tool_with_photos = (
            db.query(Tool)
            .options(joinedload(Tool.photos))
            .filter(Tool.id == tool.id)
            .first()
        )

        return updated_tool_with_photos

    except Exception as e:
        db.rollback()
        print(f"Database write failure during tool PATCH pipeline: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update tool listing details.",
        )
