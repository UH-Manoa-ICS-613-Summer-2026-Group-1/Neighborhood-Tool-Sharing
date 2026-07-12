"""
Tool routers.
Handles creating, viewing, and updating tools.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import case
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.photo import Photo, ToolPhoto
from app.models.tool import Tool, ToolCondition, ToolStatus, ToolType, ToolView
from app.models.user import User
from app.schemas.common import DetailError
from app.schemas.tool import (
    ToolDetailsResponse,
    ToolRequest,
    ToolResponse,
    ToolTypeResponse,
)
from app.utils.dependencies import get_current_user

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

    try:
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
        query = query.filter(ToolView.tool_status == ToolStatus.AVAILABLE)

    # Filter view by optional category type
    if tool_type:
        query = query.filter(ToolView.tool_type_code == tool_type.upper())

    # Filter view by optional tool condition
    if tool_condition:
        query = query.filter(ToolView.tool_condition == tool_condition.upper())

    # Filter view by optional search by keywords in title or description (case-insensitive)
    if search:
        search_pattern = f"%{search}%"
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
