"""
Tool routers.
Handles creating, viewing, and updating tools.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.tool import Tool, ToolType
from app.models.user import User
from app.schemas.common import DetailError
from app.schemas.tool import ToolRequest, ToolResponse
from app.utils.dependencies import get_current_user

router = APIRouter(prefix="/api/tools", tags=["Tools"])


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
    db.add(new_tool)
    db.commit()
    db.refresh(new_tool)

    return new_tool
