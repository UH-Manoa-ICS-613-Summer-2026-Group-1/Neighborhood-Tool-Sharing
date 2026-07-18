"""
Health check router.
"""

from fastapi import APIRouter, HTTPException, status

router = APIRouter(prefix="/api/health", tags=["Health"])


@router.get("", status_code=status.HTTP_200_OK)
def health_check():
    """
    Verify the API is healthy.
    """
    try:
        # Api is working
        return {"status": "healthy"}
    except Exception as e:
        # Api is not working
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"API Health Check Error: {str(e)}",
        )
