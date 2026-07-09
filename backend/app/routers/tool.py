"""
Tool routers.
Handles creating, viewing, and updating tools.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.photo import Photo, ToolPhoto
from app.models.tool import Tool, ToolCondition, ToolType
from app.models.user import User
from app.schemas.common import DetailError
from app.schemas.tool import ToolRequest, ToolResponse, ToolTypeResponse
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
        db.query(ToolType.id).filter(ToolType.id == tool_data.tool_type_id).first()
    )
    if not tool_type_exists:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid tool_type_id: {tool_data.tool_type_id}. Category not found.",
        )

    # Tool cannot be added without at least one photo
    if not tool_data.photo_urls or len(tool_data.photo_urls) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A tool listing requires at least one uploaded photo.",
        )

    new_tool = Tool(
        tool_type_id=tool_data.tool_type_id,
        title=tool_data.title,
        description=tool_data.description,
        condition=tool_data.condition,
        pickup_notes=tool_data.pickup_notes,
        return_notes=tool_data.return_notes,
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
